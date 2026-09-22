import { redirect } from 'next/navigation';
import { catalogSearchAliasDestination, searchParamsToQuery } from '@/lib/search-alias';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** /buscar?q= → /produtos?q= (HTTP 307). */
export default async function BuscarAliasPage({ searchParams }: Props) {
  const dest = catalogSearchAliasDestination({
    pathname: '/buscar',
    search: searchParamsToQuery(await searchParams),
  });
  redirect(dest || '/produtos');
}
