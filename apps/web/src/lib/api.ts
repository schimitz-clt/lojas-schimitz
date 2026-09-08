import { DEFAULT_STORE_WHATSAPP, storeWhatsAppDigits, waMeUrl } from './whatsapp';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export type ApiOk<T> = { ok: true; data: T; meta?: { requestId: string } };
export type ApiFail = { ok: false; error: { code: string; message: string } };

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('sch_access') || '';
}

export function getGuestToken() {
  if (typeof window === 'undefined') return '';
  let t = localStorage.getItem('sch_guest');
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem('sch_guest', t);
  }
  return t;
}

function isAuthEndpoint(path: string) {
  return (
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/register') ||
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/forgot-password') ||
    path.startsWith('/auth/reset-password')
  );
}

export function isUnauthorizedError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  return (
    msg.includes('token inválido') ||
    msg.includes('token invalido') ||
    msg.includes('não autorizado') ||
    msg.includes('nao autorizado') ||
    msg.includes('unauthorized') ||
    msg.includes('sessão expirada') ||
    msg.includes('sessao expirada') ||
    msg.includes('faça login') ||
    msg.includes('faca login')
  );
}

function responseLooksUnauthorized(res: Response, json: ApiOk<unknown> | ApiFail): boolean {
  if (res.status === 401) return true;
  if (!json.ok) {
    const code = (json.error?.code || '').toUpperCase();
    const msg = (json.error?.message || '').toLowerCase();
    if (code === 'UNAUTHORIZED') return true;
    if (
      msg.includes('token inválido') ||
      msg.includes('token invalido') ||
      msg.includes('token ausente') ||
      msg.includes('unauthorized')
    ) {
      return true;
    }
  }
  return false;
}

type SessionPayload = { accessToken: string; refreshToken: string; user: unknown };

/** Single-flight: parallel 401s share one refresh (token rotation). */
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem('sch_refresh');
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      const json = (await res.json()) as ApiOk<SessionPayload> | ApiFail;
      if (!json.ok || !json.data?.accessToken) return false;
      saveSession(json.data);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function handleUnauthorizedAndMaybeRetry<T>(
  path: string,
  retry: () => Promise<T>,
  alreadyRetried: boolean,
  originalMessage: string,
): Promise<T> {
  if (alreadyRetried || isAuthEndpoint(path)) {
    throw new Error(originalMessage || 'Token inválido');
  }
  const refreshed = await tryRefreshSession();
  if (refreshed) return retry();
  clearSession();
  throw new Error('Sessão expirada. Faça login novamente.');
}

function buildJsonHeaders(init: RequestInit = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const guest = typeof window !== 'undefined' ? localStorage.getItem('sch_guest') : '';
  if (guest) headers['x-guest-token'] = guest;
  return headers;
}

export async function api<T>(path: string, init: RequestInit = {}, _retried = false): Promise<T> {
  const headers = buildJsonHeaders(init);
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' });
  const json = (await res.json()) as ApiOk<T> | ApiFail;

  const failMsg = !json.ok ? json.error.message || 'Erro na API' : 'Token inválido';
  if (responseLooksUnauthorized(res, json)) {
    return handleUnauthorizedAndMaybeRetry(path, () => api<T>(path, init, true), _retried, failMsg);
  }

  if (!json.ok) throw new Error(failMsg);
  return json.data;
}

/** Multipart upload (não define Content-Type — o browser define o boundary). */
export async function apiUpload<T>(path: string, formData: FormData, _retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const guest = typeof window !== 'undefined' ? localStorage.getItem('sch_guest') : '';
  if (guest) headers['x-guest-token'] = guest;

  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store',
  });
  const json = (await res.json()) as ApiOk<T> | ApiFail;

  const failMsg = !json.ok ? json.error.message || 'Erro no upload' : 'Token inválido';
  if (responseLooksUnauthorized(res, json)) {
    return handleUnauthorizedAndMaybeRetry(
      path,
      () => apiUpload<T>(path, formData, true),
      _retried,
      failMsg,
    );
  }

  if (!json.ok) throw new Error(failMsg);
  return json.data;
}

export function saveSession(data: { accessToken: string; refreshToken: string; user: unknown }) {
  localStorage.setItem('sch_access', data.accessToken);
  localStorage.setItem('sch_refresh', data.refreshToken);
  localStorage.setItem('sch_user', JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem('sch_access');
  localStorage.removeItem('sch_refresh');
  localStorage.removeItem('sch_user');
}

export type SessionUser = { id: string; name: string; email: string; role: string };

export function currentUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('sch_user');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionUser> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    const email = typeof parsed.email === 'string' ? parsed.email.trim() : '';
    if (!id && !email) return null;
    const name = typeof parsed.name === 'string' ? parsed.name : '';
    const role = typeof parsed.role === 'string' && parsed.role ? parsed.role : 'customer';
    return { id, email, name, role };
  } catch {
    return null;
  }
}

/** Label for header/account UI when name may be missing. */
export function userAccountLabel(user: SessionUser): string {
  const parts = user.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const first = parts[0];
  if (first && first.toLowerCase() !== 'admin') return first;
  // Avoid showing "Admin" when the person's name starts with that word.
  if (parts[1]) return parts[1];
  const local = user.email?.split('@')[0]?.trim();
  if (local) return local;
  return 'Conta';
}

export function brl(n: number | string) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function waLink(text = 'Olá, vim pela Lojas Schimitz') {
  return waMeUrl(storeWhatsAppDigits(process.env.NEXT_PUBLIC_WHATSAPP), text);
}

export const WA = DEFAULT_STORE_WHATSAPP;

export type ChatProductHit = {
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  badge: string | null;
  inStock: boolean;
  path: string;
};

export type ChatReply = {
  conversationId: string;
  reply: string;
  handoff: boolean;
  whatsappUrl: string;
  llm: boolean;
  products: ChatProductHit[];
};

export function sendChat(message: string, conversationId?: string) {
  return api<ChatReply>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversationId }),
  });
}
