import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_ALLOWED_MIME = new Set(Object.keys(MIME_EXT));

@Injectable()
export class UploadsService implements OnModuleInit {
  readonly dir: string;

  constructor() {
    this.dir = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
  }

  onModuleInit() {
    mkdirSync(this.dir, { recursive: true });
  }

  save(buffer: Buffer, mime: string): { filename: string; relativePath: string } {
    const ext = MIME_EXT[mime] || extname('') || '.bin';
    const filename = `${randomUUID()}${ext}`;
    writeFileSync(join(this.dir, filename), buffer);
    return { filename, relativePath: `uploads/${filename}` };
  }

  /** Absolute public URL for a stored file under /api/v1/uploads/... */
  publicUrl(filename: string, req?: { protocol?: string; headers?: Record<string, unknown>; get?: (h: string) => string | undefined }) {
    const prefix = (process.env.API_PREFIX || 'api/v1').replace(/^\/|\/$/g, '');
    const envBase = (process.env.PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || '')
      .trim()
      .replace(/\/$/, '');
    if (envBase) {
      return `${envBase}/uploads/${filename}`;
    }
    const headers = req?.headers || {};
    const xfProto = String(headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const xfHost = String(headers['x-forwarded-host'] || '').split(',')[0].trim();
    const proto = xfProto || req?.protocol || 'http';
    const host = xfHost || req?.get?.('host') || 'localhost:3001';
    return `${proto}://${host}/${prefix}/uploads/${filename}`;
  }
}
