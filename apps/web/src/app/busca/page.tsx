import { redirect } from 'next/navigation';
import { catalogSearchAliasDestination, searchParamsToQuery } from '@/lib/search-alias';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** /busca?q= → /produtos?q= (HTTP 307). */
export default async function BuscaAliasPage({ searchParams }: Props) {
  const dest = catalogSearchAliasDestination({
    pathname: '/busca',
    search: searchParamsToQuery(await searchParams),
  });
  redirect(dest || '/produtos');
}
