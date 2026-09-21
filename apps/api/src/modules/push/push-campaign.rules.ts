/**
 * Promotional push campaign validation + audience targeting — pure.
 */

import { mapPushDeepLink } from './push-deeplink';

export const PUSH_TITLE_MAX = 80;
export const PUSH_BODY_MAX = 240;
export const PUSH_IMAGE_URL_MAX = 2000;
export const FCM_MULTICAST_LIMIT = 500;

export const PUSH_AUDIENCES = ['all_enabled', 'with_orders'] as const;
export type PushAudienceId = (typeof PUSH_AUDIENCES)[number];

export const PUSH_SEND_MODES = ['immediate', 'scheduled'] as const;
export type PushSendMode = (typeof PUSH_SEND_MODES)[number];

export type CampaignDraftInput = {
  title?: unknown;
  body?: unknown;
  imageUrl?: unknown;
  linkPath?: unknown;
  audience?: unknown;
  sendMode?: unknown;
  scheduledAt?: unknown;
};

export type CampaignDraftNormalized = {
  title: string;
  body: string;
  imageUrl: string | null;
  linkPath: string;
  linkUrl: string;
  audience: PushAudienceId;
  sendMode: PushSendMode;
  scheduledAt: Date | null;
};

export type CampaignDraftError = { ok: false; code: string; message: string };
export type CampaignDraftOk = { ok: true; value: CampaignDraftNormalized };
export type CampaignDraftResult = CampaignDraftOk | CampaignDraftError;

export function isPushAudienceId(v: unknown): v is PushAudienceId {
  return typeof v === 'string' && (PUSH_AUDIENCES as readonly string[]).includes(v);
}

export function parseSendMode(raw: unknown): PushSendMode {
  const s = String(raw ?? 'immediate').trim().toLowerCase();
  if (s === 'scheduled' || s === 'schedule' || s === 'agendar') return 'scheduled';
  return 'immediate';
}

function trimStr(raw: unknown): string {
  return String(raw ?? '').trim();
}

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateCampaignDraft(
  input: CampaignDraftInput,
  now = new Date(),
): CampaignDraftResult {
  const title = trimStr(input.title);
  if (title.length < 1 || title.length > PUSH_TITLE_MAX) {
    return {
      ok: false,
      code: 'PUSH_TITLE_INVALID',
      message: `Título obrigatório (1–${PUSH_TITLE_MAX} caracteres)`,
    };
  }
  const body = trimStr(input.body);
  if (body.length < 1 || body.length > PUSH_BODY_MAX) {
    return {
      ok: false,
      code: 'PUSH_BODY_INVALID',
      message: `Mensagem obrigatória (1–${PUSH_BODY_MAX} caracteres)`,
    };
  }

  const imageRaw = trimStr(input.imageUrl);
  let imageUrl: string | null = null;
  if (imageRaw) {
    if (imageRaw.length > PUSH_IMAGE_URL_MAX || !isHttpsUrl(imageRaw)) {
      return {
        ok: false,
        code: 'PUSH_IMAGE_INVALID',
        message: 'Imagem opcional deve ser URL HTTPS',
      };
    }
    imageUrl = imageRaw;
  }

  const mapped = mapPushDeepLink(input.linkPath);
  if (!mapped.ok || !mapped.url) {
    return {
      ok: false,
      code: 'PUSH_LINK_INVALID',
      message: 'Link deve ser rota da loja (ex.: / ou /produto/slug)',
    };
  }

  const audienceRaw = trimStr(input.audience) || 'all_enabled';
  if (!isPushAudienceId(audienceRaw)) {
    return {
      ok: false,
      code: 'PUSH_AUDIENCE_INVALID',
      message: 'Público v1: all_enabled ou with_orders',
    };
  }

  const sendMode = parseSendMode(input.sendMode);
  let scheduledAt: Date | null = null;
  if (sendMode === 'scheduled') {
    const raw = input.scheduledAt;
    const d = raw instanceof Date ? raw : new Date(String(raw ?? ''));
    if (Number.isNaN(d.getTime())) {
      return {
        ok: false,
        code: 'PUSH_SCHEDULE_INVALID',
        message: 'Data/hora de agendamento inválida',
      };
    }
    const skewMs = 30_000;
    if (d.getTime() < now.getTime() - skewMs) {
      return {
        ok: false,
        code: 'PUSH_SCHEDULE_PAST',
        message: 'Agendamento deve ser no futuro',
      };
    }
    scheduledAt = d;
  }

  return {
    ok: true,
    value: {
      title,
      body,
      imageUrl,
      linkPath: mapped.path,
      linkUrl: mapped.url,
      audience: audienceRaw,
      sendMode,
      scheduledAt,
    },
  };
}

export function initialCampaignStatus(sendMode: PushSendMode): 'scheduled' | 'sending' {
  return sendMode === 'scheduled' ? 'scheduled' : 'sending';
}

export function canCancelCampaign(status: string): boolean {
  return status === 'draft' || status === 'scheduled';
}

export function canDispatchCampaign(status: string): boolean {
  return status === 'sending' || status === 'scheduled';
}

/** Prisma where for v1 audiences. with_orders = logged-in user with a non-draft order. */
export function audienceTokenWhere(audience: PushAudienceId): Record<string, unknown> {
  const base = { enabled: true, platform: 'android' as const };
  if (audience === 'with_orders') {
    return {
      ...base,
      userId: { not: null },
      user: {
        orders: {
          some: {
            status: { notIn: ['draft', 'cancelled'] },
          },
        },
      },
    };
  }
  return base;
}

export function chunkTokens<T>(items: T[], size = FCM_MULTICAST_LIMIT): T[][] {
  const n = Math.max(1, size);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

export const FIREBASE_NOT_CONFIGURED_CODE = 'NÃO EXECUTADO';

export function firebaseNotConfiguredSummary(): string {
  return `${FIREBASE_NOT_CONFIGURED_CODE}: Firebase Admin não configurado (FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_BASE64 ausente).`;
}

export function emptyAudienceSummary(): string {
  return 'Nenhum aparelho com push ativo neste público.';
}
