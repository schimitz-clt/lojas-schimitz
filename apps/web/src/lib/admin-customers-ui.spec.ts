import assert from 'assert';
import {
  buildAdminCustomerHref,
  buildAdminPedidoHref,
  customerHistoryEmptyMessage,
  customerIdFromSearch,
  customerOrderPaymentLabel,
  customerOrdersEmptyMessage,
  customerVerClienteLabel,
  formatAdminDate,
  formatCep,
  formatCustomerAddressLine,
  formatCustomerCityUf,
  isAdminRecordId,
  orderIdFromSearch,
  pickPrimaryCustomerAddress,
} from './admin-customers-ui';

const ID = '11111111-1111-4111-8111-111111111111';
const ORDER = '22222222-2222-4222-8222-222222222222';

assert.equal(isAdminRecordId(ID), true);
assert.equal(isAdminRecordId('not-a-uuid'), false);
assert.equal(isAdminRecordId(''), false);

assert.equal(customerIdFromSearch(null), null);
assert.equal(customerIdFromSearch('?section=clientes'), null);
assert.equal(customerIdFromSearch(`?section=clientes&customer=${ID}`), ID);
assert.equal(customerIdFromSearch(`section=clientes&cliente=${ID}`), ID);
assert.equal(customerIdFromSearch('?customer=abc'), null);

assert.equal(orderIdFromSearch(`?section=pedidos&order=${ORDER}`), ORDER);
assert.equal(orderIdFromSearch(`?pedido=${ORDER}`), ORDER);
assert.equal(orderIdFromSearch('?order=SCH-1'), null);

assert.equal(buildAdminCustomerHref(), '/admin?section=clientes');
assert.equal(buildAdminCustomerHref('nope'), '/admin?section=clientes');
{
  const href = buildAdminCustomerHref(ID);
  const qs = new URLSearchParams(href.split('?')[1] || '');
  assert.equal(qs.get('section'), 'clientes');
  assert.equal(qs.get('customer'), ID);
}
assert.equal(buildAdminPedidoHref(), '/admin?section=pedidos');
{
  const href = buildAdminPedidoHref(ORDER);
  const qs = new URLSearchParams(href.split('?')[1] || '');
  assert.equal(qs.get('section'), 'pedidos');
  assert.equal(qs.get('order'), ORDER);
}

assert.equal(formatCep('90000000'), '90000-000');
assert.equal(formatCep('90000-000'), '90000-000');
assert.equal(formatCep('123'), '123');

assert.equal(formatCustomerCityUf({ city: 'Porto Alegre', uf: 'RS' }), 'Porto Alegre/RS');
assert.equal(formatCustomerCityUf({ city: 'POA' }), 'POA');
assert.equal(formatCustomerCityUf(null), '');

assert.equal(
  formatCustomerAddressLine({
    street: 'Rua A',
    number: '10',
    complement: 'Ap 2',
    district: 'Centro',
    city: 'Porto Alegre',
    uf: 'RS',
    cep: '90000000',
  }),
  'Rua A, 10 — Ap 2 · Centro — Porto Alegre/RS — CEP 90000-000',
);
assert.equal(formatCustomerAddressLine(null), '');

assert.equal(
  pickPrimaryCustomerAddress([{ id: 1, isDefault: false }, { id: 2, isDefault: true }])?.id,
  2,
);
assert.equal(pickPrimaryCustomerAddress([{ id: 9 }])?.id, 9);
assert.equal(pickPrimaryCustomerAddress([]), null);

assert.equal(customerOrderPaymentLabel('pix'), 'PIX');
assert.equal(customerOrderPaymentLabel('card'), 'Cartão');
assert.equal(customerOrderPaymentLabel('credit_card'), 'Cartão');
assert.equal(customerOrderPaymentLabel('boleto'), 'Boleto');
assert.equal(customerOrderPaymentLabel('wallet'), 'Carteira');
assert.equal(customerOrderPaymentLabel(null), '—');
assert.equal(customerOrderPaymentLabel(''), '—');

assert.equal(formatAdminDate(null), '—');
assert.equal(formatAdminDate('not-a-date'), '—');

assert.equal(customerHistoryEmptyMessage(true), 'Nenhum cliente encontrado para essa busca.');
assert.equal(customerHistoryEmptyMessage(false), 'Nenhum cliente cadastrado.');
assert.equal(customerOrdersEmptyMessage(), 'Sem pedidos neste cliente.');
assert.equal(customerVerClienteLabel(true), 'Ver cliente');
assert.equal(customerVerClienteLabel(false), 'Cliente sem cadastro');

console.log('admin-customers-ui web unit ok');
