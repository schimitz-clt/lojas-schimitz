/**
 * Admin push campaign labels + form helpers (Portuguese). Pure.
 */

import { ENTERPRISE_MISSING } from './admin-enterprise-ui';

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
    case 'skipped':
      return 'Ignorado';
    default:
      return status || ENTERPRISE_MISSING;
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
    case 'skipped':
      return 'neutral';
    default:
      return 'warn';
  }
}

/** POST /admin/push/campaigns/:id/send claims scheduled or still-sending rows only. */
export function canSendPushCampaign(status: string | null | undefined): boolean {
  const value = String(status || '').trim().toLowerCase();
  return value === 'scheduled' || value === 'sending';
}

export function pushSendConfirmCopy(input: {
  title?: string | null;
  status?: string | null;
}): { title: string; detail: string } {
  const title = String(input.title || '').trim() || ENTERPRISE_MISSING;
  const status = pushStatusLabel(String(input.status || '').trim());
  return {
    title: `Disparar agora: ${title} (${status})?`,
    detail:
      'POST /admin/push/campaigns/:id/send. Só campanha agendada ou ainda em envio. Não cobra, não estorna e não dispara a recuperação de produto. Se o Firebase estiver ausente, o resultado fica NÃO EXECUTADO.',
  };
}

export function pushSendResultMessage(
  result: {
    dispatched?: boolean | null;
    reason?: string | null;
    campaign?: { sentCount?: number | null; errorSummary?: string | null } | null;
  } | null | undefined,
): string {
  if (!result) return 'A API não confirmou o disparo.';
  const reason = String(result.reason || '').trim();
  const summary = result.campaign?.errorSummary;
  if (reason === 'nao_executado' || isNaoExecutado(summary)) {
    return 'NÃO EXECUTADO: Firebase ausente. A campanha foi atualizada e o push não saiu.';
  }
  if (reason === 'empty_audience') {
    const sent = result.campaign?.sentCount;
    if (typeof sent !== 'number' || !Number.isFinite(sent)) {
      return 'Disparo concluído: público vazio. A API não devolveu a contagem.';
    }
    return `Disparo concluído: ${Math.trunc(sent)} aparelho no público. Nenhum push saiu.`;
  }
  if (reason === 'already_final' || reason === 'already_dispatched') {
    return 'A API não disparou de novo: a campanha já estava encerrada ou já tinha envios.';
  }
  if (reason === 'ok' && result.dispatched === true) {
    const sent = result.campaign?.sentCount;
    if (typeof sent !== 'number' || !Number.isFinite(sent)) {
      return 'Campanha disparada. A API não devolveu a contagem.';
    }
    return `Campanha disparada: ${Math.trunc(sent)} enviado(s).`;
  }
  if (!reason) return 'A API não detalhou o resultado do disparo.';
  return `A API respondeu: ${reason}.`;
}

export function pushDispatchListSummary(count: number | null): string {
  if (count == null) return ENTERPRISE_MISSING;
  return `${Math.max(0, Math.trunc(count))} envio(s) neste detalhe.`;
}

export function pushDispatchEvidenceLine(row: {
  status?: string | null;
  error?: string | null;
  tokenFingerprint?: string | null;
}): string {
  const status = String(row.status || '').trim();
  const fingerprint = String(row.tokenFingerprint || '').trim() || ENTERPRISE_MISSING;
  const parts = [status ? pushStatusLabel(status) : ENTERPRISE_MISSING, `token ${fingerprint}`];
  const error = String(row.error || '').trim();
  if (error) parts.push(error);
  return parts.join(' · ');
}

export function firebaseProjectLine(projectId: string | null | undefined): string | null {
  const id = String(projectId || '').trim();
  if (!id) return null;
  return `Projeto ${id}`;
}

/** Static Admin copy when the preview endpoint has not loaded yet (default delay 2h). */
export function abandonedViewAdminNote(): string {
  return (
    'Recuperação de produto é automática: quem viu um produto no app (aparelho com push) e não comprou ' +
    'recebe um único aviso cerca de 2h depois da última visita. ' +
    'Limite: 1 por produto a cada 7 dias e 1 por aparelho por dia (horário de Brasília). ' +
    'Esta tela não dispara essa mensagem.'
  );
}

export function abandonedViewPreviewLine(preview: {
  openViews?: number;
  dueViews?: number;
  sentLast7Days?: number;
} | null | undefined): string {
  if (!preview) return '';
  const open = preview.openViews ?? 0;
  const due = preview.dueViews ?? 0;
  const sent = preview.sentLast7Days ?? 0;
  return `${open} visita(s) em aberto · ${due} com atraso cumprido · ${sent} enviado(s) em 7 dias`;
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
