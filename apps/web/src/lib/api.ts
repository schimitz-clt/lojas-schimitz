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

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const guest = typeof window !== 'undefined' ? localStorage.getItem('sch_guest') : '';
  if (guest) headers['x-guest-token'] = guest;

  const res = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' });
  const json = (await res.json()) as ApiOk<T> | ApiFail;
  if (!json.ok) throw new Error(json.error.message || 'Erro na API');
  return json.data;
}


/** Multipart upload (não define Content-Type — o browser define o boundary). */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
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
  if (!json.ok) throw new Error(json.error.message || 'Erro no upload');
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

export function currentUser(): { id: string; name: string; email: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('sch_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
