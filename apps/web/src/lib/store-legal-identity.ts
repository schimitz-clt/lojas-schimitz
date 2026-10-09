/**
 * Dados legais da loja exibidos em /privacidade e /excluir-conta.
 * Nada é inventado: cada campo só aparece quando a variável pública correspondente estiver
 * definida (e válida) no build do web. Sem variável, o campo é omitido.
 *
 *   NEXT_PUBLIC_STORE_LEGAL_NAME     nome do responsável / razão social
 *   NEXT_PUBLIC_STORE_CNPJ           CNPJ (14 dígitos, com ou sem máscara)
 *   NEXT_PUBLIC_STORE_ADDRESS        endereço para correspondência
 *   NEXT_PUBLIC_STORE_PRIVACY_EMAIL  e-mail do canal de privacidade
 *
 * O WhatsApp é o canal que já existe no site (lib/whatsapp.ts).
 */
import { DEFAULT_STORE_WHATSAPP } from './whatsapp';

export type StoreLegalIdentity = {
  legalName: string | null;
  cnpj: string | null;
  address: string | null;
  privacyEmail: string | null;
  whatsappDigits: string;
  whatsappDisplay: string;
  whatsappHref: string;
};

type Env = Record<string, string | undefined>;

function clean(value: string | undefined, max = 200): string | null {
  const v = String(value ?? '').replace(/\s+/g, ' ').trim();
  return v ? v.slice(0, max) : null;
}

export function formatCnpj(value: string | undefined): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return null;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function cleanEmail(value: string | undefined): string | null {
  const v = clean(value, 120);
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v.toLowerCase() : null;
}

export function formatWhatsappDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '');
  const local = d.startsWith('55') ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  return d;
}

export function storeLegalIdentity(env: Env = {
  NEXT_PUBLIC_STORE_LEGAL_NAME: process.env.NEXT_PUBLIC_STORE_LEGAL_NAME,
  NEXT_PUBLIC_STORE_CNPJ: process.env.NEXT_PUBLIC_STORE_CNPJ,
  NEXT_PUBLIC_STORE_ADDRESS: process.env.NEXT_PUBLIC_STORE_ADDRESS,
  NEXT_PUBLIC_STORE_PRIVACY_EMAIL: process.env.NEXT_PUBLIC_STORE_PRIVACY_EMAIL,
}): StoreLegalIdentity {
  const whatsappDigits = DEFAULT_STORE_WHATSAPP;
  return {
    legalName: clean(env.NEXT_PUBLIC_STORE_LEGAL_NAME, 120),
    cnpj: formatCnpj(env.NEXT_PUBLIC_STORE_CNPJ),
    address: clean(env.NEXT_PUBLIC_STORE_ADDRESS, 240),
    privacyEmail: cleanEmail(env.NEXT_PUBLIC_STORE_PRIVACY_EMAIL),
    whatsappDigits,
    whatsappDisplay: formatWhatsappDisplay(whatsappDigits),
    whatsappHref: `https://wa.me/${whatsappDigits}`,
  };
}

/** Linhas de contato em texto (só campos configurados + WhatsApp). */
export function legalContactLines(id: StoreLegalIdentity): string[] {
  const lines: string[] = [];
  lines.push(`Controlador: ${id.legalName ?? 'Lojas Schimitz'}`);
  if (id.cnpj) lines.push(`CNPJ: ${id.cnpj}`);
  if (id.address) lines.push(`Endereço: ${id.address}`);
  lines.push(`WhatsApp: ${id.whatsappDisplay} (${id.whatsappHref})`);
  if (id.privacyEmail) lines.push(`E-mail: ${id.privacyEmail}`);
  return lines;
}
