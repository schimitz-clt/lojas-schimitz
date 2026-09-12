import assert from 'assert';
import { rewritePublicUploadUrl } from './public-upload-url';

const railway =
  'https://lojas-schimitz-production.up.railway.app/api/v1/uploads/518992fa-c11b-4ca5-8113-18e5a1e6c6db.png';
const apex =
  'https://lojasschimitz.com.br/api/v1/uploads/518992fa-c11b-4ca5-8113-18e5a1e6c6db.png';

assert.equal(rewritePublicUploadUrl(railway), apex);
assert.equal(rewritePublicUploadUrl(apex), apex);
assert.equal(rewritePublicUploadUrl(null), null);
assert.equal(rewritePublicUploadUrl(''), '');
assert.equal(
  rewritePublicUploadUrl('https://placehold.co/800x800/1a1a1a/f5c518?text=Roblox'),
  'https://placehold.co/800x800/1a1a1a/f5c518?text=Roblox',
);
assert.equal(
  rewritePublicUploadUrl('https://lojas-schimitz-production.up.railway.app/api/v1/health'),
  'https://lojas-schimitz-production.up.railway.app/api/v1/health',
);
assert.equal(
  rewritePublicUploadUrl(
    'https://lojas-schimitz-production.up.railway.app/api/v1/uploads/../secret',
  ),
  'https://lojas-schimitz-production.up.railway.app/api/v1/uploads/../secret',
);

console.log('public-upload-url (web) unit tests ok');
