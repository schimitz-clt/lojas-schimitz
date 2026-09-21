/**
 * Webhook apply disposition: PaymentEvent.applied tracks domain application.
 * Amount/reference mismatch must stay applied=false and open PaymentReconciliation.
 * No DB / no charges.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  decideWebhookEventPersistence,
  isIntegrityMismatchReason,
  RECONCILIATION_STATUS_OPEN,
} from './reconciliation';

assert.equal(isIntegrityMismatchReason('amount_mismatch'), true);
assert.equal(isIntegrityMismatchReason('reference_mismatch'), true);
assert.equal(isIntegrityMismatchReason('still_pending'), false);
assert.equal(isIntegrityMismatchReason('approved'), false);

// Successful domain apply → PaymentEvent.applied true, no reconciliation row.
{
  const d = decideWebhookEventPersistence({ applied: true, reason: 'approved' });
  assert.equal(d.markEventApplied, true);
  assert.equal(d.openReconciliation, false);
  assert.equal(d.reason, 'approved');
}

{
  const d = decideWebhookEventPersistence({ applied: true, reason: 'already_paid' });
  assert.equal(d.markEventApplied, true);
  assert.equal(d.openReconciliation, false);
}

{
  const d = decideWebhookEventPersistence({ applied: true, reason: 'expired' });
  assert.equal(d.markEventApplied, true);
  assert.equal(d.openReconciliation, false);
}

// Mismatch → not applied, admin queue opened.
for (const reason of ['amount_mismatch', 'reference_mismatch'] as const) {
  const d = decideWebhookEventPersistence({ applied: false, reason });
  assert.equal(d.markEventApplied, false, reason);
  assert.equal(d.openReconciliation, true, reason);
  assert.equal(d.reason, reason);
}

// Other non-applied outcomes stay retryable and do not pretend success or flood the queue.
for (const reason of ['still_pending', 'not_pending', 'already_terminal', 'unmapped', 'noop']) {
  const d = decideWebhookEventPersistence({ applied: false, reason });
  assert.equal(d.markEventApplied, false, reason);
  assert.equal(d.openReconciliation, false, reason);
}

type EventRow = { id: string; applied: boolean; providerEventId: string };
type ReconRow = { id: string; reason: string; status: string; externalId: string };

/**
 * Mirrors handleWebhook after applyProviderStatus + the duplicate x-request-id branch.
 * Genuinely applied events short-circuit; never-applied events retry.
 */
function deliver(input: {
  events: Map<string, EventRow>;
  recons: Map<string, ReconRow>;
  providerEventId: string;
  externalId: string;
  apply: { applied: boolean; reason: string };
}): { duplicate: boolean; applied: boolean; reason: string; reconciliationId?: string } {
  const existing = input.events.get(input.providerEventId);
  if (existing?.applied) {
    return { duplicate: true, applied: true, reason: 'duplicate_applied' };
  }
  const event =
    existing ||
    ({
      id: `evt-${input.events.size + 1}`,
      applied: false,
      providerEventId: input.providerEventId,
    } satisfies EventRow);
  input.events.set(input.providerEventId, event);

  const decision = decideWebhookEventPersistence(input.apply);
  if (!decision.markEventApplied) {
    let reconciliationId: string | undefined;
    if (decision.openReconciliation) {
      const key = input.externalId;
      const prev = input.recons.get(key);
      const row: ReconRow = {
        id: prev?.id || `rec-${input.recons.size + 1}`,
        reason: decision.reason,
        status: RECONCILIATION_STATUS_OPEN,
        externalId: input.externalId,
      };
      input.recons.set(key, row);
      reconciliationId = row.id;
    }
    return { duplicate: Boolean(existing), applied: false, reason: decision.reason, reconciliationId };
  }
  event.applied = true;
  return { duplicate: Boolean(existing), applied: true, reason: decision.reason };
}

{
  const events = new Map<string, EventRow>();
  const recons = new Map<string, ReconRow>();
  const first = deliver({
    events,
    recons,
    providerEventId: 'req-mismatch',
    externalId: 'mp-1',
    apply: { applied: false, reason: 'amount_mismatch' },
  });
  assert.equal(first.applied, false);
  assert.equal(first.reason, 'amount_mismatch');
  assert.ok(first.reconciliationId);
  assert.equal(events.get('req-mismatch')!.applied, false);
  assert.equal(recons.get('mp-1')!.reason, 'amount_mismatch');
  assert.equal(recons.get('mp-1')!.status, 'RECONCILIATION_REQUIRED');

  const dup = deliver({
    events,
    recons,
    providerEventId: 'req-mismatch',
    externalId: 'mp-1',
    apply: { applied: false, reason: 'amount_mismatch' },
  });
  assert.equal(dup.duplicate, true);
  assert.equal(dup.applied, false, 'duplicate mismatch must not short-circuit as applied');
  assert.equal(recons.size, 1, 'upsert keeps one reconciliation row');

  const recovered = deliver({
    events,
    recons,
    providerEventId: 'req-mismatch',
    externalId: 'mp-1',
    apply: { applied: true, reason: 'approved' },
  });
  assert.equal(recovered.applied, true);
  assert.equal(events.get('req-mismatch')!.applied, true);

  const after = deliver({
    events,
    recons,
    providerEventId: 'req-mismatch',
    externalId: 'mp-1',
    apply: { applied: true, reason: 'approved' },
  });
  assert.equal(after.duplicate, true);
  assert.equal(after.applied, true);
  assert.equal(after.reason, 'duplicate_applied');
}

{
  const events = new Map<string, EventRow>();
  const recons = new Map<string, ReconRow>();
  const ok = deliver({
    events,
    recons,
    providerEventId: 'req-ok',
    externalId: 'mp-2',
    apply: { applied: true, reason: 'approved' },
  });
  assert.equal(ok.applied, true);
  assert.equal(ok.reconciliationId, undefined);
  assert.equal(recons.size, 0);
  assert.equal(events.get('req-ok')!.applied, true);
}

const svc = readFileSync(join(__dirname, 'payments.service.ts'), 'utf8');
const applyAt = svc.indexOf('applyResult = await this.applyProviderStatus');
assert.ok(applyAt > 0, 'handleWebhook captures applyProviderStatus result');
const afterApply = svc.slice(applyAt, applyAt + 2200);
assert.ok(afterApply.includes('decideWebhookEventPersistence(applyResult)'), 'disposition gates PaymentEvent.applied');
assert.ok(afterApply.includes('if (!decision.markEventApplied)'), 'non-applied branch exists');
const beforeDecision = afterApply.split('decideWebhookEventPersistence')[0];
assert.equal(
  beforeDecision.includes('applied: true'),
  false,
  'event is not marked applied before the domain decision',
);
assert.ok(afterApply.includes('openIntegrityReconciliation'), 'mismatch opens PaymentReconciliation');
assert.ok(afterApply.includes('applied: false'), 'mismatch response does not claim domain apply');
const notAppliedReturn = afterApply.slice(afterApply.indexOf('if (!decision.markEventApplied)'));
const notAppliedHead = notAppliedReturn.slice(0, notAppliedReturn.indexOf('resolveIntegrityReconciliation'));
assert.equal(
  notAppliedHead.includes('data: { applied: true }'),
  false,
  'non-applied path must not persist PaymentEvent.applied=true',
);

console.log('payment.webhook-apply unit tests ok');
