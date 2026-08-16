import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { analyzeSchema, downloadSchema, MediaService } from '../application/media.service';
import { ApiError } from '../shared/errors';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('analyze')
  async analyze(@Body() body: unknown) {
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('INVALID_URL', parsed.error.issues[0]?.message);
    }
    return this.mediaService.analyze(parsed.data.url);
  }

  @Post('download')
  async download(@Body() body: unknown, @Res() res: Response, @Req() req: Request): Promise<void> {
    const parsed = downloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('INVALID_URL', parsed.error.issues[0]?.message);
    }
    await this.mediaService.download(parsed.data, res, req);
  }

  @Post('download/prepare')
  prepareDownload(@Body() body: unknown) {
    const parsed = downloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('INVALID_URL', parsed.error.issues[0]?.message);
    }
    return this.mediaService.prepareDownload(parsed.data);
  }

  @Get('download/:token')
  async downloadPrepared(@Param('token') token: string, @Res() res: Response, @Req() req: Request): Promise<void> {
    await this.mediaService.downloadPrepared(token, res, req);
  }
}
