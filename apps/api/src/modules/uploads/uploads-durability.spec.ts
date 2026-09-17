import assert from 'assert';
import {
  UPLOADS_PERSISTENT_ROOT,
  isUploadsDirPersistent,
  resolveUploadsDir,
  summarizeUploadsDurability,
} from './uploads-durability';

assert.equal(UPLOADS_PERSISTENT_ROOT, '/data');
assert.equal(isUploadsDirPersistent('/data/uploads'), true);
assert.equal(isUploadsDirPersistent('/data'), true);
assert.equal(isUploadsDirPersistent('/data/uploads/nested'), true);
assert.equal(isUploadsDirPersistent('/datafoo'), false);
assert.equal(isUploadsDirPersistent('/var/data/uploads'), false);
assert.equal(isUploadsDirPersistent('/tmp/uploads'), false);
assert.equal(isUploadsDirPersistent('uploads'), false);
assert.equal(isUploadsDirPersistent(''), false);
assert.equal(resolveUploadsDir(undefined, '/app'), '/app/uploads');
assert.equal(resolveUploadsDir('/data/uploads'), '/data/uploads');
assert.equal(summarizeUploadsDurability({ envDir: '/data/uploads' }).persistent, true);
assert.equal(summarizeUploadsDurability({ envDir: null, cwd: '/app' }).persistent, false);
console.log('uploads-durability unit tests ok');
