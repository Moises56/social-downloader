import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { VideoComposition, RenderedVideo } from '../../domain/video-composition';
import { FfmpegService } from './ffmpeg.service';
import { buildRenderCommand, buildProbeCommand } from './ffmpeg-command-builder';
import { TempAssetStorage } from '../storage/temp-asset-storage.service';

export interface RenderResult {
  render: RenderedVideo;
  filePath: string;
}

export interface RenderProgress {
  phase: 'preparing' | 'rendering' | 'finalizing' | 'completed' | 'failed';
  percent?: number;
}

@Injectable()
export class FfmpegVideoRenderer {
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(
    private readonly ffmpeg: FfmpegService,
    private readonly storage: TempAssetStorage,
  ) {}

  async probe(filePath: string): Promise<{ duration?: number; width?: number; height?: number }> {
    const { args } = buildProbeCommand(filePath);
    const result = await this.ffmpeg.runFfprobe({ args, timeoutMs: 15_000 });
    try {
      const info = JSON.parse(result.stdout);
      const video = info.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
      return {
        duration: info.format?.duration ? Number(info.format.duration) : undefined,
        width: video?.width ? Number(video.width) : undefined,
        height: video?.height ? Number(video.height) : undefined,
      };
    } catch {
      return {};
    }
  }

  /**
   * `renderId` lo provee quien llama (el controller usa el id de su render job) para que
   * `cancelRender(id)` encuentre el AbortController. Antes se generaba aquí dentro, así que
   * el id nunca coincidía con el que se usaba para cancelar y FFmpeg seguía corriendo.
   */
  async render(
    composition: VideoComposition,
    onProgress?: (progress: RenderProgress) => void,
    renderId: string = randomUUID(),
  ): Promise<RenderResult> {
    const renderDir = await this.storage.createRenderDir(renderId);
    const outputPath = join(renderDir, 'output.mp4');

    const sourcePath = await this.storage.resolveAssetPath(composition.source.assetId);
    if (!sourcePath) {
      throw new Error('Source asset not found');
    }

    const audioInputPaths: string[] = [];
    for (const track of composition.audioTracks) {
      const audioPath = await this.storage.resolveAssetPath(track.assetId);
      if (audioPath) {
        audioInputPaths.push(audioPath);
      }
    }

    // El orden importa: los índices de entrada del filtergraph son
    // 0 = fuente, luego audio, luego imágenes. Una imagen que no resuelva se descarta
    // junto a su capa, para que los índices no se desalineen con las cadenas generadas.
    const imageInputPaths: string[] = [];
    const resolvedImages: typeof composition.images = [];
    for (const image of composition.images ?? []) {
      const imagePath = await this.storage.resolveAssetPath(image.assetId);
      if (imagePath) {
        imageInputPaths.push(imagePath);
        resolvedImages.push(image);
      }
    }
    const renderable = { ...composition, images: resolvedImages };

    onProgress?.({ phase: 'preparing' });

    const { args } = buildRenderCommand(
      renderable,
      sourcePath,
      outputPath,
      audioInputPaths,
      imageInputPaths,
    );

    const abortController = new AbortController();
    this.abortControllers.set(renderId, abortController);

    onProgress?.({ phase: 'rendering', percent: 0 });

    // Con recorte, el render dura lo recortado, no el material entero: sin esto el
    // porcentaje de progreso se queda corto y nunca llega al final.
    const trim = composition.source.trim;
    const duration =
      trim && trim.end > trim.start
        ? trim.end - trim.start
        : composition.source.duration ?? 30;

    let result;
    try {
      result = await this.ffmpeg.runFfmpeg({
        args,
        timeoutMs: 600_000,
        signal: abortController.signal,
        onStderr: (chunk) => {
          const time = this.ffmpeg.parseProgressTime(chunk);
          if (time !== null && duration > 0) {
            const percent = Math.min(99, Math.round((time / duration) * 100));
            onProgress?.({ phase: 'rendering', percent });
          }
        },
      });
    } finally {
      // También en cancelación, timeout o fallo: si no, el Map crece sin límite.
      this.abortControllers.delete(renderId);
    }

    if (result.exitCode !== 0) {
      onProgress?.({ phase: 'failed' });
      throw new Error(`FFmpeg exited with code ${result.exitCode}: ${result.stderr.slice(0, 500)}`);
    }

    onProgress?.({ phase: 'finalizing', percent: 99 });

    const stats = await import('node:fs/promises').then((fs) =>
      fs.stat(outputPath).catch(() => null),
    );

    const rendered: RenderedVideo = {
      id: renderId,
      compositionId: composition.id,
      status: 'completed',
      filePath: outputPath,
      fileName: 'output.mp4',
      fileSize: stats?.size ?? 0,
      duration,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    onProgress?.({ phase: 'completed', percent: 100 });

    return { render: rendered, filePath: outputPath };
  }

  cancelRender(renderId: string): void {
    const controller = this.abortControllers.get(renderId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(renderId);
    }
  }
}
