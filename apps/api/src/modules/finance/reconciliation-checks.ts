/**
 * Reconciliation checks (pure). Input: snapshots of order, local payment, provider payment, ledger,
 * refunds and stock. Output: discrepancy candidates (the service persists them by dedupeKey).
 */
import { MONEY_RECEIVED_STATES, currentPaymentState, type PaymentState } from './payment-state-machine';
import type { Severity } from './financial-recorder.service';

export type DiscrepancyCandidate = {
  type: string;
  severity: Severity;
  dedupeKey: string;
  message: string;
  orderId?: string | null;
  paymentId?: string | null;
  externalId?: string | null;
  expected?: string | null;
  actual?: string | null;
  details?: Record<string, unknown>;
  /** Safe automatic repair available: re-apply the provider status through the normal webhook path. */
  repair?: 'REPROCESS_PAYMENT' | 'BACKFILL_CAPTURE' | 'REFRESH_REFUND';
};

export type PaymentSnapshot = {
  id: string;
  orderId: string;
  status: string;
  financialState: string | null;
  externalId: string | null;
  amount: number;
  method: string;
  updatedAt: Date;
};

export type ProviderSnapshot = {
  status: string; // domain status (approved/pending/refused/...)
  rawStatus?: string | null;
  statusDetail?: string | null;
  amount: number;
  refundedAmount?: number | null;
  refunds?: { refundId: string; status: string; amount: number }[] | null;
  externalReference?: string | null;
} | null;

export type LedgerSnapshot = { captured: number; refunded: number; chargebackLost: number; hasCapture: boolean };

export type RefundSnapshot = { id: string; status: string; amount: number; updatedAt: Date };

export type OrderSnapshot = {
  id: string;
  publicId: string;
  status: string;
  total: number;
  reservationExpiresAt: Date | null;
};

const EPS = 0.009;
const money = (n: unknown) => Math.round(Number(n || 0) * 100) / 100;
const POST_PAID = ['paid', 'organizing', 'packing', 'ready_for_pickup', 'in_transit', 'delivered', 'separating', 'shipped'];

