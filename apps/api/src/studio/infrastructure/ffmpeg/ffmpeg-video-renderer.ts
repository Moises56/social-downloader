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

@Injectable()
export class FfmpegVideoRenderer {
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

  async render(
    composition: VideoComposition,
    signal?: AbortSignal,
  ): Promise<RenderResult> {
    const renderId = randomUUID();
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

    const { args } = buildRenderCommand(composition, sourcePath, outputPath, audioInputPaths);

    const result = await this.ffmpeg.runFfmpeg({
      args,
      timeoutMs: 600_000,
      signal,
    });

    if (result.exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${result.exitCode}: ${result.stderr.slice(0, 500)}`);
    }

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
      duration: composition.source.duration,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    return { render: rendered, filePath: outputPath };
  }
}
