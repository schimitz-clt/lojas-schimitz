/**
 * Texto do alerta "produtos sem peso/medidas" no admin (importação/lote).
 * Só descreve o que a API contou; nunca sugere valores de peso ou medida.
 */
export type ShippingDataSummary = {
  activeCount: number;
  missingCount: number;
  missingWeightCount: number;
  missingDimensionsCount: number;
  sample?: Array<{ sku: string; name: string; missing: string[] }>;
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function shippingDataStatusText(s: ShippingDataSummary | null | undefined): string {
  if (!s) return '';
  if (s.activeCount === 0) return 'Nenhum produto ativo no catálogo.';
  if (s.missingCount === 0) {
    return s.activeCount === 1
      ? 'O único produto ativo tem peso e medidas.'
      : `Todos os ${s.activeCount} produtos ativos têm peso e medidas.`;
  }
  const parts: string[] = [];
  if (s.missingWeightCount > 0) parts.push(`${s.missingWeightCount} sem peso`);
  if (s.missingDimensionsCount > 0) parts.push(`${s.missingDimensionsCount} sem alguma medida`);
  return (
    `${plural(s.missingCount, 'produto ativo', 'produtos ativos')} de ${s.activeCount} sem peso ou medidas` +
    (parts.length ? ` (${parts.join(', ')})` : '') +
    '. O frete desses produtos usa o pacote padrão (0,3 kg, 16×11×11 cm) e pode sair errado. ' +
    'Baixe a lista, preencha com os valores reais medidos e importe de volta (só peso/medidas são gravados).'
  );
}

export function shippingDataTone(s: ShippingDataSummary | null | undefined): 'ok' | 'warn' | 'none' {
  if (!s) return 'none';
  return s.missingCount > 0 ? 'warn' : 'ok';
}
