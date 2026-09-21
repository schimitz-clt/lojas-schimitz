/**
 * Abandoned PDP-view push — pure rules.
 * Delay slides with lastViewedAt. Caps and purchase checks never invent a device.
 */

import { pixChargeAmount } from '../../common/pricing';
import { mapPushDeepLink } from './push-deeplink';
import { PUSH_BODY_MAX, PUSH_TITLE_MAX } from './push-campaign.rules';

export const ABANDONED_VIEW_TZ = 'America/Sao_Paulo';
export const ABANDONED_VIEW_DEFAULT_DELAY_HOURS = 2;
export const ABANDONED_VIEW_DEFAULT_MAX_AGE_HOURS = 48;
export const ABANDONED_VIEW_MIN_DELAY_MS = 60_000;
export const ABANDONED_VIEW_PRODUCT_CAP_MS = 7 * 24 * 60 * 60 * 1000;
export const PUSH_DEVICE_COOKIE = 'sch_push_device';
export const ABANDONED_VIEW_KIND = 'abandoned_product_view';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPushDeviceId(raw: unknown): raw is string {
  return typeof raw === 'string' && UUID_RE.test(raw.trim());
}

export function normalizePushDeviceId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  return UUID_RE.test(id) ? id : null;
}

/** Cookie `sch_push_device` is a DeviceFcmToken id, never the FCM token and never an auth cookie. */
export function readPushDeviceCookie(header: string | string[] | undefined): string | null {
  const raw = Array.isArray(header) ? header.join(';') : String(header ?? '');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (name !== PUSH_DEVICE_COOKIE) continue;
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

function positiveHours(raw: string, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/** Default 2 hours. Staging may set a fraction (minimum 1 minute). Invalid values stay at 2h. */
export function abandonedViewDelayMs(env: NodeJS.ProcessEnv = process.env): number {
  const hours = positiveHours(
    String(env.ABANDONED_VIEW_DELAY_HOURS ?? '').trim(),
    ABANDONED_VIEW_DEFAULT_DELAY_HOURS,
  );
  return Math.max(ABANDONED_VIEW_MIN_DELAY_MS, Math.round(hours * 60 * 60 * 1000));
}

export function abandonedViewDelayHours(env: NodeJS.ProcessEnv = process.env): number {
  return abandonedViewDelayMs(env) / (60 * 60 * 1000);
}

/** Views older than this are closed without sending (default 48h, always at least delay + 1h). */
export function abandonedViewMaxAgeMs(
  env: NodeJS.ProcessEnv = process.env,
  delayMs = abandonedViewDelayMs(env),
): number {
  const hours = positiveHours(
    String(env.ABANDONED_VIEW_MAX_AGE_HOURS ?? '').trim(),
    ABANDONED_VIEW_DEFAULT_MAX_AGE_HOURS,
  );
  const ms = Math.round(hours * 60 * 60 * 1000);
  return Math.max(ms, delayMs + 60 * 60 * 1000);
}

/** Calendar date in America/Sao_Paulo (YYYY-MM-DD). Brazil has no DST; UTC-3 fallback. */
export function saoPauloDayKey(date: Date): string {
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: ABANDONED_VIEW_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted;
  } catch {
    /* fallback below */
  }
  const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function isSameSaoPauloDay(a: Date, b: Date): boolean {
  return saoPauloDayKey(a) === saoPauloDayKey(b);
}

/** 00:00 of the next calendar day in America/Sao_Paulo (fixed UTC−3). */
export function nextSaoPauloMidnight(now: Date): Date {
  const [y, m, d] = saoPauloDayKey(now).split('-').map((n) => Number(n));
  return new Date(Date.UTC(y, m - 1, d + 1, 3, 0, 0, 0));
}

/** True when a successful push for this device+product is still inside the 7-day window. */
export function withinProductCap(lastSentAt: Date | null, now: Date): boolean {
  if (!lastSentAt) return false;
  return now.getTime() - lastSentAt.getTime() < ABANDONED_VIEW_PRODUCT_CAP_MS;
}

/** True when this device already got an abandoned-view push on the same São Paulo calendar day. */
export function withinDeviceDayCap(lastSentAt: Date | null, now: Date): boolean {
  if (!lastSentAt) return false;
  return isSameSaoPauloDay(lastSentAt, now);
}

/**
 * Real order that should suppress the push.
 * draft / cancelled do not count unless a payment was approved (checked separately).
 */
export function orderQualifiesAsPostViewPurchase(status: string): boolean {
  const s = String(status || '').trim();
  if (!s || s === 'draft' || s === 'cancelled') return false;
  return true;
}

/** Logged-in viewer and/or the device's current user. Empty = cannot prove a purchase. */
export function purchaseUserIds(
  viewUserId: string | null | undefined,
  deviceUserId: string | null | undefined,
): string[] {
  const ids: string[] = [];
  for (const raw of [viewUserId, deviceUserId]) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function formatBrl(amount: number): string {
  const n = Math.round((Number(amount) || 0) * 100) / 100;
  const negative = n < 0;
  const [ints, dec] = Math.abs(n).toFixed(2).split('.');
  const withDots = ints.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}R$ ${withDots},${dec}`;
}

export function clipPushText(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  if (max <= 1) return t.slice(0, Math.max(0, max));
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export type AbandonedViewMessage = {
  title: string;
  body: string;
  linkPath: string;
  linkUrl: string;
  pixLabel: string;
};

export function abandonedProductLink(slug: string): { path: string; url: string } | null {
  const s = String(slug || '').trim();
  if (!s || s.length > 180 || /[\s/?#\\]/.test(s) || s.includes('..')) return null;
  const mapped = mapPushDeepLink(`/produto/${encodeURIComponent(s)}`);
  if (!mapped.ok || !mapped.url) return null;
  return { path: mapped.path, url: mapped.url };
}

/**
 * PT-BR title + body. Name + PIX price + invite. Specs only when they already fit the body cap.
 */
export function abandonedViewMessage(opts: {
  productName: string;
  listPrice: number;
  slug: string;
}): AbandonedViewMessage | null {
  const link = abandonedProductLink(opts.slug);
  if (!link) return null;
  const name = String(opts.productName || '').replace(/\s+/g, ' ').trim() || 'produto';
  const pix = pixChargeAmount(Number(opts.listPrice) || 0);
  const pixLabel = formatBrl(pix);
  const title = clipPushText(`Vem comprar ${name}`, PUSH_TITLE_MAX);
  const suffix = '. Estamos aguardando. Lojas Schimitz agradece.';
  const priceBit = ` por ${pixLabel} no PIX`;
  const prefix = 'Vem comprar seu produto ';
  const budget = PUSH_BODY_MAX - prefix.length - priceBit.length - suffix.length;
  const shortName =
    name.length > budget
      ? `${name.slice(0, Math.max(1, budget - 1)).trimEnd()}…`
      : name;
  const body = clipPushText(`${prefix}${shortName}${priceBit}${suffix}`, PUSH_BODY_MAX);
  if (!title || !body) return null;
  return { title, body, linkPath: link.path, linkUrl: link.url, pixLabel };
}

export type AbandonedViewFacts = {
  now: Date;
  lastViewedAt: Date;
  handledViewAt: Date | null;
  delayMs: number;
  maxAgeMs: number;
  deviceEnabled: boolean;
  productActive: boolean;
  availableQty: number;
  purchasedAfterView: boolean;
  lastProductPushAt: Date | null;
  lastDevicePushAt: Date | null;
  firebaseConfigured: boolean;
};

export type AbandonedViewAction =
  | { action: 'send' }
  | {
      action: 'close';
      reason: 'already_handled' | 'stale' | 'device_disabled' | 'unavailable' | 'purchased';
    }
  | { action: 'wait'; reason: 'not_due' }
  | { action: 'wait'; reason: 'product_cap' | 'device_day_cap'; deferUntil: Date }
  | { action: 'defer'; reason: 'firebase_not_configured' };

/**
 * One decision per view snapshot. A newer lastViewedAt (after handledViewAt) is a new cycle.
 * Firebase missing defers the send and does not burn the 7-day / daily caps.
 */
export function decideAbandonedView(facts: AbandonedViewFacts): AbandonedViewAction {
  if (
    facts.handledViewAt &&
    facts.handledViewAt.getTime() >= facts.lastViewedAt.getTime()
  ) {
    return { action: 'close', reason: 'already_handled' };
  }
  const age = facts.now.getTime() - facts.lastViewedAt.getTime();
  if (age > facts.maxAgeMs) return { action: 'close', reason: 'stale' };
  if (age < facts.delayMs) return { action: 'wait', reason: 'not_due' };
  if (!facts.deviceEnabled) return { action: 'close', reason: 'device_disabled' };
  if (!facts.productActive || facts.availableQty <= 0) {
    return { action: 'close', reason: 'unavailable' };
  }
  if (facts.purchasedAfterView) return { action: 'close', reason: 'purchased' };
  if (facts.lastProductPushAt && withinProductCap(facts.lastProductPushAt, facts.now)) {
    return {
      action: 'wait',
      reason: 'product_cap',
      deferUntil: new Date(facts.lastProductPushAt.getTime() + ABANDONED_VIEW_PRODUCT_CAP_MS),
    };
  }
  if (withinDeviceDayCap(facts.lastDevicePushAt, facts.now)) {
    return {
      action: 'wait',
      reason: 'device_day_cap',
      deferUntil: nextSaoPauloMidnight(facts.now),
    };
  }
  if (!facts.firebaseConfigured) return { action: 'defer', reason: 'firebase_not_configured' };
  return { action: 'send' };
}

export function abandonedViewAdminNote(delayHours: number): string {
  const hoursLabel = Number.isInteger(delayHours)
    ? String(delayHours)
    : delayHours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return (
    `Recuperação de produto é automática: quem viu um produto no app (aparelho com push) e não comprou ` +
    `recebe um único aviso cerca de ${hoursLabel}h depois da última visita. ` +
    `Limite: 1 por produto a cada 7 dias e 1 por aparelho por dia (horário de Brasília). ` +
    `Esta tela não dispara essa mensagem.`
  );
}
