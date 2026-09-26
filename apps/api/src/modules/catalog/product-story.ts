/**
 * Optional product story fields. Empty / invalid JSON renders as nothing.
 * Never invents benefits, box contents, or FAQ.
 */

export type ProductFeature = { label: string; value: string };
export type ProductFaqItem = { question: string; answer: string };

export type PublicProductStory = {
  highlights: string[];
  features: ProductFeature[];
  boxContents: string[];
  faq: ProductFaqItem[];
};

const EMPTY_STORY: PublicProductStory = {
  highlights: [],
  features: [],
  boxContents: [],
  faq: [],
};

function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function stringList(value: unknown, maxItems: number, itemMax: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const row of value) {
    const text = clip(row, itemMax);
    if (!text) continue;
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function featureList(value: unknown): ProductFeature[] {
  if (!Array.isArray(value)) return [];
  const out: ProductFeature[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const label = clip((row as { label?: unknown }).label, 40);
    const featureValue = clip((row as { value?: unknown }).value, 80);
    if (!label || !featureValue) continue;
    out.push({ label, value: featureValue });
    if (out.length >= 12) break;
  }
  return out;
}

function faqList(value: unknown): ProductFaqItem[] {
  if (!Array.isArray(value)) return [];
  const out: ProductFaqItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const question = clip((row as { question?: unknown }).question, 160);
    const answer = clip((row as { answer?: unknown }).answer, 600);
    if (!question || !answer) continue;
    out.push({ question, answer });
    if (out.length >= 8) break;
  }
  return out;
}

export function publicProductStory(product: {
  highlights?: unknown;
  features?: unknown;
  boxContents?: unknown;
  faq?: unknown;
} | null | undefined): PublicProductStory {
  if (!product) return { ...EMPTY_STORY };
  return {
    highlights: stringList(product.highlights, 8, 120),
    features: featureList(product.features),
    boxContents: stringList(product.boxContents, 12, 80),
    faq: faqList(product.faq),
  };
}

export function storyHasContent(story: PublicProductStory): boolean {
  return (
    story.highlights.length > 0 ||
    story.features.length > 0 ||
    story.boxContents.length > 0 ||
    story.faq.length > 0
  );
}
