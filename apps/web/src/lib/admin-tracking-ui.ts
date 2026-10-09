/** Admin → Pedido → rastreio manual (PATCH /admin/orders/:id/tracking). */
export const ADMIN_TRACKING_EDITABLE = ['in_transit', 'shipped', 'delivered'] as const;
export const ADMIN_TRACKING_RE = /^[A-Z0-9-]{4,40}$/;

export function canEditTracking(status: string): boolean {
  return (ADMIN_TRACKING_EDITABLE as readonly string[]).includes(status);
}

export function normalizeTrackingDraft(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function trackingDraftError(raw: string): string | null {
  const v = normalizeTrackingDraft(raw);
  if (!v) return 'Informe o código de rastreio.';
  return ADMIN_TRACKING_RE.test(v) ? null : 'Use 4 a 40 letras, números ou hífen.';
}

export function trackingSavedMessage(publicId: string, r: { changed: boolean; notified: boolean }): string {
  if (r.notified) return `Rastreio do pedido ${publicId} salvo. Cliente avisado no app/site e por e-mail.`;
  if (r.changed) return `Transportadora do pedido ${publicId} atualizada (mesmo código: cliente não foi avisado de novo).`;
  return `Nada mudou no pedido ${publicId}.`;
}

export const ADMIN_TRACKING_HELP =
  'Etiqueta comprada fora do sistema (Melhor Envio, Correios…). O cliente recebe o código no app/site e por e-mail só quando o código muda.';
