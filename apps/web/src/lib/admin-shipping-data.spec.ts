import assert from 'assert';
import { shippingDataStatusText, shippingDataTone } from './admin-shipping-data';

assert.equal(shippingDataStatusText(null), '');
assert.equal(shippingDataTone(undefined), 'none');
assert.equal(shippingDataStatusText({ activeCount: 0, missingCount: 0, missingWeightCount: 0, missingDimensionsCount: 0 }), 'Nenhum produto ativo no catálogo.');

const ok = { activeCount: 12, missingCount: 0, missingWeightCount: 0, missingDimensionsCount: 0 };
assert.equal(shippingDataStatusText(ok), 'Todos os 12 produtos ativos têm peso e medidas.');
assert.equal(shippingDataTone(ok), 'ok');
assert.equal(shippingDataStatusText({ ...ok, activeCount: 1 }), 'O único produto ativo tem peso e medidas.');

const warn = { activeCount: 40, missingCount: 7, missingWeightCount: 3, missingDimensionsCount: 5 };
const t = shippingDataStatusText(warn);
assert.ok(t.startsWith('7 produtos ativos de 40 sem peso ou medidas (3 sem peso, 5 sem alguma medida).'), t);
assert.ok(t.includes('pacote padrão'), t);
assert.ok(t.includes('valores reais'), t);
assert.equal(shippingDataTone(warn), 'warn');

const one = shippingDataStatusText({ activeCount: 2, missingCount: 1, missingWeightCount: 1, missingDimensionsCount: 0 });
assert.ok(one.startsWith('1 produto ativo de 2 sem peso ou medidas (1 sem peso).'), one);

console.log('admin-shipping-data.spec ok');
