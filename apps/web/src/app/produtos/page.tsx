import ProdutosClient, { type ProdutosSeed } from './produtos-client';
import { resolveApiProxyTarget } from '@/lib/api-proxy';
import { catalogQueryPath, unwrapCatalogList } from '@/lib/catalog-query';

async function getJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${resolveApiProxyTarget()}/api/v1${path}`, {
      next: { revalidate: 60 },
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Lista no HTML do servidor (SEO / primeira pintura). Falhou → null e o cliente busca como antes.
 * Ler searchParams torna a rota dinâmica, então useSearchParams no cliente não cai para render só no navegador.
 */
export default async function ProdutosPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const path = catalogQueryPath(get);
  const [list, cats] = await Promise.all([getJson(path), getJson('/categories')]);
  const parsed = unwrapCatalogList<ProdutosSeed['items'][number]>(list);
  const catData = cats && typeof cats === 'object' && 'data' in (cats as object) ? (cats as { data: unknown }).data : cats;
  const seed: ProdutosSeed | null = parsed
    ? { path, items: parsed.items, total: parsed.total, categories: Array.isArray(catData) ? (catData as ProdutosSeed['categories']) : null }
    : null;
  return <ProdutosClient seed={seed} />;
}
