import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiError } from '../../media/shared/errors';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type {
  BrandPresetsResponse,
  TextPresetsResponse,
  CompositionPresetsResponse,
  ExportPresetsResponse,
  CreateCompositionRequest,
  CreateCompositionResponse,
  DuplicateCompositionRequest,
  DuplicateCompositionResponse,
  StartRenderRequest,
  StartRenderResponse,
  RenderStatusResponse,
  SaveCompositionPresetRequest,
  SaveCompositionPresetResponse,
  SavedCompositionPresetsResponse,
  ValidateCompositionRequest,
  ValidateCompositionResponse,
  VideoComposition,
  RenderedVideo,
  SavedCompositionPreset,
} from '@social-downloader/contracts';
import { BrandPresetService } from '../application/brand-preset.service';
import { TextPresetService } from '../application/text-preset.service';
import { CompositionPresetService } from '../application/composition-preset.service';
import { ExportPresetService } from '../application/export-preset.service';
import { CompositionValidationService } from '../application/composition-validation.service';
import { TextOverlayService } from '../application/text-overlay.service';
import { AudioMixingService } from '../application/audio-mixing.service';
import { TempAssetStorage } from '../infrastructure/storage/temp-asset-storage.service';
import { FfmpegVideoRenderer } from '../infrastructure/ffmpeg/ffmpeg-video-renderer';
import { DEFAULT_OUTPUT } from '../domain/video-composition';

// Indexado por render id (NO por compositionId): dos renders de la misma composición son
// dos jobs distintos, y antes el segundo sobrescribía al primero.
/**
 * Tope de subida. El fichero se retiene entero en memoria (multer memoryStorage), así que
 * este límite es lo único que separa una subida grande de tumbar el proceso.
 * TODO: pasar a diskStorage para no depender del tamaño en RAM.
 */
const MAX_UPLOAD_BYTES = Number(process.env.STUDIO_MAX_UPLOAD_MB ?? 512) * 1024 * 1024;

/** Fuentes de vídeo, pistas de audio y logos/stickers para las capas de imagen. */
const ACCEPTED_UPLOAD_TYPES = /^(video|audio|image)\//;

const renderJobs = new Map<string, { render: RenderedVideo; composition: VideoComposition }>();
const compositionJobs = new Map<string, VideoComposition>();
const savedPresets = new Map<string, SavedCompositionPreset>();

@Controller('studio')
export class StudioController {
  constructor(
    private readonly brandPresets: BrandPresetService,
    private readonly textPresets: TextPresetService,
    private readonly compositionPresets: CompositionPresetService,
    private readonly exportPresets: ExportPresetService,
    private readonly validation: CompositionValidationService,
    private readonly textOverlays: TextOverlayService,
    private readonly audioMixing: AudioMixingService,
    private readonly storage: TempAssetStorage,
    private readonly renderer: FfmpegVideoRenderer,
  ) {}

  @Get('brand-presets')
  getBrandPresets(): BrandPresetsResponse {
    return { presets: this.brandPresets.listPresets() };
  }

  @Get('text-presets')
  getTextPresets(): TextPresetsResponse {
    return { presets: this.textPresets.listPresets() };
  }

  @Get('composition-presets')
  getCompositionPresets(): CompositionPresetsResponse {
    return { presets: this.compositionPresets.listPresets() };
  }

  @Get('export-presets')
  getExportPresets(): ExportPresetsResponse {
    return { presets: this.exportPresets.listPresets() };
  }

  @Post('validate')
  validateComposition(
    @Body() body: ValidateCompositionRequest,
  ): ValidateCompositionResponse {
    return { warnings: this.validation.validate(body.composition) };
  }

