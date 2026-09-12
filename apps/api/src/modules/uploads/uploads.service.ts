import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { rewritePublicUploadUrl } from '../../common/public-upload-url';
import { MIME_EXT } from './upload-validate';
import { buildPublicUploadUrl } from './public-upload-base';

export { UPLOAD_ALLOWED_MIME, UPLOAD_MAX_BYTES } from './upload-validate';

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
    const ext = MIME_EXT[mime] || '.bin';
    const filename = `${randomUUID()}${ext}`;
    writeFileSync(join(this.dir, filename), buffer);
    return { filename, relativePath: `uploads/${filename}` };
  }

  /** Absolute public URL for a stored file under /api/v1/uploads/... */
  publicUrl(
    filename: string,
    req?: {
      protocol?: string;
      headers?: Record<string, unknown>;
      get?: (h: string) => string | undefined;
    },
  ) {
    const raw = buildPublicUploadUrl(filename, process.env, req);
    return rewritePublicUploadUrl(raw) || raw;
  }
}
