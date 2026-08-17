import { Module } from '@nestjs/common';
import { StudioController } from './presentation/studio.controller';
import { BrandPresetService } from './application/brand-preset.service';
import { TextOverlayService } from './application/text-overlay.service';
import { AudioMixingService } from './application/audio-mixing.service';
import { TempAssetStorage } from './infrastructure/storage/temp-asset-storage.service';
import { FfmpegService } from './infrastructure/ffmpeg/ffmpeg.service';
import { FfmpegVideoRenderer } from './infrastructure/ffmpeg/ffmpeg-video-renderer';

@Module({
  controllers: [StudioController],
  providers: [
    BrandPresetService,
    TextOverlayService,
    AudioMixingService,
    TempAssetStorage,
    FfmpegService,
    FfmpegVideoRenderer,
  ],
  exports: [TempAssetStorage, FfmpegVideoRenderer],
})
export class StudioModule {}
