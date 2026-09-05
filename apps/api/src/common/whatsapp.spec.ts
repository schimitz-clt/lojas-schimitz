import assert from 'assert';
import {
  DEFAULT_STORE_WHATSAPP,
  envStoreWhatsApp,
  orderWhatsAppMessage,
  resolveOrderWhatsApp,
  storeWhatsAppDigits,
  toWhatsAppDigits,
  waMeUrl,
} from './whatsapp';

assert.equal(toWhatsAppDigits(null), null);
assert.equal(toWhatsAppDigits(''), null);
assert.equal(toWhatsAppDigits('123'), null);
assert.equal(toWhatsAppDigits('(51) 99625-3766'), '5551996253766');
assert.equal(toWhatsAppDigits('51996253766'), '5551996253766');
assert.equal(toWhatsAppDigits('5551996253766'), '5551996253766');
assert.equal(toWhatsAppDigits('+55 51 99625-3766'), '5551996253766');
assert.equal(toWhatsAppDigits('005551996253766'), '5551996253766');
assert.equal(toWhatsAppDigits('5433211234'), '555433211234');

assert.equal(storeWhatsAppDigits(undefined), DEFAULT_STORE_WHATSAPP);
assert.equal(storeWhatsAppDigits('51 99999-0000'), '5551999990000');

const url = waMeUrl('5551996253766', 'Olá pedido SCH-1');
assert.ok(url.startsWith('https://wa.me/5551996253766?text='));
assert.ok(url.includes(encodeURIComponent('Olá pedido SCH-1')));

const paidCustomer = orderWhatsAppMessage({
  kind: 'paid',
  toCustomer: true,
  publicId: 'SCH-1',
  total: 199.9,
  status: 'paid',
  customerName: 'Ana',
});
assert.ok(paidCustomer.includes('Recebemos o pagamento'));
assert.ok(paidCustomer.includes('SCH-1'));
assert.ok(paidCustomer.includes('Ana'));

const shippedCustomer = orderWhatsAppMessage({
  kind: 'shipped',
  toCustomer: true,
  publicId: 'SCH-2',
  total: 10,
  status: 'shipped',
});
assert.ok(shippedCustomer.includes('saiu para entrega'));
assert.ok(shippedCustomer.includes('SCH-2'));

const merchant = resolveOrderWhatsApp({
  kind: 'paid',
  publicId: 'SCH-3',
  total: 50,
  status: 'paid',
  customerName: 'João',
  customerPhone: null,
  storePhone: '5551996253766',
});
assert.equal(merchant.toCustomer, false);
assert.equal(merchant.digits, '5551996253766');
assert.ok(merchant.text.includes('Cliente pagou'));
assert.ok(merchant.url.includes('wa.me/5551996253766'));

const toClient = resolveOrderWhatsApp({
  kind: 'generic',
  publicId: 'SCH-4',
  total: 80,
  status: 'separating',
  customerName: 'Lia',
  customerPhone: '51988887777',
});
assert.equal(toClient.toCustomer, true);
assert.equal(toClient.digits, '5551988887777');
assert.ok(toClient.text.includes('Sobre o pedido SCH-4'));

const prevWa = process.env.NEXT_PUBLIC_WHATSAPP;
const prevPhone = process.env.WHATSAPP_PHONE;
delete process.env.NEXT_PUBLIC_WHATSAPP;
delete process.env.WHATSAPP_PHONE;
assert.equal(envStoreWhatsApp(), DEFAULT_STORE_WHATSAPP);
process.env.NEXT_PUBLIC_WHATSAPP = '51991112222';
assert.equal(envStoreWhatsApp(), '5551991112222');
if (prevWa === undefined) delete process.env.NEXT_PUBLIC_WHATSAPP;
else process.env.NEXT_PUBLIC_WHATSAPP = prevWa;
if (prevPhone === undefined) delete process.env.WHATSAPP_PHONE;
else process.env.WHATSAPP_PHONE = prevPhone;

console.log('whatsapp helpers tests ok');
