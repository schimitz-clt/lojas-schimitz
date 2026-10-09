/**
 * Nome exibido publicamente em avaliações (LGPD: minimização).
 * "Maria Aparecida da Silva" → "Maria S."; "joão" → "João"; vazio → "Cliente".
 * Nunca devolve sobrenome completo, e-mail, id do usuário ou id do pedido.
 */
export function publicReviewerName(raw: string | null | undefined): string {
  const parts = String(raw ?? '')
    .replace(/[^\p{L}\p{M}' -]+/gu, ' ')
    .split(/\s+/)
    .map((p) => p.replace(/^['-]+|['-]+$/g, ''))
    .filter(Boolean);
  if (!parts.length) return 'Cliente';
  const cap = (w: string) => w.charAt(0).toLocaleUpperCase('pt-BR') + w.slice(1).toLocaleLowerCase('pt-BR');
  const first = cap(parts[0]).slice(0, 40);
  if (parts.length === 1) return first;
  const last = parts[parts.length - 1];
  return `${first} ${last.charAt(0).toLocaleUpperCase('pt-BR')}.`;
}

export type PublicReview = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { name: string };
};

export function serializePublicReview(row: {
  id: string;
  rating: number;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { name: string | null } | null;
}): PublicReview {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: { name: publicReviewerName(row.user?.name) },
  };
}
