/** Fornecedor/custo (Prime) — regras puras do formulário admin. Nada estimado. */
export type SupplierView = {
  supplierName: string;
  supplierSku: string | null;
  supplierUrl: string | null;
  costPrice: number | null;
  leadTimeDays: number | null;
  notes: string | null;
  updatedAt: string;
};

export type SupplierForm = {
  supplierName: string;
  supplierSku: string;
  supplierUrl: string;
  costPrice: string;
  leadTimeDays: string;
  notes: string;
};

export const emptySupplierForm = (): SupplierForm => ({
  supplierName: '', supplierSku: '', supplierUrl: '', costPrice: '', leadTimeDays: '', notes: '',
});

export function supplierToForm(s: SupplierView | null): SupplierForm {
  if (!s) return emptySupplierForm();
  return {
    supplierName: s.supplierName,
    supplierSku: s.supplierSku ?? '',
    supplierUrl: s.supplierUrl ?? '',
    costPrice: s.costPrice == null ? '' : String(s.costPrice).replace('.', ','),
    leadTimeDays: s.leadTimeDays == null ? '' : String(s.leadTimeDays),
    notes: s.notes ?? '',
  };
}

/** Valida e monta o corpo do PUT. Retorna erro em português ou o corpo. */
export function supplierFormToBody(f: SupplierForm): { error: string } | { body: Record<string, unknown> } {
  const name = f.supplierName.trim();
  if (name.length < 2) return { error: 'Informe o nome do fornecedor (mín. 2 letras).' };
  const costRaw = f.costPrice.trim();
  const cost = costRaw === '' ? null : Number(costRaw.replace(/\./g, '').replace(',', '.'));
  if (cost != null && (!Number.isFinite(cost) || cost < 0)) return { error: 'Custo inválido.' };
  const leadRaw = f.leadTimeDays.trim();
  const lead = leadRaw === '' ? null : Number(leadRaw);
  if (lead != null && (!Number.isInteger(lead) || lead < 0 || lead > 365)) return { error: 'Prazo deve ser um número inteiro de 0 a 365 dias.' };
  const url = f.supplierUrl.trim();
  if (url && !/^https?:\/\//i.test(url)) return { error: 'Link do fornecedor deve começar com https://' };
  return {
    body: {
      supplierName: name,
      supplierSku: f.supplierSku.trim() || null,
      supplierUrl: url || null,
      costPrice: cost == null ? null : Math.round(cost * 100) / 100,
      leadTimeDays: lead,
      notes: f.notes.trim() || null,
    },
  };
}

export function marginLabel(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return 'Margem: sem custo cadastrado';
  return `Margem bruta: ${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
