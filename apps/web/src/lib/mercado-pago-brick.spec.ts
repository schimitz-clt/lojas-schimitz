/**
 * Smoke: pedido page wires Mercado Pago Checkout Bricks (SCH-003 cartão).
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const page = readFileSync(join(__dirname, '../app/pedidos/[publicId]/page.tsx'), 'utf8');
const brick = readFileSync(join(__dirname, '../components/MercadoPagoCardBrick.tsx'), 'utf8');

assert.match(page, /MercadoPagoCardBrick/);
assert.match(page, /NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY/);
assert.match(page, /paymentMethodId/);
assert.match(page, /issuerId/);
assert.match(brick, /@mercadopago\/sdk-react/);
assert.match(brick, /CardPayment/);
assert.match(brick, /initMercadoPago/);
assert.match(brick, /formData\?\.token|formData\.token/);

console.log('mercado-pago-brick smoke ok');
