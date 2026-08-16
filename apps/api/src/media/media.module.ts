import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { PlatformDetector } from './platform-detector';

@Module({ controllers: [MediaController], providers: [MediaService, PlatformDetector] })
export class MediaModule {}
