/**
 * Admin push campaign labels + form helpers (Portuguese). Pure.
 */

export const PUSH_AUDIENCE_OPTIONS = [
  { id: 'all_enabled', label: 'Todos os aparelhos com push ativo' },
  { id: 'with_orders', label: 'Clientes com pedidos (e token ativo)' },
] as const;

export type PushAudienceOptionId = (typeof PUSH_AUDIENCE_OPTIONS)[number]['id'];

export function pushAudienceLabel(id: string): string {
  return PUSH_AUDIENCE_OPTIONS.find((o) => o.id === id)?.label || id;
}

export function pushStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'scheduled':
      return 'Agendada';
    case 'sending':
      return 'Enviando';
    case 'sent':
      return 'Enviada';
    case 'failed':
      return 'Falhou';
    case 'cancelled':
      return 'Cancelada';
    default:
      return status;
  }
}

export function pushStatusTone(status: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'sent':
      return 'ok';
    case 'scheduled':
    case 'sending':
      return 'info';
    case 'failed':
      return 'danger';
    case 'cancelled':
      return 'neutral';
    default:
      return 'warn';
  }
}

export function isNaoExecutado(summary: string | null | undefined): boolean {
  return String(summary || '').includes('NÃO EXECUTADO');
}

export function campaignResultLine(c: {
  sentCount?: number;
  failedCount?: number;
  skippedCount?: number;
  errorSummary?: string | null;
}): string {
  const sent = c.sentCount ?? 0;
  const failed = c.failedCount ?? 0;
  const skipped = c.skippedCount ?? 0;
  const parts = [`${sent} enviado(s)`, `${failed} falha(s)`];
  if (skipped > 0) parts.push(`${skipped} ignorado(s)`);
  if (isNaoExecutado(c.errorSummary)) parts.push('NÃO EXECUTADO (Firebase)');
  else if (c.errorSummary) parts.push(c.errorSummary);
  return parts.join(' · ');
}

export type PushCampaignForm = {
  title: string;
  body: string;
  imageUrl: string;
  linkPath: string;
  audience: PushAudienceOptionId;
  sendMode: 'immediate' | 'scheduled';
  scheduledAt: string;
};

export function emptyPushCampaignForm(): PushCampaignForm {
  return {
    title: '',
    body: '',
    imageUrl: '',
    linkPath: '/',
    audience: 'all_enabled',
    sendMode: 'immediate',
    scheduledAt: '',
  };
}

export function validatePushCampaignForm(form: PushCampaignForm): string | null {
  if (!form.title.trim()) return 'Informe o título';
  if (form.title.trim().length > 80) return 'Título: no máximo 80 caracteres';
  if (!form.body.trim()) return 'Informe a mensagem';
  if (form.body.trim().length > 240) return 'Mensagem: no máximo 240 caracteres';
  const img = form.imageUrl.trim();
  if (img && !img.startsWith('https://')) return 'Imagem opcional deve ser URL HTTPS';
  const link = form.linkPath.trim() || '/';
  if (link.startsWith('javascript:') || link.startsWith('file:')) return 'Link inválido';
  if (/^https?:\/\//i.test(link) && !/https:\/\/(www\.)?lojasschimitz\.com\.br/i.test(link)) {
    return 'Link deve ser da loja (lojasschimitz.com.br)';
  }
  if (form.sendMode === 'scheduled' && !form.scheduledAt.trim()) {
    return 'Informe data e hora para agendar';
  }
  return null;
}

/** datetime-local → ISO; empty if immediate. */
export function scheduledAtIso(form: PushCampaignForm): string | undefined {
  if (form.sendMode !== 'scheduled') return undefined;
  const raw = form.scheduledAt.trim();
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function firebaseStatusHint(opts: {
  firebaseConfigured?: boolean;
  note?: string;
}): { tone: 'ok' | 'warn'; text: string } {
  if (opts.firebaseConfigured) {
    return { tone: 'ok', text: 'Firebase Admin configurado — envio real habilitado.' };
  }
  return {
    tone: 'warn',
    text:
      opts.note ||
      'NÃO EXECUTADO: falta FIREBASE_SERVICE_ACCOUNT_JSON no Railway (API). A campanha é gravada, mas o push não sai.',
  };
}
