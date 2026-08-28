import { Module } from '@nestjs/common';
import { MediaModule } from './media/media.module';
import { StudioModule } from './studio/studio.module';

@Module({ imports: [MediaModule, StudioModule] })
export class AppModule {}
