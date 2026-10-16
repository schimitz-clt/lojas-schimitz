import assert from 'assert';
import { execPeriodLabel, execWindow, parseExecPeriod } from './admin-exec-dashboard';

assert.equal(parseExecPeriod('7d'), '7d');
assert.equal(parseExecPeriod('lixo'), 'hoje');
assert.equal(parseExecPeriod(null), 'hoje');
const sales = { today: { orderCount: 0, revenue: 0 }, last7d: { orderCount: 4, revenue: 100 }, last30d: null };
assert.deepEqual(execWindow(sales, 'hoje'), { revenue: 0, orders: 0, ticket: null }, 'zero continua zero, sem ticket inventado');
assert.deepEqual(execWindow(sales, '7d'), { revenue: 100, orders: 4, ticket: 25 });
assert.equal(execWindow(sales, '30d'), null, 'janela ausente = sem dados');
assert.equal(execWindow(null, 'hoje'), null);
assert.equal(execPeriodLabel('30d'), 'nos últimos 30 dias');
console.log('admin-exec-dashboard: PASSOU');
