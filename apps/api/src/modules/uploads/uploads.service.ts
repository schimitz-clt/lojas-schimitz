import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { rewritePublicUploadUrl } from '../../common/public-upload-url';
import { MIME_EXT } from './upload-validate';
import { buildPublicUploadUrl } from './public-upload-base';
import { UploadsS3Store, uploadsS3Config } from './uploads-s3';

export { UPLOAD_ALLOWED_MIME, UPLOAD_MAX_BYTES } from './upload-validate';

@Injectable()
export class UploadsService implements OnModuleInit {
  readonly dir: string;
  /** Bucket opcional (UPLOADS_STORAGE=s3). Null = só volume, comportamento antigo. */
  readonly s3: UploadsS3Store | null;

  constructor() {
    this.dir = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
    const cfg = uploadsS3Config();
    this.s3 = cfg ? new UploadsS3Store(cfg) : null;
  }

  onModuleInit() {
    mkdirSync(this.dir, { recursive: true });
  }

  /**
   * Grava no volume (sempre, enquanto existir) e, com o bucket ligado, também no bucket.
   * Falha no bucket = falha no upload: nunca deixa uma foto só no volume sem avisar.
   */
  async save(buffer: Buffer, mime: string): Promise<{ filename: string; relativePath: string }> {
    const ext = MIME_EXT[mime] || '.bin';
    const filename = `${randomUUID()}${ext}`;
    writeFileSync(join(this.dir, filename), buffer);
    if (this.s3) await this.s3.put(filename, buffer, mime);
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
