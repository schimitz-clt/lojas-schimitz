/**
 * Ícone de categoria quando o SKU não tem foto real.
 * Não substitui upload — só evita card vazio na vitrine.
 */
const CAT_ICONS: Record<string, string> = {
  eletro: '/cats/eletro.svg',
  'tvs-e-audio': '/cats/eletro.svg',
  'tv-e-video': '/cats/eletro.svg',
  celulares: '/cats/celulares.svg',
  informatica: '/cats/informatica.svg',
  eletrodomesticos: '/cats/eletrodomesticos.svg',
  casa: '/cats/casa.svg',
  'casa-e-decoracao': '/cats/casa.svg',
  esporte: '/cats/esporte.svg',
  'esporte-e-lazer': '/cats/esporte.svg',
  ofertas: '/cats/ofertas.svg',
  ferramentas: '/cats/eletrodomesticos.svg',
  utilidades: '/cats/casa.svg',
  'moda-e-acessorios': '/cats/esporte.svg',
  marketplace: '/cats/marketplace.svg',
};

export function categoryFallbackImage(slug?: string | null): string {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  if (key && CAT_ICONS[key]) return CAT_ICONS[key];
  return '/cats/marketplace.svg';
}
