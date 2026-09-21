/**
 * PDP → POST /push/product-views.
 * Only when the Android app already exposed a registered device id
 * (cookie sch_push_device or LojasSchimitz.pushDeviceId). Never invents a token.
 */

import { api } from '@/lib/api';

export const PUSH_DEVICE_COOKIE = 'sch_push_device';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PushBridge = {
  pushDeviceId?: () => string;
};

export function normalizePushDeviceId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  return UUID_RE.test(id) ? id : null;
}

export function readPushDeviceIdFromCookie(cookieHeader: string | null | undefined): string | null {
  const raw = String(cookieHeader ?? '');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() !== PUSH_DEVICE_COOKIE) continue;
    let value = part.slice(eq + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep raw */
    }
    return normalizePushDeviceId(value);
  }
  return null;
}

export function readPushDeviceIdFromBridge(bridge: PushBridge | null | undefined): string | null {
  if (!bridge || typeof bridge.pushDeviceId !== 'function') return null;
  try {
    return normalizePushDeviceId(bridge.pushDeviceId());
  } catch {
    return null;
  }
}

export function resolvePushDeviceId(opts?: {
  cookieHeader?: string | null;
  bridge?: PushBridge | null;
}): string | null {
  const fromBridge = readPushDeviceIdFromBridge(opts?.bridge);
  if (fromBridge) return fromBridge;
  return readPushDeviceIdFromCookie(opts?.cookieHeader);
}

export function buildProductViewBody(opts: {
  productId: string;
  slug: string;
  deviceId: string | null;
}): { productId: string; slug: string; deviceId: string } | null {
  const deviceId = normalizePushDeviceId(opts.deviceId);
  const productId = String(opts.productId || '').trim();
  const slug = String(opts.slug || '').trim();
  if (!deviceId || !productId || !slug) return null;
  return { productId, slug, deviceId };
}

function browserBridge(): PushBridge | null {
  if (typeof window === 'undefined') return null;
  const host = window as unknown as { LojasSchimitz?: PushBridge };
  return host.LojasSchimitz ?? null;
}

/** Best-effort. No device id → no request. Failures never surface on the PDP. */
export function recordAbandonedProductView(product: { id: string; slug: string }): void {
  if (typeof window === 'undefined') return;
  const send = () => {
    const deviceId = resolvePushDeviceId({
      cookieHeader: document.cookie,
      bridge: browserBridge(),
    });
    const body = buildProductViewBody({
      productId: product.id,
      slug: product.slug,
      deviceId,
    });
    if (!body) return false;
    void api('/push/product-views', {
      method: 'POST',
      body: JSON.stringify(body),
    }).catch(() => undefined);
    return true;
  };
  if (send()) return;
  window.setTimeout(() => {
    send();
  }, 2500);
}
