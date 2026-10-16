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

import { execHealthValue, execPriorityList, execSeverityLabel } from './admin-exec-dashboard';
{
  const r = execPriorityList(
    [
      { code: 'a', severity: 'info', count: 9 },
      { code: 'b', severity: 'critical', count: 1 },
      { code: 'c', severity: 'warn', count: 5 },
      { code: 'd', severity: 'warn', count: 7 },
    ],
    3,
  );
  if (r.items.map((x) => x.code).join() !== 'b,d,c' || r.hidden !== 1) throw new Error('prioridade');
  if (execPriorityList(null).items.length !== 0) throw new Error('vazio');
  if (execSeverityLabel('critical') !== 'Crítico') throw new Error('rótulo');
  if (execHealthValue(null) !== '—' || execHealthValue(0) !== '0') throw new Error('saúde');
  console.log('admin-exec-dashboard prioridades: PASSOU');
}
