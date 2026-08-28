import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, stat, rm, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const STUDIO_ROOT = join(tmpdir(), 'social-downloader-studio');
const ASSETS_DIR = 'assets';
const RENDERS_DIR = 'renders';

@Injectable()
export class TempAssetStorage implements OnModuleDestroy {
  private readonly rootDir = STUDIO_ROOT;
  private readonly assetsDir = join(STUDIO_ROOT, ASSETS_DIR);
  private readonly rendersDir = join(STUDIO_ROOT, RENDERS_DIR);

  async onModuleDestroy(): Promise<void> {
    await this.cleanupAll();
  }

  async ensureDirs(): Promise<void> {
    await mkdir(this.assetsDir, { recursive: true });
    await mkdir(this.rendersDir, { recursive: true });
  }

  async createAsset(
    fileName: string,
    buffer: Buffer,
  ): Promise<{ id: string; filePath: string; size: number }> {
    const id = randomUUID();
    const safeName = this.sanitizeFileName(fileName);
    const dir = join(this.assetsDir, id);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, safeName);
    await writeFile(filePath, buffer);
    return { id, filePath, size: buffer.length };
  }

  async resolveAssetPath(assetId: string): Promise<string | null> {
    const dir = join(this.assetsDir, assetId);
    try {
      await access(dir);
    } catch {
      return null;
    }
    const entries = await readdir(dir);
    if (entries.length === 0) return null;
    return join(dir, entries[0]);
  }

  async createRenderDir(renderId: string): Promise<string> {
    const dir = join(this.rendersDir, renderId);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async resolveRenderPath(renderId: string, fileName: string): Promise<string | null> {
    const filePath = join(this.rendersDir, renderId, this.sanitizeFileName(fileName));
    try {
      await access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  async getAssetSize(assetId: string): Promise<number | null> {
    const filePath = await this.resolveAssetPath(assetId);
    if (!filePath) return null;
    const s = await stat(filePath).catch(() => null);
    return s?.size ?? null;
  }

  async deleteAsset(assetId: string): Promise<void> {
    const dir = join(this.assetsDir, assetId);
    await rm(dir, { recursive: true, force: true });
  }

  async deleteRender(renderId: string): Promise<void> {
    const dir = join(this.rendersDir, renderId);
    await rm(dir, { recursive: true, force: true });
  }

  private async cleanupAll(): Promise<void> {
    await rm(this.rootDir, { recursive: true, force: true });
  }

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 200);
  }
}
