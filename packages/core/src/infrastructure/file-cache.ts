import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { CachePort } from '../ports/index.js';

interface CacheEntry {
  expiresAt: number;
  value: string;
}

export class FileCache implements CachePort {
  constructor(private readonly cacheDir: string) {}

  async get(key: string): Promise<string | null> {
    const path = this.entryPath(key);
    try {
      const raw = await readFile(path, 'utf-8');
      const entry = JSON.parse(raw) as CacheEntry;
      if (Date.now() > entry.expiresAt) {
        return null;
      }
      return entry.value;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
    const entry: CacheEntry = {
      expiresAt: Date.now() + ttlSeconds * 1000,
      value,
    };
    await writeFile(this.entryPath(key), JSON.stringify(entry), 'utf-8');
  }

  private entryPath(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex');
    return join(this.cacheDir, `${hash}.json`);
  }
}
