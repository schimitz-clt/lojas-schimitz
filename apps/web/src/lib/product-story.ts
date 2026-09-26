/** Display + admin text for optional product story fields. Empty means render nothing. */

export type ProductFeature = { label: string; value: string };
export type ProductFaqItem = { question: string; answer: string };

export type ProductStory = {
  highlights: string[];
  features: ProductFeature[];
  boxContents: string[];
  faq: ProductFaqItem[];
};

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function parseProductStory(product: {
  highlights?: unknown;
  features?: unknown;
  boxContents?: unknown;
  faq?: unknown;
} | null | undefined): ProductStory {
  const highlights = Array.isArray(product?.highlights)
    ? product.highlights.map((row) => clip(row, 120)).filter(Boolean).slice(0, 8)
    : [];
  const boxContents = Array.isArray(product?.boxContents)
    ? product.boxContents.map((row) => clip(row, 80)).filter(Boolean).slice(0, 12)
    : [];
  const features: ProductFeature[] = [];
  if (Array.isArray(product?.features)) {
    for (const row of product.features) {
      if (!row || typeof row !== 'object') continue;
      const label = clip((row as { label?: unknown }).label, 40);
      const value = clip((row as { value?: unknown }).value, 80);
      if (!label || !value) continue;
      features.push({ label, value });
      if (features.length >= 12) break;
    }
  }
  const faq: ProductFaqItem[] = [];
  if (Array.isArray(product?.faq)) {
    for (const row of product.faq) {
      if (!row || typeof row !== 'object') continue;
      const question = clip((row as { question?: unknown }).question, 160);
      const answer = clip((row as { answer?: unknown }).answer, 600);
      if (!question || !answer) continue;
      faq.push({ question, answer });
      if (faq.length >= 8) break;
    }
  }
  return { highlights, features, boxContents, faq };
}

export function highlightsToText(items: string[]): string {
  return items.join('\n');
}

export function textToHighlights(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function boxContentsToText(items: string[]): string {
  return items.join('\n');
}

export function textToBoxContents(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function pairsToText(rows: { left: string; right: string }[]): string {
  return rows.map((row) => `${row.left} | ${row.right}`).join('\n');
}

function textToPairs(text: string, max: number): { left: string; right: string }[] {
  const out: { left: string; right: string }[] = [];
  for (const line of text.split(/\n+/)) {
    const [leftRaw, ...rest] = line.split('|');
    const left = (leftRaw || '').trim();
    const right = rest.join('|').trim();
    if (!left || !right) continue;
    out.push({ left, right });
    if (out.length >= max) break;
  }
  return out;
}

export function featuresToText(items: ProductFeature[]): string {
  return pairsToText(items.map((item) => ({ left: item.label, right: item.value })));
}

export function textToFeatures(text: string): ProductFeature[] {
  return textToPairs(text, 12).map((row) => ({ label: row.left.slice(0, 40), value: row.right.slice(0, 80) }));
}

export function faqToText(items: ProductFaqItem[]): string {
  return pairsToText(items.map((item) => ({ left: item.question, right: item.answer })));
}

export function textToFaq(text: string): ProductFaqItem[] {
  return textToPairs(text, 8).map((row) => ({
    question: row.left.slice(0, 160),
    answer: row.right.slice(0, 600),
  }));
}

export function trustItemsToText(items: { title: string; body: string }[] | null | undefined): string {
  if (!items?.length) return '';
  return items.map((item) => `${item.title} | ${item.body}`).join('\n');
}

export function textToTrustItems(text: string): { title: string; body: string }[] {
  return textToPairs(text, 6).map((row) => ({ title: row.left.slice(0, 40), body: row.right.slice(0, 140) }));
}
