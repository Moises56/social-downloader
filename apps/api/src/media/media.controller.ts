import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { MediaService } from './media.service';

class AnalyzeDto { @IsUrl({ require_protocol: true }) url!: string; }
class DownloadDto {
  @IsUrl({ require_protocol: true }) url!: string;
  @IsIn(['video', 'audio']) kind!: 'video' | 'audio';
  @IsOptional() @IsInt() @Min(144) @Max(4320) quality?: number;
  @IsOptional() @IsIn(['mp3', 'm4a', 'opus']) audioFormat?: 'mp3' | 'm4a' | 'opus';
}

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}
  @Post('analyze') analyze(@Body() body: AnalyzeDto) { return this.media.analyze(body.url); }
  @Post('download') async download(@Body() body: DownloadDto, @Res() res: Response) {
    await this.media.download(body, res);
  }
}
