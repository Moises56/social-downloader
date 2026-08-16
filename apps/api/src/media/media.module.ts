import { Module } from '@nestjs/common';
import { MediaService } from './application/media.service';
import { YtDlpMediaExtractor } from './infrastructure/yt-dlp/yt-dlp-media-extractor';
import { MediaController } from './presentation/media.controller';

@Module({
  controllers: [MediaController],
  providers: [MediaService, YtDlpMediaExtractor],
  exports: [MediaService],
})
export class MediaModule {}