export function checkPayment(input: {
  payment: PaymentSnapshot;
  order: OrderSnapshot | null;
  provider: ProviderSnapshot;
  ledger: LedgerSnapshot;
  refunds: RefundSnapshot[];
  now: Date;
}): DiscrepancyCandidate[] {
  const { payment: p, order: o, provider: m, ledger: l } = input;
  const out: DiscrepancyCandidate[] = [];
  const state: PaymentState = currentPaymentState(p);
  const base = { orderId: p.orderId, paymentId: p.id, externalId: p.externalId };

  // C1 — local vs provider status
  if (m) {
    if (m.status === 'approved' && p.status === 'pending') {
      out.push({ ...base, type: 'APPROVED_NOT_APPLIED', severity: 'HIGH', dedupeKey: `APPROVED_NOT_APPLIED:${p.id}`,
        message: 'Mercado Pago aprovou, mas o pagamento local segue pendente (webhook perdido/atrasado).',
        expected: 'approved', actual: 'pending', repair: 'REPROCESS_PAYMENT' });
    } else if (['refused', 'cancelled', 'expired'].includes(m.status) && p.status === 'pending') {
      out.push({ ...base, type: 'PENDING_STALE', severity: 'MEDIUM', dedupeKey: `PENDING_STALE:${p.id}`,
        message: `Provedor já está em ${m.status}; local ainda pendente.`, expected: m.status, actual: 'pending', repair: 'REPROCESS_PAYMENT' });
    } else if (m.status === 'refunded' && p.status === 'approved') {
      out.push({ ...base, type: 'REFUND_NOT_APPLIED', severity: 'HIGH', dedupeKey: `REFUND_NOT_APPLIED:${p.id}`,
        message: 'Estornado no Mercado Pago, mas aprovado localmente.', expected: 'refunded', actual: 'approved', repair: 'REPROCESS_PAYMENT' });
    } else if (p.status === 'approved' && ['pending', 'refused', 'cancelled', 'expired'].includes(m.status)) {
      out.push({ ...base, type: 'LOCAL_APPROVED_PROVIDER_NOT', severity: 'CRITICAL', dedupeKey: `LOCAL_APPROVED_PROVIDER_NOT:${p.id}`,
        message: `Aprovado localmente, mas o Mercado Pago reporta ${m.status}. Não enviar mercadoria sem conferir.`, expected: 'approved', actual: m.status });
    }
    // C2 — amount (only where money moved)
    if ((m.status === 'approved' || p.status === 'approved') && Math.abs(money(m.amount) - money(p.amount)) > EPS) {
      out.push({ ...base, type: 'AMOUNT_MISMATCH', severity: 'CRITICAL', dedupeKey: `AMOUNT_MISMATCH:${p.id}`,
        message: `Valor no provedor (R$ ${money(m.amount).toFixed(2)}) ≠ valor local (R$ ${money(p.amount).toFixed(2)}).`,
        expected: money(p.amount).toFixed(2), actual: money(m.amount).toFixed(2) });
    }
    // C6 — refunds vs provider
    if (m.refundedAmount != null) {
      if (Math.abs(money(m.refundedAmount) - l.refunded) > EPS && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK_WON'].includes(state)) {
        out.push({ ...base, type: 'REFUND_AMOUNT_MISMATCH', severity: 'HIGH', dedupeKey: `REFUND_AMOUNT_MISMATCH:${p.id}`,
          message: `Estornado no provedor R$ ${money(m.refundedAmount).toFixed(2)} ≠ ledger R$ ${l.refunded.toFixed(2)}.`,
          expected: money(m.refundedAmount).toFixed(2), actual: l.refunded.toFixed(2), repair: 'REPROCESS_PAYMENT' });
      }
    }
  }

  // C3 — approved payment vs order state
  if (p.status === 'approved' && o) {
    if (o.status === 'awaiting_payment') {
      out.push({ ...base, type: 'APPROVED_ORDER_NOT_PAID', severity: 'CRITICAL', dedupeKey: `APPROVED_ORDER_NOT_PAID:${p.id}`,
        message: `Pagamento aprovado e pedido ${o.publicId} ainda aguardando pagamento (confirmação não concluída).`,
        expected: 'paid', actual: o.status, repair: 'REPROCESS_PAYMENT' });
    } else if (o.status === 'cancelled') {
      out.push({ ...base, type: 'APPROVED_ON_CANCELLED_ORDER', severity: 'CRITICAL', dedupeKey: `APPROVED_ON_CANCELLED_ORDER:${p.id}`,
        message: `Pagamento aprovado em pedido cancelado ${o.publicId}: devolver o dinheiro ou reativar manualmente.`,
        expected: 'refunded', actual: 'approved' });
    }
  }

  // C4/C5 — ledger
  if ((MONEY_RECEIVED_STATES as readonly string[]).includes(state) || state === 'REFUNDED' || state === 'CHARGEBACK_LOST') {
    if (!l.hasCapture) {
      out.push({ ...base, type: 'LEDGER_MISSING_CAPTURE', severity: 'MEDIUM', dedupeKey: `LEDGER_MISSING_CAPTURE:${p.id}`,
        message: 'Pagamento recebido sem lançamento PAYMENT_CAPTURED no ledger.', expected: 'PAYMENT_CAPTURED', actual: 'none', repair: 'BACKFILL_CAPTURE' });
    } else {
      const expectedNet = state === 'REFUNDED' ? 0 : money(p.amount - l.refunded - l.chargebackLost);
      const net = money(l.captured - l.refunded - l.chargebackLost);
      if (Math.abs(l.captured - money(p.amount)) > EPS || Math.abs(net - expectedNet) > EPS) {
        out.push({ ...base, type: 'LEDGER_BALANCE_MISMATCH', severity: 'HIGH', dedupeKey: `LEDGER_BALANCE_MISMATCH:${p.id}`,
          message: `Ledger captura R$ ${l.captured.toFixed(2)} / líquido R$ ${net.toFixed(2)} não bate com o pagamento (R$ ${money(p.amount).toFixed(2)}, estado ${state}).`,
          expected: expectedNet.toFixed(2), actual: net.toFixed(2) });
      }
    }
  }

  // C7 — stuck refunds
  for (const r of input.refunds) {
    const ageMin = (input.now.getTime() - r.updatedAt.getTime()) / 60_000;
    if (r.status === 'UNKNOWN' || ((r.status === 'PROCESSING' || r.status === 'REQUESTED') && ageMin > 30)) {
      out.push({ ...base, type: 'REFUND_STUCK', severity: 'HIGH', dedupeKey: `REFUND_STUCK:${r.id}`,
        message: `Estorno ${r.id} em ${r.status} há ${Math.round(ageMin)} min.`, expected: 'COMPLETED', actual: r.status,
        details: { refundId: r.id }, repair: r.status === 'PROCESSING' ? 'REFRESH_REFUND' : undefined });
    }
  }
  return out;
}

