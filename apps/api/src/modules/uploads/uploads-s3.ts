/**
 * Armazenamento opcional das fotos em bucket S3-compatível (Railway Bucket).
 * Desligado por padrão: só liga com UPLOADS_STORAGE=s3 e todas as UPLOADS_S3_* presentes.
 * O volume (UPLOADS_DIR) continua sendo escrito e lido primeiro — é o rollback.
 * As URLs públicas não mudam (/api/v1/uploads/<arquivo>).
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type UploadsS3Config = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  /** Prefixo das chaves no bucket (padrão "uploads/"). */
  prefix: string;
};

/** Nome de arquivo gerado pelo UploadsService: uuid + extensão. Bloqueia path traversal. */
export const UPLOAD_FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function isSafeUploadName(name: string): boolean {
  return UPLOAD_FILENAME_RE.test(name) && !name.includes('..');
}

export function uploadsS3Config(env: NodeJS.ProcessEnv = process.env): UploadsS3Config | null {
  if (String(env.UPLOADS_STORAGE || '').trim().toLowerCase() !== 's3') return null;
  const bucket = String(env.UPLOADS_S3_BUCKET || '').trim();
  const endpoint = String(env.UPLOADS_S3_ENDPOINT || '').trim();
  const accessKeyId = String(env.UPLOADS_S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(env.UPLOADS_S3_SECRET_ACCESS_KEY || '').trim();
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;
  const prefixRaw = String(env.UPLOADS_S3_PREFIX ?? 'uploads/').trim();
  return {
    bucket,
    endpoint,
    region: String(env.UPLOADS_S3_REGION || 'auto').trim() || 'auto',
    accessKeyId,
    secretAccessKey,
    forcePathStyle: String(env.UPLOADS_S3_FORCE_PATH_STYLE || '').trim().toLowerCase() === 'true',
    prefix: prefixRaw && !prefixRaw.endsWith('/') ? `${prefixRaw}/` : prefixRaw,
  };
}

export function uploadsS3Key(cfg: Pick<UploadsS3Config, 'prefix'>, filename: string): string {
  return `${cfg.prefix}${filename}`;
}

export class UploadsS3Store {
  private readonly client: S3Client;
  constructor(readonly cfg: UploadsS3Config) {
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: cfg.forcePathStyle,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }

  async put(filename: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: uploadsS3Key(this.cfg, filename),
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  /** null quando o objeto não existe. */
  async get(filename: string): Promise<{ body: Buffer; contentType: string | undefined } | null> {
    try {
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.cfg.bucket, Key: uploadsS3Key(this.cfg, filename) }),
      );
      if (!out.Body) return null;
      const bytes = await out.Body.transformToByteArray();
      return { body: Buffer.from(bytes), contentType: out.ContentType };
    } catch (e: any) {
      const code = e?.name || e?.Code;
      if (code === 'NoSuchKey' || code === 'NotFound' || e?.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }
}

/** Content-Type pela extensão (fallback quando o bucket não devolve). */
export function mimeFromUploadName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() || '';
  return (
    ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' } as Record<string, string>)[ext] ||
    'application/octet-stream'
  );
}
