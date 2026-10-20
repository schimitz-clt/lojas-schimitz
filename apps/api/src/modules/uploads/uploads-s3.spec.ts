import assert from 'node:assert/strict';
import { isSafeUploadName, mimeFromUploadName, uploadsS3Config, uploadsS3Key } from './uploads-s3';

const full = {
  UPLOADS_STORAGE: 's3',
  UPLOADS_S3_BUCKET: 'b',
  UPLOADS_S3_ENDPOINT: 'https://s3.example',
  UPLOADS_S3_ACCESS_KEY_ID: 'k',
  UPLOADS_S3_SECRET_ACCESS_KEY: 's',
};
assert.equal(uploadsS3Config({}), null, 'desligado por padrão');
assert.equal(uploadsS3Config({ ...full, UPLOADS_STORAGE: 'volume' }), null);
assert.equal(uploadsS3Config({ ...full, UPLOADS_S3_SECRET_ACCESS_KEY: '' }), null, 'incompleto = volume');
const c = uploadsS3Config(full)!;
assert.equal(c.region, 'auto');
assert.equal(c.prefix, 'uploads/');
assert.equal(c.forcePathStyle, false);
assert.equal(uploadsS3Config({ ...full, UPLOADS_S3_PREFIX: 'fotos', UPLOADS_S3_FORCE_PATH_STYLE: 'true' })!.prefix, 'fotos/');
assert.equal(uploadsS3Key(c, 'a.jpg'), 'uploads/a.jpg');
assert.ok(isSafeUploadName('3f2a-11.jpg'));
assert.ok(!isSafeUploadName('../etc/passwd'));
assert.ok(!isSafeUploadName('a/b.jpg'));
assert.ok(!isSafeUploadName('.hidden'));
assert.ok(!isSafeUploadName('a..jpg'));
assert.equal(mimeFromUploadName('x.WEBP'), 'image/webp');
assert.equal(mimeFromUploadName('x.bin'), 'application/octet-stream');
console.log('uploads-s3.spec ok');
