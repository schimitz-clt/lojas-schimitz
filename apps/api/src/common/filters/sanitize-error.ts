/**
 * Strip stacks / filesystem paths from client-facing error text.
 * Prod-like 5xx is already generic; this covers 4xx that accidentally embed internals.
 */

const STACK_LINE = /^\s*at\s+\S+/m;
const PATH_LEAK =
  /(?:\/(?:home|workspace|usr|var|opt|app|data)\/[^\s)'"]+|\\(?:Users|Windows)\\[^\s)'"]+|\bnode_modules\/|\bprisma\/schema|\.(?:ts|js|tsx|jsx|kt):(\d+)(?::(\d+))?)/i;

export function messageLooksLikeInternalLeak(text: unknown): boolean {
  const s = String(text || '');
  if (!s) return false;
  if (s.includes('\n') && STACK_LINE.test(s)) return true;
  if (PATH_LEAK.test(s)) return true;
  if (/\bError: .+\n[\s\S]*\bat\s+/.test(s)) return true;
  return false;
}

export function sanitizeClientErrorMessage(
  message: string,
  options: { prodLike: boolean; status: number },
): string {
  if (options.prodLike && options.status >= 500) return 'Erro interno';
  if (!options.prodLike) return message;
  if (!messageLooksLikeInternalLeak(message)) return message;
  if (options.status === 401) return 'Não autorizado';
  if (options.status === 403) return 'Acesso negado';
  if (options.status === 404) return 'Não encontrado';
  if (options.status === 429) return 'Muitas tentativas. Tente de novo em instantes.';
  return 'Requisição inválida';
}

export function sanitizeClientErrorDetails(
  details: unknown[],
  options: { prodLike: boolean; status: number },
): unknown[] {
  if (options.prodLike && options.status >= 500) return [];
  if (!options.prodLike) return Array.isArray(details) ? details : [];
  const list = Array.isArray(details) ? details : [];
  if (list.some((d) => messageLooksLikeInternalLeak(typeof d === 'string' ? d : JSON.stringify(d)))) {
    return [];
  }
  return list;
}
