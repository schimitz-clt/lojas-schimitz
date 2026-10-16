/**
 * Estorno legado POST /admin/payments/:id/refund: motivo obrigatório.
 * Usa o controller real com um PaymentsService FALSO — nenhum estorno real é executado.
 */
import 'reflect-metadata';
import assert from 'assert';
import { BadRequestException } from '@nestjs/common';
import { AdminPaymentsController, parseLegacyRefundReason } from './admin-payments.controller';

async function main() {
  const calls: Array<{ adminId: string; id: string; reason: unknown }> = [];
  const fake = {
    adminRefund: async (adminId: string, id: string, reason: unknown) => {
      calls.push({ adminId, id, reason });
      return { outcome: 'refunded', idempotent: false };
    },
  };
  const ctl = new AdminPaymentsController(fake as any);
  const res = { status: () => res } as any;

  for (const body of [{}, null, undefined, { reason: '' }, { reason: '    ' }, { reason: 'abc' }, { reason: ' a  b ' }, { reason: 123 }, { reason: ['motivo longo'] }]) {
    await assert.rejects(
      () => ctl.refund('admin-1', 'pay-1', body, res),
      (e: unknown) => e instanceof BadRequestException && (e.getResponse() as any).code === 'REASON_REQUIRED',
      JSON.stringify(body),
    );
  }
  assert.equal(calls.length, 0, 'sem motivo o serviço (Mercado Pago) NUNCA é chamado');

  const out = await ctl.refund('admin-1', 'pay-1', { reason: '  Cliente   desistiu da compra ' }, res);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].reason, 'Cliente desistiu da compra');
  assert.equal((out as any).ok, true);

  assert.equal(parseLegacyRefundReason({ reason: 'x'.repeat(900) }).length, 500);
  assert.equal(parseLegacyRefundReason({ reason: 'troca', extra: 1 }), 'troca');
  console.log('admin-refund-reason ok');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
