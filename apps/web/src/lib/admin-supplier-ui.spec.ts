import assert from 'assert';
import { emptySupplierForm, marginLabel, supplierFormToBody, supplierToForm } from './admin-supplier-ui';

assert.deepEqual(supplierFormToBody({ ...emptySupplierForm(), supplierName: 'A' }), { error: 'Informe o nome do fornecedor (mín. 2 letras).' });
const ok = supplierFormToBody({ ...emptySupplierForm(), supplierName: ' Forn ', costPrice: '1.234,50', leadTimeDays: '7' });
assert.ok('body' in ok);
assert.equal((ok as any).body.costPrice, 1234.5);
assert.equal((ok as any).body.leadTimeDays, 7);
assert.equal((ok as any).body.supplierSku, null);
assert.ok('error' in supplierFormToBody({ ...emptySupplierForm(), supplierName: 'Ok', costPrice: '-2' }));
assert.ok('error' in supplierFormToBody({ ...emptySupplierForm(), supplierName: 'Ok', leadTimeDays: '1.5' }));
assert.ok('error' in supplierFormToBody({ ...emptySupplierForm(), supplierName: 'Ok', supplierUrl: 'javascript:x' }));
assert.equal(supplierToForm(null).supplierName, '');
assert.equal(supplierToForm({ supplierName: 'F', supplierSku: null, supplierUrl: null, costPrice: 9.9, leadTimeDays: 3, notes: null, updatedAt: '' }).costPrice, '9,9');
assert.equal(marginLabel(null), 'Margem: sem custo cadastrado');
assert.equal(marginLabel(40), 'Margem bruta: 40%');
console.log('admin-supplier-ui: PASSOU');
