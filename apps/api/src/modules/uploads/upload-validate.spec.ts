import assert from 'assert';
import {
  UPLOAD_MAX_BYTES,
  mapMulterUploadError,
  sniffImageMime,
  validateUpload,
} from './upload-validate';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const webp = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const html = Buffer.from('<!doctype html>xxxx');
const pdf = Buffer.from('%PDF-1.4 xxxx');

assert.equal(sniffImageMime(jpeg), 'image/jpeg');
assert.equal(sniffImageMime(png), 'image/png');
assert.equal(sniffImageMime(webp), 'image/webp');
assert.equal(sniffImageMime(gif), null);
assert.equal(sniffImageMime(html), null);
assert.equal(sniffImageMime(pdf), null);
assert.equal(sniffImageMime(Buffer.alloc(0)), null);
assert.equal(sniffImageMime(null), null);

const okJpeg = validateUpload({ buffer: jpeg, mimetype: 'image/jpeg', size: jpeg.length });
assert.equal(okJpeg.ok, true);
if (okJpeg.ok) assert.equal(okJpeg.mime, 'image/jpeg');

const okPngWrongDeclared = validateUpload({
  buffer: png,
  mimetype: 'application/octet-stream',
  size: png.length,
});
assert.equal(okPngWrongDeclared.ok, true);
if (okPngWrongDeclared.ok) assert.equal(okPngWrongDeclared.mime, 'image/png');

const empty = validateUpload({ buffer: Buffer.alloc(0), mimetype: 'image/jpeg' });
assert.equal(empty.ok, false);
if (!empty.ok) assert.equal(empty.code, 'UPLOAD_EMPTY');

const missing = validateUpload({ buffer: undefined, mimetype: 'image/jpeg' });
assert.equal(missing.ok, false);
if (!missing.ok) assert.equal(missing.code, 'UPLOAD_EMPTY');

const tooBig = validateUpload({
  buffer: jpeg,
  mimetype: 'image/jpeg',
  size: UPLOAD_MAX_BYTES + 1,
});
assert.equal(tooBig.ok, false);
if (!tooBig.ok) {
  assert.equal(tooBig.code, 'UPLOAD_TOO_LARGE');
  assert.match(tooBig.message, /15 MB/);
}

const spoof = validateUpload({ buffer: html, mimetype: 'image/jpeg', size: html.length });
assert.equal(spoof.ok, false);
if (!spoof.ok) assert.equal(spoof.code, 'UPLOAD_CONTENT_INVALID');

const badType = validateUpload({ buffer: gif, mimetype: 'image/gif', size: gif.length });
assert.equal(badType.ok, false);
if (!badType.ok) assert.equal(badType.code, 'UPLOAD_TYPE_INVALID');

const multer = mapMulterUploadError({ name: 'MulterError', code: 'LIMIT_FILE_SIZE' });
assert.equal(multer?.code, 'UPLOAD_TOO_LARGE');
assert.equal(mapMulterUploadError(new Error('nope')), null);
assert.equal(mapMulterUploadError(null), null);

console.log('upload-validate unit tests ok');