export function checkOrder(input: {
  order: OrderSnapshot;
  payments: { id: string; status: string }[];
  movements: { orderItemId: string; kind: string }[];
  itemIds: string[];
  now: Date;
  expiryGraceMs: number;
}): DiscrepancyCandidate[] {
  const { order: o } = input;
  const out: DiscrepancyCandidate[] = [];
  const approved = input.payments.filter((p) => p.status === 'approved');
  const hasMoney = input.payments.some((p) => p.status === 'approved' || p.status === 'refunded');

  if (approved.length > 1) {
    out.push({ type: 'DOUBLE_PAYMENT', severity: 'CRITICAL', dedupeKey: `DOUBLE_PAYMENT:${o.id}`, orderId: o.id,
      message: `Pedido ${o.publicId} tem ${approved.length} pagamentos aprovados (cobrança em duplicidade).`,
      expected: '1', actual: String(approved.length), details: { paymentIds: approved.map((p) => p.id) } });
  }
  if (POST_PAID.includes(o.status) && !hasMoney) {
    out.push({ type: 'ORDER_PAID_WITHOUT_PAYMENT', severity: 'CRITICAL', dedupeKey: `ORDER_PAID_WITHOUT_PAYMENT:${o.id}`, orderId: o.id,
      message: `Pedido ${o.publicId} está em ${o.status} sem pagamento aprovado registrado.`, expected: 'approved_payment', actual: 'none' });
  }
  if (o.status === 'awaiting_payment' && o.reservationExpiresAt && !input.payments.some((p) => p.status === 'pending' || p.status === 'approved')) {
    if (input.now.getTime() > o.reservationExpiresAt.getTime() + input.expiryGraceMs) {
      out.push({ type: 'RESERVATION_WITHOUT_PAYMENT', severity: 'MEDIUM', dedupeKey: `RESERVATION_WITHOUT_PAYMENT:${o.id}`, orderId: o.id,
        message: `Pedido ${o.publicId} segura estoque reservado sem pagamento ativo (reserva vencida).`, expected: 'released', actual: 'reserved' });
    }
  }
  // C11 — journaled orders: paid-like must have COMMIT for each RESERVE; cancelled must have RELEASE.
  const kinds = (itemId: string) => input.movements.filter((m) => m.orderItemId === itemId).map((m) => m.kind);
  const journaled = input.itemIds.filter((id) => kinds(id).includes('RESERVE'));
  if (journaled.length) {
    if (POST_PAID.includes(o.status) || o.status === 'refunded') {
      const missing = journaled.filter((id) => !kinds(id).includes('COMMIT'));
      if (missing.length) {
        out.push({ type: 'STOCK_NOT_COMMITTED', severity: 'HIGH', dedupeKey: `STOCK_NOT_COMMITTED:${o.id}`, orderId: o.id,
          message: `Pedido ${o.publicId} pago sem baixa de estoque registrada para ${missing.length} item(ns).`, details: { orderItemIds: missing } });
      }
    }
    if (o.status === 'cancelled') {
      const missing = journaled.filter((id) => !kinds(id).includes('RELEASE') && !kinds(id).includes('COMMIT'));
      if (missing.length) {
        out.push({ type: 'STOCK_NOT_RELEASED', severity: 'HIGH', dedupeKey: `STOCK_NOT_RELEASED:${o.id}`, orderId: o.id,
          message: `Pedido ${o.publicId} cancelado sem liberação de reserva registrada.`, details: { orderItemIds: missing } });
      }
    }
    for (const id of journaled) {
      const k = kinds(id);
      if (k.includes('COMMIT') && k.includes('RELEASE')) {
        out.push({ type: 'STOCK_COMMIT_AND_RELEASE', severity: 'CRITICAL', dedupeKey: `STOCK_COMMIT_AND_RELEASE:${id}`, orderId: o.id,
          message: `Item ${id} do pedido ${o.publicId} foi baixado E liberado (dupla contagem de estoque).` });
      }
    }
  }
  return out;
}

export function checkInventory(rows: { productId: string; sku: string; qtyOnHand: number; qtyReserved: number; reservedByOpenOrders: number }[]): DiscrepancyCandidate[] {
  const out: DiscrepancyCandidate[] = [];
  for (const r of rows) {
    if (r.qtyOnHand < 0 || r.qtyReserved < 0 || r.qtyReserved > r.qtyOnHand) {
      out.push({ type: 'STOCK_INVALID', severity: 'CRITICAL', dedupeKey: `STOCK_INVALID:${r.productId}`,
        message: `Estoque inválido ${r.sku}: onHand=${r.qtyOnHand} reserved=${r.qtyReserved}.`, details: { productId: r.productId } });
    }
    if (r.qtyReserved !== r.reservedByOpenOrders) {
      out.push({ type: 'STOCK_RESERVED_DRIFT', severity: 'HIGH', dedupeKey: `STOCK_RESERVED_DRIFT:${r.productId}`,
        message: `Reserva de ${r.sku} = ${r.qtyReserved}, mas pedidos aguardando pagamento somam ${r.reservedByOpenOrders}.`,
        expected: String(r.reservedByOpenOrders), actual: String(r.qtyReserved), details: { productId: r.productId } });
    }
  }
  return out;
}