  @Post('sources/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!ACCEPTED_UPLOAD_TYPES.test(file.mimetype)) {
          cb(new ApiError('STUDIO_UNSUPPORTED_FORMAT', `Tipo no admitido: ${file.mimetype}`), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async uploadSource(
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new ApiError('STUDIO_INVALID_SOURCE', 'No se recibió ningún archivo.');
    }

    const { id, size } = await this.storage.createAsset(
      file.originalname,
      file.buffer,
    );

    let duration: number | undefined;
    let width: number | undefined;
    let height: number | undefined;

    try {
      const filePath = await this.storage.resolveAssetPath(id);
      if (filePath) {
        const probe = await this.renderer.probe(filePath);
        duration = probe.duration;
        width = probe.width;
        height = probe.height;
      }
    } catch {
      // probe failure is non-fatal
    }

    return {
      asset: {
        id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size,
        duration,
        width,
        height,
        createdAt: new Date().toISOString(),
      },
    };
  }

  @Post('compositions')
  @HttpCode(HttpStatus.CREATED)
  async createComposition(
    @Body() body: CreateCompositionRequest,
  ): Promise<CreateCompositionResponse> {
    const assetPath = await this.storage.resolveAssetPath(body.sourceAssetId);
    if (!assetPath) {
      throw new ApiError('STUDIO_ASSET_NOT_FOUND');
    }

    let duration = 0;
    try {
      const probe = await this.renderer.probe(assetPath);
      duration = probe.duration ?? 0;
    } catch {
      // default
    }

    // El recorte se valida contra el material real: unos tiempos invertidos o fuera de
    // rango producirían un `-t` negativo y un render vacío.
    let trim = body.sourceTrim;
    if (trim) {
      const start = Math.max(0, trim.start);
      const end = duration > 0 ? Math.min(duration, trim.end) : trim.end;
      if (!(end > start)) {
        throw new ApiError(
          'STUDIO_INVALID_COMPOSITION',
          'El recorte no es válido: el final debe ser posterior al inicio.',
        );
      }
      trim = { start, end };
    }

    const source = {
      assetId: body.sourceAssetId,
      fileName: 'source',
      duration,
      trim,
    };

    // Todo lo temporal (overlays, marca, audio) es relativo al material YA recortado.
    const effectiveDuration = trim ? trim.end - trim.start : duration;

    let output = { ...DEFAULT_OUTPUT };
    if (body.exportPresetId) {
      const exportPreset = this.exportPresets.getPreset(body.exportPresetId);
      if (exportPreset) {
        output = {
          ...output,
          width: exportPreset.width,
          height: exportPreset.height,
          fps: exportPreset.fps,
          crf: exportPreset.crf,
          preset: exportPreset.preset,
          audioBitrate: exportPreset.audioBitrate,
          audioSampleRate: exportPreset.audioSampleRate,
          audioChannels: exportPreset.audioChannels,
          movflags: exportPreset.movflags,
        };
      }
    }

    const composition: VideoComposition = {
      id: randomUUID(),
      source,
      output,
      brandPresetId: body.brandPresetId,
      exportPresetId: body.exportPresetId,
      videoFit: body.videoFit,
      overlays: body.overlays ?? [],
      textTracks: body.textTracks ?? [],
      audioTracks: body.audioTracks ?? [],
      masks: body.masks ?? [],
      images: body.images ?? [],
      keepOriginalAudio: body.keepOriginalAudio ?? true,
      originalAudioVolume: body.originalAudioVolume ?? 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (composition.brandPresetId) {
      const brandOverlays = this.brandPresets.createBrandOverlay(
        composition.brandPresetId,
        effectiveDuration,
        undefined,
        undefined,
        body.brandCustomPosition,
      );
      composition.overlays = [...composition.overlays, ...brandOverlays];
    }

    compositionJobs.set(composition.id, composition);

    return { composition };
  }

  @Post('compositions/duplicate')
  @HttpCode(HttpStatus.CREATED)
  duplicateComposition(
    @Body() body: DuplicateCompositionRequest,
  ): DuplicateCompositionResponse {
    const original = compositionJobs.get(body.compositionId);
    if (!original) {
      throw new ApiError('STUDIO_COMPOSITION_NOT_FOUND');
    }

    const duplicate: VideoComposition = {
      ...original,
      id: randomUUID(),
      overlays: original.overlays.map((o) => ({ ...o, id: randomUUID() })),
      masks: (original.masks ?? []).map((m) => ({ ...m, id: randomUUID() })),
      images: (original.images ?? []).map((i) => ({ ...i, id: randomUUID() })),
      textTracks: original.textTracks.map((t) => ({ ...t, id: randomUUID() })),
      audioTracks: original.audioTracks.map((a) => ({ ...a, id: randomUUID() })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    compositionJobs.set(duplicate.id, duplicate);

    return { composition: duplicate };
  }

  @Post('presets')
  @HttpCode(HttpStatus.CREATED)
  saveCompositionPreset(
    @Body() body: SaveCompositionPresetRequest,
  ): SaveCompositionPresetResponse {
    const composition = compositionJobs.get(body.compositionId);
    if (!composition) {
      throw new ApiError('STUDIO_COMPOSITION_NOT_FOUND');
    }

    const preset: SavedCompositionPreset = {
      id: randomUUID(),
      name: body.name,
      brandPresetId: composition.brandPresetId,
      textTracks: composition.textTracks.map((t) => ({ ...t })),
      audioTracks: composition.audioTracks.map((a) => ({ ...a })),
      keepOriginalAudio: composition.keepOriginalAudio,
      originalAudioVolume: composition.originalAudioVolume,
      createdAt: new Date().toISOString(),
    };

    savedPresets.set(preset.id, preset);

    return { preset };
  }

  @Get('presets')
  getSavedPresets(): SavedCompositionPresetsResponse {
    return { presets: Array.from(savedPresets.values()) };
  }

  @Delete('presets/:id')
  @HttpCode(HttpStatus.OK)
  deleteSavedPreset(@Param('id') id: string): void {
    if (!savedPresets.has(id)) {
      throw new NotFoundException('Preset no encontrado');
    }
    savedPresets.delete(id);
  }

  @Post('renders')
  @HttpCode(HttpStatus.ACCEPTED)
  async startRender(
    @Body() body: StartRenderRequest,
  ): Promise<StartRenderResponse> {
    const composition = compositionJobs.get(body.compositionId);
    if (!composition) {
      throw new ApiError('STUDIO_COMPOSITION_NOT_FOUND');
    }

    const render: RenderedVideo = {
      id: randomUUID(),
      compositionId: body.compositionId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    renderJobs.set(render.id, { render, composition });

    this.executeRender(render.id).catch(() => {});

    return { render };
  }

  @Get('renders/:id/progress')
  getRenderProgress(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const entry = renderJobs.get(id);
    if (!entry) {
      res.write(`data: ${JSON.stringify({ phase: 'failed', percent: 0 })}\n\n`);
      res.end();
      return;
    }

    const isTerminal = (): boolean =>
      entry.render.status === 'completed' ||
      entry.render.status === 'failed' ||
      entry.render.status === 'cancelled';

    const sendProgress = (): void => {
      const data = {
        phase: entry.render.status === 'completed' ? 'completed'
          : entry.render.status === 'failed' ? 'failed'
          : entry.render.status === 'cancelled' ? 'cancelled'
          : entry.render.status === 'rendering' ? 'rendering'
          : 'preparing',
        percent: entry.render.progress ?? 0,
      };
      res.write(`data: ${JSON.stringify(data)}\n\n`);

      if (isTerminal()) {
        res.end();
      }
    };

    sendProgress();
    const interval = setInterval(() => {
      sendProgress();
      if (isTerminal()) {
        clearInterval(interval);
      }
    }, 500);

    res.on('close', () => clearInterval(interval));
  }

  @Post('renders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelRender(@Param('id') id: string): void {
    const entry = renderJobs.get(id);
    if (!entry) {
      throw new ApiError('STUDIO_RENDER_NOT_FOUND');
    }
    this.renderer.cancelRender(entry.render.id);
    entry.render = {
      ...entry.render,
      status: 'cancelled',
      error: 'Cancelled by user',
    };
  }

  @Get('renders/:id')
  getRenderStatus(
    @Param('id') id: string,
  ): RenderStatusResponse {
    const entry = renderJobs.get(id);
    if (!entry) {
      throw new ApiError('STUDIO_RENDER_NOT_FOUND');
    }
    return { render: entry.render };
  }

  @Get('renders/:id/download')
  async downloadRender(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const entry = renderJobs.get(id);
    if (!entry || !entry.render.filePath) {
      throw new ApiError('STUDIO_RENDER_NOT_FOUND');
    }

    try {
      await access(entry.render.filePath);
    } catch {
      throw new ApiError('STUDIO_RENDER_NOT_FOUND', 'El archivo del render ya no está disponible');
    }

    res.set({
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${entry.render.fileName ?? 'video.mp4'}"`,
    });

    createReadStream(entry.render.filePath).pipe(res);
  }

  private async executeRender(renderId: string): Promise<void> {
    const entry = renderJobs.get(renderId);
    if (!entry) return;

    entry.render.status = 'rendering';

    try {
      const result = await this.renderer.render(
        entry.composition,
        (progress) => {
          entry.render.progress = progress.percent;
          if (progress.phase === 'completed') {
            entry.render.status = 'completed';
          } else if (progress.phase === 'failed') {
            entry.render.status = 'failed';
          }
        },
        renderId,
      );
      entry.render = {
        ...entry.render,
        status: 'completed',
        filePath: result.render.filePath,
        fileName: result.render.fileName,
        fileSize: result.render.fileSize,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'CANCELLED') {
        entry.render = {
          ...entry.render,
          status: 'cancelled',
          error: 'Cancelled by user',
        };
      } else {
        entry.render = {
          ...entry.render,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  }
}
