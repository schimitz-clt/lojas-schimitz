import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMPTY_PHOTO_SELECTION_MESSAGE,
  PRODUCT_PHOTO_ACCEPT,
  emptyPhotoSelectionError,
  photoUploadProgressLabel,
  snapshotSelectedFiles,
  takeFilesFromInput,
} from './admin-photo-upload';

const fakeA = { name: 'a.jpg', type: 'image/jpeg', size: 12 } as File;
const fakeB = { name: 'b.png', type: 'image/png', size: 20 } as File;

function fakeFileList(items: File[]): FileList {
  const list = {
    length: items.length,
    item: (i: number) => items[i] ?? null,
    *[Symbol.iterator]() {
      yield* items;
    },
  } as FileList;
  items.forEach((file, i) => {
    Object.defineProperty(list, i, { value: file, enumerable: true });
  });
  return list;
}

assert.equal(PRODUCT_PHOTO_ACCEPT, 'image/*,.jpg,.jpeg,.png,.webp');
assert.ok(PRODUCT_PHOTO_ACCEPT.includes('image/*'));
assert.ok(PRODUCT_PHOTO_ACCEPT.includes('.jpg'));

assert.deepEqual(snapshotSelectedFiles(null), []);
assert.deepEqual(snapshotSelectedFiles([]), []);
assert.deepEqual(snapshotSelectedFiles(fakeFileList([])), []);
assert.equal(snapshotSelectedFiles(fakeFileList([fakeA, fakeB])).length, 2);
assert.equal(snapshotSelectedFiles([fakeA])[0], fakeA);

const liveBox = {
  files: fakeFileList([fakeA, fakeB]),
  value: 'C:\\fakepath\\a.jpg',
};
const copied = takeFilesFromInput(liveBox);
assert.equal(copied.length, 2);
assert.equal(copied[0], fakeA);
assert.equal(liveBox.value, '');
// Simulate Android Chrome: clearing value empties the live FileList.
liveBox.files = fakeFileList([]);
assert.equal(copied.length, 2, 'snapshot must survive clearing input.value');
assert.equal(snapshotSelectedFiles(liveBox.files).length, 0);

assert.equal(photoUploadProgressLabel(1, 3), 'Enviando… 1/3');
assert.equal(photoUploadProgressLabel(3, 3), 'Enviando… 3/3');
assert.equal(photoUploadProgressLabel(0, 2), 'Enviando… 1/2');
assert.equal(emptyPhotoSelectionError(), EMPTY_PHOTO_SELECTION_MESSAGE);
assert.ok(EMPTY_PHOTO_SELECTION_MESSAGE.includes('Nenhuma foto'));

const srcRoot = join(__dirname, '..');
const catalog = readFileSync(join(srcRoot, 'components/admin/sections/AdminCatalogoSection.tsx'), 'utf8');
assert.ok(catalog.includes('AdminPhotoFilePicker'), 'form+list use mobile-safe picker');
assert.ok(!catalog.includes('admin-file-hidden'), 'catalog must not clip/1px hide file inputs');
assert.ok(catalog.includes('role="alert"'), 'photo errors are loud in the photo section');
assert.ok(catalog.includes('uploadProgress'), 'shows Enviando… N/M');
assert.ok(catalog.includes('Adicionar mais fotos'), 'owner can add more photos');
assert.ok(catalog.includes('Adicionar URL'), 'URL paste path stays');

const picker = readFileSync(join(srcRoot, 'components/admin/AdminPhotoFilePicker.tsx'), 'utf8');
assert.ok(picker.includes('takeFilesFromInput'), 'copies FileList before clearing');
assert.ok(picker.includes('PRODUCT_PHOTO_ACCEPT'), 'accept comes from helper');
assert.ok(picker.includes('admin-file-picker__visible'), 'visible native input');
assert.ok(picker.includes('admin-file-picker__cover'), 'overlay hit area');
assert.ok(picker.includes('multiple'), 'multi-select stays');
assert.ok(picker.includes('multiple = true'), 'catalog keeps multi default');
assert.ok(!picker.includes('admin-file-hidden'), 'picker is not clip-hidden');
assert.ok(!/clip:\s*rect/.test(picker), 'picker must not clip the input');

const css = readFileSync(join(srcRoot, 'components/admin/admin-theme.css'), 'utf8');
assert.ok(css.includes('.admin-file-picker__cover'), 'overlay CSS present');
assert.ok(css.includes('.admin-file-picker__visible'), 'visible input CSS present');
assert.ok(/\.admin-file-picker__cover[\s\S]{0,180}opacity:\s*0/.test(css), 'cover uses opacity 0 not clip');
assert.ok(/\.admin-file-picker__cover[\s\S]{0,180}min-height:\s*48px/.test(css), 'cover has 48px hit area');

const state = readFileSync(join(srcRoot, 'components/admin/admin-console-state.ts'), 'utf8');
assert.ok(state.includes('snapshotSelectedFiles'), 'upload copies FileList');
assert.ok(state.includes('emptyPhotoSelectionError'), 'empty select is loud');
assert.ok(state.includes('photoUploadProgressLabel'), 'progress 1/N');
assert.ok(state.includes('applyProductSaveImageFields'), 'PR #32 empty imageUrl still omitted');

const vitrine = readFileSync(join(srcRoot, 'components/admin/sections/AdminVitrineSection.tsx'), 'utf8');
assert.ok(vitrine.includes('AdminPhotoFilePicker'), 'vitrine uses mobile-safe picker');
assert.ok(!vitrine.includes('admin-file-hidden'), 'vitrine must not clip/1px hide file inputs');
assert.ok(!/display:\s*'none'/.test(vitrine), 'vitrine must not hide the banner file input');
assert.ok(vitrine.includes('role="alert"'), 'banner errors are loud on the banner block');
assert.ok(vitrine.includes('Criar outro banner'), 'owner can add another banner');

const mw = readFileSync(join(srcRoot, 'middleware.ts'), 'utf8');
assert.ok(mw.includes('api/'), 'upload POSTs skip middleware body limit');

console.log('admin-photo-upload unit tests ok');
