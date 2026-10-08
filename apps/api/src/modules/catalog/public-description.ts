/**
 * Public catalog description hygiene. Same rules as the storefront
 * `public-copy` helper: never invent specs; only hide QA phrasing.
 */

const QA_PHRASE =
  /ideal para testar|experi[eê]ncia de compra da loja|testar a experi[eê]ncia|produto do cat[aá]logo lojas schimitz|produto de homologa[cç][aã]o|vitrine de teste|seed de cat[aá]logo|apenas para testar/i;

export function isQaCatalogCopy(text: string | null | undefined): boolean {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t) return false;
  return QA_PHRASE.test(t);
}

export function publicProductDescription(input: {
  description?: string | null;
  name?: string | null;
  categoryName?: string | null;
}): string {
  const raw = typeof input.description === 'string' ? input.description.trim() : '';
  if (!raw) return '';
  if (!isQaCatalogCopy(raw)) return raw;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const category = typeof input.categoryName === 'string' ? input.categoryName.trim() : '';
  if (name && category) {
    return `${name} na categoria ${category}. Preço, frete e pagamento são confirmados no checkout.`;
  }
  if (name) {
    return `${name} no catálogo da Lojas Schimitz. Preço, frete e pagamento são confirmados no checkout.`;
  }
  return 'Produto no catálogo da Lojas Schimitz. Preço, frete e pagamento são confirmados no checkout.';
}
