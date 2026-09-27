import { structuredLog } from '../../common/structured-log';
import { fcmTokenFingerprint } from './push-token.rules';

/**
 * Automatic cleanup of dead FCM tokens (soft, reversible).
 * When FCM reports a token as permanently invalid, the row gets `enabled=false` so no campaign,
 * test or product-recovery push retries it. Nothing is deleted: the failed PushDispatch /
 * AbandonedViewPush row keeps the error + tokenId for audit, and re-enabling is just `enabled=true`.
 * If the app registers the same token again (POST /push/tokens), the upsert turns it back on,
 * as Firebase recommends. A still-dead token then fails once more and is switched off again.
 */
export type DeadTokenHit = { id: string; token: string; errorCode?: string | null };
export type DeadTokenSource = 'campaign' | 'campaign_test' | 'abandoned_view';

type DeviceTokenStore = {
  deviceFcmToken: {
    updateMany: (args: {
      where: { id: { in: string[] }; enabled: boolean };
      data: { enabled: boolean };
    }) => Promise<{ count: number }>;
  };
};

export function summarizeDeadTokens(hits: DeadTokenHit[]) {
  const byId = new Map<string, DeadTokenHit>();
  for (const h of hits) if (h?.id && !byId.has(h.id)) byId.set(h.id, h);
  const unique = [...byId.values()];
  const reasons: Record<string, number> = {};
  for (const h of unique) {
    const k = String(h.errorCode || 'unknown').slice(0, 80);
    reasons[k] = (reasons[k] || 0) + 1;
  }
  return {
    ids: unique.map((h) => h.id),
    reasons,
    fingerprints: unique.slice(0, 20).map((h) => fcmTokenFingerprint(h.token)),
  };
}

/** Returns how many rows actually switched from enabled → disabled (idempotent). */
export async function deactivateDeadTokens(
  prisma: DeviceTokenStore,
  hits: DeadTokenHit[],
  source: DeadTokenSource,
): Promise<number> {
  const s = summarizeDeadTokens(hits);
  if (!s.ids.length) return 0;
  const res = await prisma.deviceFcmToken.updateMany({
    where: { id: { in: s.ids }, enabled: true },
    data: { enabled: false },
  });
  structuredLog('info', 'PUSH_TOKEN_DEACTIVATED', {
    source,
    count: res.count,
    candidates: s.ids.length,
    reasons: s.reasons,
    fingerprints: s.fingerprints,
  });
  return res.count;
}
