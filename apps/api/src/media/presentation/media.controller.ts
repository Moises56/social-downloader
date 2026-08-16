import { BadRequestException, Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { analyzeSchema, downloadSchema, MediaService } from '../application/media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('analyze')
  async analyze(@Body() body: unknown) {
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'INVALID_URL');
    }
    return this.mediaService.analyze(parsed.data.url);
  }

  @Post('download')
  async download(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const parsed = downloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'INVALID_REQUEST');
    }
    await this.mediaService.download(parsed.data, res);
  }

  @Post('download/prepare')
  prepareDownload(@Body() body: unknown) {
    const parsed = downloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'INVALID_REQUEST');
    }
    return this.mediaService.prepareDownload(parsed.data);
  }

  @Get('download/:token')
  async downloadPrepared(@Param('token') token: string, @Res() res: Response): Promise<void> {
    await this.mediaService.downloadPrepared(token, res);
  }
}
