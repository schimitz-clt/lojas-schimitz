/**
 * Ilustrações SVG temáticas do catálogo demonstrativo.
 * Servidas pelo próprio domínio em /demo-catalog/{SKU}.svg — sem CDN externo.
 */

export type DemoArt =
  | 'tv'
  | 'speaker'
  | 'phone'
  | 'cable'
  | 'laptop'
  | 'mouse'
  | 'fridge'
  | 'kitchen'
  | 'lamp'
  | 'headphone'
  | 'watch'
  | 'bottle'
  | 'tool'
  | 'beauty'
  | 'bag';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function icon(art: DemoArt, accent: string): string {
  switch (art) {
    case 'tv':
      return `<rect x="150" y="150" width="500" height="300" rx="24" fill="${accent}"/><rect x="174" y="174" width="452" height="228" rx="8" fill="#10141c"/><rect x="360" y="458" width="80" height="18" rx="6" fill="${accent}"/><rect x="330" y="476" width="140" height="12" rx="6" fill="#3a4454"/>`;
    case 'speaker':
      return `<rect x="250" y="140" width="300" height="460" rx="28" fill="${accent}"/><circle cx="400" cy="280" r="78" fill="#10141c"/><circle cx="400" cy="460" r="42" fill="#10141c"/>`;
    case 'phone':
      return `<rect x="290" y="120" width="220" height="460" rx="36" fill="${accent}"/><rect x="312" y="168" width="176" height="340" rx="8" fill="#10141c"/><circle cx="400" cy="540" r="14" fill="#10141c"/>`;
    case 'cable':
      return `<rect x="180" y="360" width="440" height="36" rx="18" fill="${accent}"/><rect x="150" y="330" width="70" height="96" rx="16" fill="${accent}"/><rect x="580" y="330" width="70" height="96" rx="16" fill="${accent}"/>`;
    case 'laptop':
      return `<rect x="170" y="180" width="460" height="280" rx="18" fill="${accent}"/><rect x="194" y="204" width="412" height="220" rx="6" fill="#10141c"/><path d="M140 470 h520 l-40 40 h-440 z" fill="${accent}"/>`;
    case 'mouse':
      return `<rect x="310" y="160" width="180" height="280" rx="90" fill="${accent}"/><rect x="392" y="190" width="16" height="70" rx="8" fill="#10141c"/>`;
    case 'fridge':
      return `<rect x="250" y="110" width="300" height="500" rx="20" fill="${accent}"/><rect x="270" y="140" width="260" height="220" rx="8" fill="#10141c" opacity="0.35"/><rect x="270" y="380" width="260" height="190" rx="8" fill="#10141c" opacity="0.35"/><rect x="500" y="220" width="14" height="50" rx="4" fill="#10141c"/><rect x="500" y="450" width="14" height="50" rx="4" fill="#10141c"/>`;
    case 'kitchen':
      return `<ellipse cx="400" cy="430" rx="180" ry="40" fill="${accent}"/><path d="M250 220 h300 v190 h-300 z" fill="${accent}"/><path d="M270 220 v-70 h40 v70 M490 220 v-90 h28 v90" fill="none" stroke="${accent}" stroke-width="16"/>`;
    case 'lamp':
      return `<path d="M250 260 h300 l-40 40 h-220 z" fill="${accent}"/><rect x="384" y="300" width="32" height="160" fill="${accent}"/><ellipse cx="400" cy="490" rx="90" ry="22" fill="${accent}"/>`;
    case 'headphone':
      return `<path d="M230 360 v-80 a170 170 0 0 1 340 0 v80" fill="none" stroke="${accent}" stroke-width="28"/><rect x="180" y="340" width="90" height="150" rx="24" fill="${accent}"/><rect x="530" y="340" width="90" height="150" rx="24" fill="${accent}"/>`;
    case 'watch':
      return `<rect x="330" y="120" width="140" height="70" rx="16" fill="${accent}"/><rect x="280" y="180" width="240" height="280" rx="48" fill="${accent}"/><circle cx="400" cy="320" r="78" fill="#10141c"/><rect x="330" y="460" width="140" height="70" rx="16" fill="${accent}"/>`;
    case 'bottle':
      return `<rect x="350" y="120" width="100" height="50" rx="10" fill="${accent}"/><path d="M300 190 h200 l30 360 h-260 z" fill="${accent}"/>`;
    case 'tool':
      return `<rect x="180" y="360" width="440" height="36" rx="10" transform="rotate(-35 400 378)" fill="${accent}"/><circle cx="280" cy="250" r="70" fill="none" stroke="${accent}" stroke-width="28"/><rect x="470" y="430" width="120" height="36" rx="8" transform="rotate(-35 530 448)" fill="${accent}"/>`;
    case 'beauty':
      return `<rect x="340" y="140" width="120" height="40" rx="8" fill="${accent}"/><path d="M310 190 h180 l-20 340 h-140 z" fill="${accent}"/><circle cx="400" cy="340" r="28" fill="#10141c"/>`;
    case 'bag':
      return `<path d="M250 280 h300 l-30 280 h-240 z" fill="${accent}"/><path d="M320 280 v-50 a80 80 0 0 1 160 0 v50" fill="none" stroke="${accent}" stroke-width="22"/>`;
    default:
      return `<circle cx="400" cy="340" r="120" fill="${accent}"/>`;
  }
}

/** SVG autocontido, sem script, sem URL externa e sem foto de marca. */
export function renderDemoCatalogSvg(input: {
  title: string;
  sku: string;
  art: DemoArt;
  bg: string;
  accent: string;
}): string {
  const title = esc(input.title.replace(/\s+—\s+(Série|Linha) Demo$/u, ''));
  const sku = esc(input.sku);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-label="${title}">
  <rect width="800" height="800" fill="${input.bg}"/>
  <rect x="48" y="48" width="704" height="704" rx="36" fill="none" stroke="${input.accent}" stroke-opacity="0.35" stroke-width="2"/>
  ${icon(input.art, input.accent)}
  <text x="400" y="640" text-anchor="middle" fill="#f4f1ea" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${title}</text>
  <text x="400" y="682" text-anchor="middle" fill="${input.accent}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" letter-spacing="2">SÉRIE DEMO · ${sku}</text>
</svg>
`;
}
