import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type {
  BrandPresetsResponse,
  TextPresetsResponse,
  CreateCompositionRequest,
  CreateCompositionResponse,
  StartRenderRequest,
  StartRenderResponse,
  RenderStatusResponse,
  VideoComposition,
  RenderedVideo,
} from '@social-downloader/contracts';
import { BrandPresetService } from '../application/brand-preset.service';
import { TextPresetService } from '../application/text-preset.service';
import { TextOverlayService } from '../application/text-overlay.service';
import { AudioMixingService } from '../application/audio-mixing.service';
import { TempAssetStorage } from '../infrastructure/storage/temp-asset-storage.service';
import { FfmpegVideoRenderer } from '../infrastructure/ffmpeg/ffmpeg-video-renderer';
import { DEFAULT_OUTPUT } from '../domain/video-composition';

const renderJobs = new Map<string, { render: RenderedVideo; composition: VideoComposition }>();

@Controller('studio')
export class StudioController {
  constructor(
    private readonly brandPresets: BrandPresetService,
    private readonly textPresets: TextPresetService,
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

  @Post('sources/upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadSource(
    @UploadedFile() file: Express.Multer.File,
  ) {
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
      throw new Error('Asset not found');
    }

    let duration = 0;
    try {
      const probe = await this.renderer.probe(assetPath);
      duration = probe.duration ?? 0;
    } catch {
      // default
    }

    const source = {
      assetId: body.sourceAssetId,
      fileName: 'source',
      duration,
    };

    const composition: VideoComposition = {
      id: randomUUID(),
      source,
      output: DEFAULT_OUTPUT,
      brandPresetId: body.brandPresetId,
      overlays: body.overlays ?? [],
      textTracks: body.textTracks ?? [],
      audioTracks: body.audioTracks ?? [],
      keepOriginalAudio: body.keepOriginalAudio ?? true,
      originalAudioVolume: body.originalAudioVolume ?? 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (composition.brandPresetId) {
      const brandOverlays = this.brandPresets.createBrandOverlay(
        composition.brandPresetId,
        duration,
      );
      composition.overlays = [...composition.overlays, ...brandOverlays];
    }

    return { composition };
  }

  @Post('renders')
  @HttpCode(HttpStatus.ACCEPTED)
  async startRender(
    @Body() body: StartRenderRequest,
  ): Promise<StartRenderResponse> {
    const jobEntry = renderJobs.get(body.compositionId);
    if (!jobEntry) {
      throw new Error('Composition not found');
    }

    const render: RenderedVideo = {
      id: randomUUID(),
      compositionId: body.compositionId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    renderJobs.set(body.compositionId, { render, composition: jobEntry.composition });

    this.executeRender(body.compositionId).catch(() => {});

    return { render };
  }

  @Get('renders/:id')
  getRenderStatus(
    @Param('id') id: string,
  ): RenderStatusResponse {
    const entry = Array.from(renderJobs.values()).find((e) => e.render.id === id);
    if (!entry) {
      throw new Error('Render not found');
    }
    return { render: entry.render };
  }

  @Get('renders/:id/download')
  async downloadRender(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const entry = Array.from(renderJobs.values()).find((e) => e.render.id === id);
    if (!entry || !entry.render.filePath) {
      throw new Error('Render not found');
    }

    try {
      await access(entry.render.filePath);
    } catch {
      throw new Error('Render file not found');
    }

    res.set({
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${entry.render.fileName ?? 'video.mp4'}"`,
    });

    createReadStream(entry.render.filePath).pipe(res);
  }

  private async executeRender(compositionId: string): Promise<void> {
    const entry = renderJobs.get(compositionId);
    if (!entry) return;

    entry.render.status = 'rendering';

    try {
      const result = await this.renderer.render(entry.composition);
      entry.render = {
        ...entry.render,
        status: 'completed',
        filePath: result.render.filePath,
        fileName: result.render.fileName,
        fileSize: result.render.fileSize,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      entry.render = {
        ...entry.render,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
