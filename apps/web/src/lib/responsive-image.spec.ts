import assert from 'assert';
import { IMAGE_WIDTHS, NEXT_IMAGE_WIDTHS, nextImageUrl, ownUploadPath, responsiveImageProps } from './responsive-image';

const id = '7449155a-79c9-499e-a58f-18b2f9310b1b.png';

// own hosts / relative → path
assert.equal(ownUploadPath(`https://lojasschimitz.com.br/api/v1/uploads/${id}`), `/api/v1/uploads/${id}`);
assert.equal(ownUploadPath(`https://www.lojasschimitz.com.br/api/v1/uploads/${id}`), `/api/v1/uploads/${id}`);
assert.equal(ownUploadPath(`https://lojas-schimitz-production.up.railway.app/api/v1/uploads/${id}`), `/api/v1/uploads/${id}`);
assert.equal(ownUploadPath(`/api/v1/uploads/${id}`), `/api/v1/uploads/${id}`);
assert.equal(ownUploadPath(`/api/v1/uploads/${id}?v=2`), `/api/v1/uploads/${id}`);
assert.equal(ownUploadPath('/api/v1/uploads/foto.JPG'), '/api/v1/uploads/foto.JPG');

// everything else untouched
assert.equal(ownUploadPath('https://cdn.example.com/api/v1/uploads/x.png'), null);
assert.equal(ownUploadPath('//evil.com/api/v1/uploads/x.png'), null);
assert.equal(ownUploadPath('/api/v1/uploads/logo.svg'), null);
assert.equal(ownUploadPath('/api/v1/uploads/anim.gif'), null);
assert.equal(ownUploadPath('/api/v1/uploads/../secret.png'), null);
assert.equal(ownUploadPath('/api/v1/uploads/a/b.png'), null);
assert.equal(ownUploadPath('/brand/n5/simbolo.svg'), null);
assert.equal(ownUploadPath('data:image/png;base64,AAAA'), null);
assert.equal(ownUploadPath(''), null);
assert.equal(ownUploadPath(undefined), null);

// url format Next.js expects
assert.equal(nextImageUrl(`/api/v1/uploads/${id}`, 640), `/_next/image?url=%2Fapi%2Fv1%2Fuploads%2F${id}&w=640&q=75`);

// props: original src kept, srcSet added with w descriptors
const p = responsiveImageProps(`https://lojasschimitz.com.br/api/v1/uploads/${id}`, IMAGE_WIDTHS.banner);
assert.equal(p.src, `https://lojasschimitz.com.br/api/v1/uploads/${id}`);
assert.ok(p.srcSet);
assert.equal(p.srcSet!.split(', ').length, IMAGE_WIDTHS.banner.length);
assert.ok(p.srcSet!.includes('&w=640&q=75 640w'));
assert.ok(p.srcSet!.endsWith('1920w'));

// external / svg → no srcSet
assert.deepEqual(responsiveImageProps('https://cdn.example.com/x.png', IMAGE_WIDTHS.card), { src: 'https://cdn.example.com/x.png' });
assert.deepEqual(responsiveImageProps(null, IMAGE_WIDTHS.card), { src: '' });

// every preset width is one Next accepts (else /_next/image answers 400)
for (const ws of Object.values(IMAGE_WIDTHS)) for (const w of ws) assert.ok((NEXT_IMAGE_WIDTHS as readonly number[]).includes(w), `width ${w}`);
// invalid widths filtered
assert.equal(responsiveImageProps(`/api/v1/uploads/${id}`, [500]).srcSet, undefined);

// kill switch
process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZER = '1';
assert.equal(responsiveImageProps(`/api/v1/uploads/${id}`, IMAGE_WIDTHS.card).srcSet, undefined);
delete process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZER;

console.log('responsive-image.spec OK');
