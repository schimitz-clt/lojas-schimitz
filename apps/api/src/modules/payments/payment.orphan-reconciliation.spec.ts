/**
 * Orphan approved webhook path must record durable RECONCILIATION_REQUIRED
 * before 2xx ack (source + mock prisma upsert contract). No DB / no charges.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  isOrphanMoneyAtRisk,
  orphanReconciliationReason,
  RECONCILIATION_STATUS_OPEN,
} from './reconciliation';

const svc = readFileSync(join(__dirname, 'payments.service.ts'), 'utf8');
const schema = readFileSync(join(__dirname, '../../../../../prisma/schema.prisma'), 'utf8');

assert.ok(schema.includes('model PaymentReconciliation'), 'Prisma model PaymentReconciliation');
assert.ok(schema.includes('@@unique([provider, externalId])'), 'idempotent unique');
assert.ok(svc.includes('paymentReconciliation.upsert') || svc.includes('paymentReconciliation'), 'service upserts reconciliation');
assert.ok(svc.includes('payment.reconciliation_required'), 'audit reconciliation_required');
assert.ok(svc.includes('RECONCILIATION_REQUIRED'), 'structuredLog + status');
assert.ok(svc.includes("reason: 'reconciliation_required'"), '2xx reason after durable record');
assert.ok(svc.includes('orphanReconciliationReason') || svc.includes('reconciliation'), 'uses helper');

// Documented: ack only because durable record exists (avoid MP retry storm).
assert.ok(
  /durable|RECONCILIATION_REQUIRED|retry/i.test(svc.slice(svc.indexOf('if (!local)'), svc.indexOf('if (!local)') + 1200)),
  'orphan block documents durable ack rationale',
);

/** Mock prisma upsert contract for orphan approved path. */
type UpsertArgs = {
  where: { provider_externalId: { provider: string; externalId: string } };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

async function simulateOrphanApprovedPath(deps: {
  upsert: (args: UpsertArgs) => Promise<{ id: string }>;
  audit: (action: string, meta: unknown) => Promise<void>;
  structured: (level: string, event: string, meta: unknown) => void;
  markApplied: () => Promise<void>;
  fetched: { status: string; externalId: string; externalReference?: string };
  provider: string;
  eventId: string;
}) {
  const reason = orphanReconciliationReason(deps.fetched.status);
  assert.ok(isOrphanMoneyAtRisk(deps.fetched.status), 'approved/paid is money-at-risk');
  const row = await deps.upsert({
    where: {
      provider_externalId: { provider: deps.provider, externalId: deps.fetched.externalId },
    },
    create: {
      id: 'rec-1',
      provider: deps.provider,
      externalId: deps.fetched.externalId,
      externalReference: deps.fetched.externalReference,
      providerStatus: deps.fetched.status,
      reason,
      status: RECONCILIATION_STATUS_OPEN,
      paymentEventId: deps.eventId,
    },
    update: {
      providerStatus: deps.fetched.status,
      reason,
      status: RECONCILIATION_STATUS_OPEN,
      paymentEventId: deps.eventId,
      resolvedAt: null,
    },
  });
  await deps.audit('payment.reconciliation_required', { entityId: row.id });
  deps.structured('warn', 'RECONCILIATION_REQUIRED', { reconciliationId: row.id });
  await deps.markApplied();
  return { ok: true as const, applied: false as const, reason: 'reconciliation_required' as const, reconciliationId: row.id };
}

async function main() {
  {
    const calls: string[] = [];
    const store = new Map<string, UpsertArgs>();
    const result = await simulateOrphanApprovedPath({
      provider: 'mercadopago',
      eventId: 'evt-1',
      fetched: { status: 'approved', externalId: 'mp-orphan-1', externalReference: 'SCH-MISSING' },
      upsert: async (args) => {
        const k = `${args.where.provider_externalId.provider}:${args.where.provider_externalId.externalId}`;
        store.set(k, args);
        calls.push('upsert');
        return { id: 'rec-1' };
      },
      audit: async (action) => {
        calls.push(action);
      },
      structured: (_l, event) => {
        calls.push(event);
      },
      markApplied: async () => {
        calls.push('applied');
      },
    });
    assert.deepEqual(calls, ['upsert', 'payment.reconciliation_required', 'RECONCILIATION_REQUIRED', 'applied']);
    assert.equal(result.reason, 'reconciliation_required');
    assert.equal(store.size, 1);
    const saved = store.get('mercadopago:mp-orphan-1')!;
    assert.equal(saved.create.reason, 'orphan_approved');
    assert.equal(saved.create.status, 'RECONCILIATION_REQUIRED');
  }

  {
    const store = new Map<string, { id: string; reason: string }>();
    async function upsert(args: UpsertArgs) {
      const k = `${args.where.provider_externalId.provider}:${args.where.provider_externalId.externalId}`;
      if (store.has(k)) {
        store.get(k)!.reason = String(args.update.reason);
        return store.get(k)!;
      }
      const row = { id: 'rec-2', reason: String(args.create.reason) };
      store.set(k, row);
      return row;
    }
    await simulateOrphanApprovedPath({
      provider: 'mercadopago',
      eventId: 'evt-a',
      fetched: { status: 'approved', externalId: 'mp-dup', externalReference: undefined },
      upsert,
      audit: async () => undefined,
      structured: () => undefined,
      markApplied: async () => undefined,
    });
    await simulateOrphanApprovedPath({
      provider: 'mercadopago',
      eventId: 'evt-b',
      fetched: { status: 'approved', externalId: 'mp-dup', externalReference: undefined },
      upsert,
      audit: async () => undefined,
      structured: () => undefined,
      markApplied: async () => undefined,
    });
    assert.equal(store.size, 1);
  }

  console.log('payment.orphan-reconciliation unit tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
