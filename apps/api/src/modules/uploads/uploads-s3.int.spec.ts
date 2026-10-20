/**
 * Integração contra um S3 local (moto/minio). Roda só com UPLOADS_S3_TEST_ENDPOINT definido:
 *   moto_server -p 5055 & UPLOADS_S3_TEST_ENDPOINT=http://127.0.0.1:5055 tsx src/modules/uploads/uploads-s3.int.spec.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';

async function main() {
  const endpoint = process.env.UPLOADS_S3_TEST_ENDPOINT;
  if (!endpoint) {
    console.log('uploads-s3.int.spec skip (sem UPLOADS_S3_TEST_ENDPOINT)');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'up-'));
  Object.assign(process.env, {
    UPLOADS_DIR: dir,
    UPLOADS_STORAGE: 's3',
    UPLOADS_S3_BUCKET: 'ls-test',
    UPLOADS_S3_ENDPOINT: endpoint,
    UPLOADS_S3_REGION: 'us-east-1',
    UPLOADS_S3_ACCESS_KEY_ID: 'test',
    UPLOADS_S3_SECRET_ACCESS_KEY: 'test',
    UPLOADS_S3_FORCE_PATH_STYLE: 'true',
  });
  const c = new S3Client({ endpoint, region: 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
  await c.send(new CreateBucketCommand({ Bucket: 'ls-test' })).catch(() => undefined);
  const { UploadsService } = await import('./uploads.service');
  const svc = new UploadsService();
  assert.ok(svc.s3, 'bucket ligado');
  const img = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
  const { filename } = await svc.save(img, 'image/jpeg');
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  assert.equal(sha(readFileSync(join(dir, filename))), sha(img), 'volume continua recebendo');
  const got = await svc.s3!.get(filename);
  assert.ok(got);
  assert.equal(sha(got!.body), sha(img), 'bucket com os mesmos bytes');
  assert.equal(got!.contentType, 'image/jpeg');
  assert.equal(await svc.s3!.get('nao-existe.jpg'), null);
  console.log('uploads-s3.int.spec ok');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
