/**
 * Remaining admin sections — attention, evidence, action from payloads already loaded.
 * No network. Missing field → "—". Zero stays zero. No invented KPI or status.
 */

import { ENTERPRISE_MISSING, countOrDash, moneyOrDash, textOrDash } from './admin-enterprise-ui';
import { MAX_HOME_BANNERS } from './home-banners';
import { couponIsExhausted, couponIsExpired, couponNotStarted } from './admin-pro-ui';
import { opsMailStatusLabel, opsUploadsStatusLabel } from './admin-ops-ui';

export type PrimeLoad = 'pending' | 'ready' | 'error';

export type PrimeAttentionItem = {
  code: string;
  severity: 'critical' | 'high' | 'warn' | 'info';
  message: string;
  count: number | null;
  recommendedAction: string;
  evidenceLine: string | null;
  ctaHint: string | null;
};

export type PrimeKpi = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone?: 'warn' | 'danger';
};

export type PrimeAction = {
  id: string;
  label: string;
  hint: string;
  figure: string | null;
};

export type PrimeSectionModel = {
  summary: string;
  kpis: PrimeKpi[];
  attention: PrimeAttentionItem[];
  signals: PrimeAttentionItem[];
  actions: PrimeAction[];
};

export const CLIENTES_NOW_LEDE =
  'Contagens de GET /admin/customers (take 50). Zero continua zero. Sem a resposta, o valor fica —. GET /admin/ops não traz clientes.';

export const CLIENTES_DO_LEDE =
  'Busca, histórico e o atalho para Pedidos. Esta seção não edita cadastro, não exclui e não envia marketing.';

export const CLIENTES_READONLY_NOTE =
  'Somente leitura: GET /admin/customers e GET /admin/customers/:id. Não há escrita segura nesta seção.';

export const CLIENTES_EVIDENCE_LEDE =
  'O total é o campo total da busca. A lista é no máximo 50. Campo ausente no detalhe fica —.';

export const FRETE_NOW_LEDE =
  'Configuração e zonas de GET /admin/shipping. Zero continua zero. Sem a resposta, o valor fica —. GET /admin/ops não traz frete.';

export const FRETE_DO_LEDE =
  'Os formulários que já existem: PATCH /admin/shipping/settings e POST/PATCH/DELETE /admin/shipping/rules. Nada grava sozinho.';

export const FRETE_EVIDENCE_LEDE =
  'Envio próprio na operação. Preço e prazo da vitrine vêm da cotação Melhor Envio. Zona com taxa 0 (Porto Alegre 90 e 91) zera o valor do cliente e mantém o prazo calculado. A taxa padrão não substitui essa cotação.';

export const VITRINE_NOW_LEDE =
  'Banners e SEO já carregados (GET /admin/banners e GET /admin/store/settings). Disco de upload só entra se GET /admin/ops trouxer uploads.';

export const VITRINE_DO_LEDE =
  'Salvar SEO, criar ou editar banner — os POST/PATCH que já existem. Excluir banner continua o DELETE já desta tela.';

export const VITRINE_EVIDENCE_LEDE =
  'Título e descrição vão para a aba e o Open Graph. Só banners ativos entram no carrossel. Limite conta ativos e inativos.';

export const CUPONS_NOW_LEDE =
  'Cupons de GET /admin/coupons. Zero continua zero. Sem a lista, o valor fica —. GET /admin/ops não traz cupom.';

export const CUPONS_DO_LEDE =
  'Criar e ativar/desativar usam POST /admin/coupons e PATCH /admin/coupons/:id. Nada aplica desconto sozinho.';

export const CUPONS_EVIDENCE_LEDE =
  'O cliente aplica o código na sacola ou no checkout. Expirado ou esgotado continua visível nesta lista.';

export const EQUIPE_NOW_LEDE =
  'Administradores de GET /admin/admins. Zero continua zero. Sem a lista, o valor fica —. Não há papel novo nesta tela.';

export const EQUIPE_DO_LEDE =
  'Criar usa POST /admin/admins. Desativar usa PATCH /admin/admins/:id/status. Você não desativa a si mesmo nem o último ativo — a regra já existente.';

export const EQUIPE_EVIDENCE_LEDE =
  'Todas as contas listadas entram no mesmo painel. O campo role aparece como a API mandou. Esta tela não reescreve permissão.';

export const AVALIACOES_NOW_LEDE =
  'Moderação de GET /admin/reviews. Zero continua zero. Sem a lista, o valor fica —. Não há status além dos que a API devolve.';

export const AVALIACOES_DO_LEDE =
  'Ocultar e publicar usam PATCH /admin/reviews/:id. Excluir continua o DELETE já desta tela.';

export const AVALIACOES_EVIDENCE_LEDE =
  'Publicadas aparecem na loja. Ocultas saem da vitrine e continuam nesta lista até excluir.';

export const NOTIFICACOES_NOW_LEDE =
  'Push de GET /admin/push/campaigns, GET /admin/push/tokens e GET /admin/push/abandoned-views. O e-mail da loja entra só se GET /admin/ops trouxer mail.';

export const NOTIFICACOES_DO_LEDE =
  'Nova campanha, disparar agendada com confirmação, cancelar e teste no aparelho. A recuperação de produto não dispara nesta tela. O e-mail da loja é só leitura.';

export const NOTIFICACOES_EVIDENCE_LEDE =
  'Token FCM completo não aparece. Firebase ausente grava a campanha e não envia o push. O detalhe de envios é GET /admin/push/campaigns/:id.';

export const MARKETPLACE_NOW_LEDE =
  'Vendedores de GET /admin/sellers e comissões do filtro já carregado em GET /admin/commissions. GET /admin/ops não traz marketplace.';

export const MARKETPLACE_DO_LEDE =
  'Criar vendedor, status, dono e comissão % usam os POST/PATCH já existentes. Aprovar, suspender e marcar pago pedem confirmação e continuam no ledger local — não cobram, não estornam e não gravam no Mercado Pago.';

export const MARKETPLACE_EVIDENCE_LEDE =
  'O valor da linha é a comissão da plataforma, não o PIX do líquido ao vendedor. O filtro de status limita esta lista.';

const PENDING_SUMMARY = 'Lendo a lista…';
const ERROR_SUMMARY = 'Lista indisponível. Nenhum número foi estimado.';

function dashKpi(id: string, label: string, hint: string): PrimeKpi {
  return { id, label, value: ENTERPRISE_MISSING, hint };
}

function countLabel(value: number | null, ready: boolean): string {
  if (!ready) return ENTERPRISE_MISSING;
  return countOrDash(value);
}

function figure(value: number | null, ready: boolean, suffix: string): string | null {
  if (!ready || value == null) return null;
  return `${value} ${suffix}`;
}

function finiteInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Math.trunc(Number(value.trim()));
  return null;
}

function boolCount(flags: Array<boolean | null>): number | null {
  if (flags.some((flag) => flag == null)) return null;
  return flags.filter(Boolean).length;
}

function loadSummary(load: PrimeLoad, readyText: string): string {
  if (load === 'error') return ERROR_SUMMARY;
  if (load !== 'ready') return PENDING_SUMMARY;
  return readyText;
}

function attention(
  partial: Omit<PrimeAttentionItem, 'evidenceLine' | 'ctaHint'> & {
    evidenceLine?: string | null;
    ctaHint?: string | null;
  },
): PrimeAttentionItem {
  return {
    evidenceLine: partial.evidenceLine ?? null,
    ctaHint: partial.ctaHint ?? null,
    ...partial,
  };
}

export function clientesPrimeModel(input: {
  load: PrimeLoad;
  total: number | null;
  items: Array<{
    status?: string | null;
    phone?: string | null;
    paidOrdersCount?: number | null;
  }> | null;
}): PrimeSectionModel {
  const ready = input.load === 'ready';
  const items = ready ? input.items : null;
  const total = ready ? finiteInt(input.total) : null;
  const shown = items ? items.length : null;
  const inactiveFlags = items
    ? items.map((row) => {
        const status = String(row.status || '').trim().toLowerCase();
        if (!status) return null;
        return status === 'blocked' || status === 'inactive' || status === 'disabled';
      })
    : null;
  const inactive = inactiveFlags ? boolCount(inactiveFlags) : null;
  const paidFlags = items
    ? items.map((row) => {
        const n = finiteInt(row.paidOrdersCount);
        if (n == null) return null;
        return n > 0;
      })
    : null;
  const withPaid = paidFlags ? boolCount(paidFlags) : null;
  const noPhone = items
    ? items.filter((row) => !String(row.phone || '').trim()).length
    : null;

  const summary = loadSummary(
    input.load,
    [
      total == null ? 'O total da busca não veio.' : `${total} cliente(s) na busca.`,
      shown == null ? 'A página não veio.' : `${shown} nesta página.`,
      inactive == null ? 'Contas inativas não puderam ser contadas.' : `${inactive} inativa(s) nesta página.`,
    ].join(' '),
  );

  const kpis: PrimeKpi[] = [
    {
      id: 'total',
      label: 'Total da busca',
      value: countLabel(total, ready),
      hint: 'campo total · GET /admin/customers',
    },
    {
      id: 'shown',
      label: 'Nesta página',
      value: countLabel(shown, ready),
      hint: 'take 50',
    },
    {
      id: 'inactive',
      label: 'Inativas nesta página',
      value: countLabel(inactive, ready),
      hint: 'blocked, inactive ou disabled',
      tone: inactive != null && inactive > 0 ? 'warn' : undefined,
    },
    {
      id: 'paid',
      label: 'Com pedido pago',
      value: countLabel(withPaid, ready),
      hint: 'paidOrdersCount > 0 nesta página',
    },
  ];

  const alerts: PrimeAttentionItem[] = [];
  const signals: PrimeAttentionItem[] = [];
  if (ready && inactive != null && inactive > 0) {
    alerts.push(
      attention({
        code: 'customers_inactive',
        severity: 'warn',
        message: `${inactive} cliente(s) inativo(s) ou bloqueado(s) nesta página`,
        count: inactive,
        recommendedAction: 'Abrir o histórico. Esta tela não desbloqueia conta.',
        ctaHint: '→ lista de clientes',
      }),
    );
  }
  if (ready && total != null && shown != null && total > shown) {
    signals.push(
      attention({
        code: 'customers_truncated',
        severity: 'info',
        message: `A busca tem ${total} cliente(s); esta página mostra ${shown}`,
        count: total - shown,
        recommendedAction: 'Refine a busca. Não há paginação além de take 50.',
        evidenceLine: 'GET /admin/customers?take=50',
      }),
    );
  }
  if (ready && noPhone != null && noPhone > 0 && shown != null) {
    signals.push(
      attention({
        code: 'customers_no_phone',
        severity: 'info',
        message: `${noPhone} cliente(s) nesta página sem telefone`,
        count: noPhone,
        recommendedAction: 'Somente leitura. O telefone não é editado aqui.',
        ctaHint: '→ lista de clientes',
      }),
    );
  }

  return {
    summary,
    kpis,
    attention: alerts,
    signals,
    actions: [
      { id: 'search', label: 'Buscar cliente', hint: 'Nome, e-mail ou telefone', figure: null },
      {
        id: 'list',
        label: 'Ver a página',
        hint: 'Cadastro carregado',
        figure: figure(shown, ready, 'na página'),
      },
      {
        id: 'pedidos',
        label: 'Abrir Pedidos',
        hint: 'A fila de pedidos já existe',
        figure: null,
      },
    ],
  };
}

export function fretePrimeModel(input: {
  load: PrimeLoad;
  settings: { freeAbove?: unknown; defaultFee?: unknown; defaultDays?: unknown } | null;
  rules: Array<{ active?: boolean | null }> | null;
}): PrimeSectionModel {
  const ready = input.load === 'ready';
  const settings = ready ? input.settings : null;
  const rules = ready ? input.rules : null;
  const activeFlags = rules ? rules.map((rule) => (typeof rule.active === 'boolean' ? rule.active : null)) : null;
  const active = activeFlags ? boolCount(activeFlags) : null;
  const totalRules = rules ? rules.length : null;
  const freeAbove = settings ? moneyOrDash(settings.freeAbove) : ENTERPRISE_MISSING;
  const defaultFee = settings ? moneyOrDash(settings.defaultFee) : ENTERPRISE_MISSING;
  const defaultDays = settings ? countOrDash(finiteInt(settings.defaultDays)) : ENTERPRISE_MISSING;

  const summary = loadSummary(
    input.load,
    [
      settings ? `Grátis a partir de ${freeAbove}.` : 'A configuração padrão não veio.',
      totalRules == null ? 'As zonas não vieram.' : `${totalRules} zona(s).`,
      active == null ? 'Zonas ativas não puderam ser contadas.' : `${active} ativa(s).`,
    ].join(' '),
  );

  const alerts: PrimeAttentionItem[] = [];
  const signals: PrimeAttentionItem[] = [];
  if (ready && totalRules === 0) {
    signals.push(
      attention({
        code: 'shipping_no_zones',
        severity: 'info',
        message: 'Nenhuma zona de CEP. Sem zona de taxa zero, nenhum CEP fica grátis por regra — o cliente vê a cotação.',
        count: 0,
        recommendedAction: 'Manter as zonas 90 e 91 se Porto Alegre continuar grátis.',
        ctaHint: '→ zonas por CEP',
      }),
    );
  }
  if (ready && totalRules != null && totalRules > 0 && active === 0) {
    alerts.push(
      attention({
        code: 'shipping_no_active_zone',
        severity: 'warn',
        message: 'Nenhuma zona ativa. Sem zona de taxa zero, Porto Alegre deixa de ficar grátis por regra.',
        count: 0,
        recommendedAction: 'Reativar as zonas 90 e 91 ou criar outra zona grátis.',
        ctaHint: '→ zonas por CEP',
      }),
    );
  }

  return {
    summary,
    kpis: [
      { id: 'free', label: 'Frete grátis a partir de', value: ready ? freeAbove : ENTERPRISE_MISSING, hint: 'settings.freeAbove' },
      { id: 'fee', label: 'Taxa padrão', value: ready ? defaultFee : ENTERPRISE_MISSING, hint: 'settings.defaultFee' },
      { id: 'days', label: 'Prazo padrão', value: ready ? defaultDays : ENTERPRISE_MISSING, hint: 'dias' },
      {
        id: 'zones',
        label: 'Zonas ativas',
        value: countLabel(active, ready),
        hint: totalRules == null || !ready ? 'regras' : `${totalRules} no total`,
        tone: active === 0 && totalRules != null && totalRules > 0 ? 'warn' : undefined,
      },
    ],
    attention: alerts,
    signals,
    actions: [
      { id: 'settings', label: 'Configuração padrão', hint: 'PATCH /admin/shipping/settings', figure: null },
      {
        id: 'zones',
        label: 'Zonas por CEP',
        hint: 'POST /admin/shipping/rules',
        figure: figure(active, ready, 'ativa(s)'),
      },
    ],
  };
}

export function vitrinePrimeModel(input: {
  load: PrimeLoad;
  banners: Array<{ active?: boolean | null }> | null;
  seo: { siteTitle?: string | null; ogImageUrl?: string | null } | null;
  opsReady: boolean;
  uploads: { persistent?: boolean; dir?: string | null } | null | undefined;
  uploadsAlert?: {
    code?: string | null;
    severity?: string | null;
    message?: string | null;
    count?: number | null;
    recommendedAction?: string | null;
  } | null;
}): PrimeSectionModel {
  const ready = input.load === 'ready';
  const banners = ready ? input.banners : null;
  const total = banners ? banners.length : null;
  const activeFlags = banners
    ? banners.map((banner) => (typeof banner.active === 'boolean' ? banner.active : null))
    : null;
  const active = activeFlags ? boolCount(activeFlags) : null;
  const inactive = total != null && active != null ? total - active : null;
  const title = ready && input.seo ? textOrDash(input.seo.siteTitle) : ENTERPRISE_MISSING;
  const uploadsLabel = input.opsReady ? opsUploadsStatusLabel(input.uploads) : null;

  const summary = loadSummary(
    input.load,
    [
      total == null ? 'Os banners não vieram.' : `${total} banner(s).`,
      active == null ? 'Ativos não puderam ser contados.' : `${active} ativo(s) na home.`,
      uploadsLabel ? uploadsLabel : 'Disco de upload não veio neste snapshot.',
    ].join(' '),
  );

  const alerts: PrimeAttentionItem[] = [];
  const signals: PrimeAttentionItem[] = [];
  if (ready && active === 0) {
    alerts.push(
      attention({
        code: 'banners_none_active',
        severity: 'warn',
        message: '0 banner(s) ativo(s) na home',
        count: 0,
        recommendedAction: 'Ativar um banner existente ou criar outro, até o limite já aplicado.',
        ctaHint: '→ banners da home',
      }),
    );
  }
  if (ready && total != null && total >= MAX_HOME_BANNERS) {
    signals.push(
      attention({
        code: 'banners_at_cap',
        severity: 'info',
        message: `Limite de ${MAX_HOME_BANNERS} banners atingido`,
        count: total,
        recommendedAction: 'Edite ou exclua um banner para adicionar outro.',
        ctaHint: '→ banners da home',
      }),
    );
  }
  if (ready && input.seo && !String(input.seo.ogImageUrl || '').trim()) {
    signals.push(
      attention({
        code: 'seo_og_missing',
        severity: 'info',
        message: 'Imagem Open Graph vazia',
        count: 0,
        recommendedAction: 'Cole uma URL ou deixe em branco. A loja não inventa a imagem.',
        ctaHint: '→ SEO da loja',
      }),
    );
  }
  const uploadAlert = input.uploadsAlert;
  if (input.opsReady && uploadAlert && uploadAlert.code === 'uploads_ephemeral') {
    alerts.push(
      attention({
        code: 'uploads_ephemeral',
        severity: uploadAlert.severity === 'critical' || uploadAlert.severity === 'high' ? uploadAlert.severity : 'warn',
        message: textOrDash(uploadAlert.message),
        count: finiteInt(uploadAlert.count),
        recommendedAction:
          textOrDash(uploadAlert.recommendedAction) === ENTERPRISE_MISSING
            ? 'O snapshot não trouxe a ação recomendada.'
            : String(uploadAlert.recommendedAction),
        evidenceLine: uploadsLabel,
        ctaHint: '→ banners da home',
      }),
    );
  }

  return {
    summary,
    kpis: [
      { id: 'banners', label: 'Banners', value: countLabel(total, ready), hint: `limite ${MAX_HOME_BANNERS}` },
      {
        id: 'active',
        label: 'Ativos na home',
        value: countLabel(active, ready),
        hint: 'entram no carrossel',
        tone: active === 0 ? 'warn' : undefined,
      },
      { id: 'inactive', label: 'Inativos', value: countLabel(inactive, ready), hint: 'fora do carrossel' },
      {
        id: 'uploads',
        label: 'Disco de upload',
        value: uploadsLabel || ENTERPRISE_MISSING,
        hint: input.opsReady ? 'GET /admin/ops uploads' : 'aguardando snapshot',
        tone: uploadAlert?.code === 'uploads_ephemeral' ? 'warn' : undefined,
      },
    ],
    attention: alerts,
    signals,
    actions: [
      { id: 'seo', label: 'SEO da loja', hint: title === ENTERPRISE_MISSING ? 'PATCH /admin/store/settings' : title, figure: null },
      {
        id: 'banners',
        label: 'Banners da home',
        hint: 'POST/PATCH /admin/banners',
        figure: figure(active, ready, 'ativo(s)'),
      },
    ],
  };
}

export function cuponsPrimeModel(input: {
  load: PrimeLoad;
  coupons: Array<{
    active?: boolean | null;
    startsAt?: string | null;
    endsAt?: string | null;
    maxUses?: number | null;
    usedCount?: number | null;
    reservedCount?: number | null;
  }> | null;
  now?: number;
}): PrimeSectionModel {
  const ready = input.load === 'ready';
  const coupons = ready ? input.coupons : null;
  const now = input.now ?? Date.now();
  const total = coupons ? coupons.length : null;
  const activeFlags = coupons ? coupons.map((row) => (typeof row.active === 'boolean' ? row.active : null)) : null;
  const active = activeFlags ? boolCount(activeFlags) : null;
  const inactive = total != null && active != null ? total - active : null;
  const uses = coupons
    ? coupons.every((row) => finiteInt(row.usedCount) != null)
      ? coupons.reduce((sum, row) => sum + (finiteInt(row.usedCount) as number), 0)
      : null
    : null;
  const reserved = coupons
    ? coupons.every((row) => finiteInt(row.reservedCount) != null)
      ? coupons.reduce((sum, row) => sum + (finiteInt(row.reservedCount) as number), 0)
      : null
    : null;
  const expiredActive = coupons
    ? coupons.filter((row) => row.active === true && couponIsExpired(row.endsAt, now)).length
    : null;
  const exhaustedActive = coupons
    ? coupons.filter((row) => {
        if (row.active !== true || row.maxUses == null) return false;
        if (finiteInt(row.usedCount) == null || finiteInt(row.maxUses) == null) return false;
        return couponIsExhausted(row.maxUses, row.usedCount);
      }).length
    : null;
  const notStarted = coupons
    ? coupons.filter((row) => row.active === true && couponNotStarted(row.startsAt, now)).length
    : null;

  const summary = loadSummary(
    input.load,
    [
      total == null ? 'A lista de cupons não veio.' : `${total} cupom(ns).`,
      active == null ? 'Ativos não puderam ser contados.' : `${active} ativo(s).`,
      expiredActive == null ? '' : `${expiredActive} ativo(s) expirado(s).`,
    ]
      .filter(Boolean)
      .join(' '),
  );

  const alerts: PrimeAttentionItem[] = [];
  const signals: PrimeAttentionItem[] = [];
  if (ready && expiredActive != null && expiredActive > 0) {
    alerts.push(
      attention({
        code: 'coupons_expired_active',
        severity: 'warn',
        message: `${expiredActive} cupom(ns) ativo(s) com validade vencida`,
        count: expiredActive,
        recommendedAction: 'Desativar o código se ele não deve mais valer.',
        ctaHint: '→ lista de cupons',
      }),
    );
  }
  if (ready && exhaustedActive != null && exhaustedActive > 0) {
    alerts.push(
      attention({
        code: 'coupons_exhausted_active',
        severity: 'warn',
        message: `${exhaustedActive} cupom(ns) ativo(s) no limite de usos`,
        count: exhaustedActive,
        recommendedAction: 'Desativar ou conferir o limite. O uso não é inventado.',
        ctaHint: '→ lista de cupons',
      }),
    );
  }
  if (ready && notStarted != null && notStarted > 0) {
    signals.push(
      attention({
        code: 'coupons_not_started',
        severity: 'info',
        message: `${notStarted} cupom(ns) ativo(s) com início no futuro`,
        count: notStarted,
        recommendedAction: 'O código já existe. A sacola só aceita depois de startsAt.',
        ctaHint: '→ lista de cupons',
      }),
    );
  }

  return {
    summary,
    kpis: [
      { id: 'total', label: 'Cupons', value: countLabel(total, ready), hint: 'GET /admin/coupons' },
      { id: 'active', label: 'Ativos', value: countLabel(active, ready), hint: 'active true' },
      { id: 'uses', label: 'Usos', value: countLabel(uses, ready), hint: 'soma de usedCount' },
      {
        id: 'reserved',
        label: 'Reservados',
        value: countLabel(reserved, ready),
        hint: inactive == null ? 'reservedCount' : `${inactive} inativo(s)`,
      },
    ],
    attention: alerts,
    signals,
    actions: [
      { id: 'create', label: 'Novo cupom', hint: 'POST /admin/coupons', figure: null },
      {
        id: 'list',
        label: 'Lista de cupons',
        hint: 'PATCH /admin/coupons/:id',
        figure: figure(active, ready, 'ativo(s)'),
      },
    ],
  };
}

export function equipePrimeModel(input: {
  load: PrimeLoad;
  admins: Array<{ status?: string | null; role?: string | null }> | null;
}): PrimeSectionModel {
  const ready = input.load === 'ready';
  const admins = ready ? input.admins : null;
  const total = admins ? admins.length : null;
  const statusFlags = admins
    ? admins.map((row) => {
        const status = String(row.status || '').trim().toLowerCase();
        if (!status) return null;
        return status === 'active';
      })
    : null;
  const active = statusFlags ? boolCount(statusFlags) : null;
  const inactive = total != null && active != null ? total - active : null;
  const roles = admins ? new Set(admins.map((row) => textOrDash(row.role))).size : null;

  const summary = loadSummary(
    input.load,
    [
      total == null ? 'A equipe não veio.' : `${total} administrador(es).`,
      active == null ? 'Ativos não puderam ser contados.' : `${active} ativo(s).`,
    ].join(' '),
  );

  const alerts: PrimeAttentionItem[] = [];
  const signals: PrimeAttentionItem[] = [];
  if (ready && active === 0) {
    alerts.push(
      attention({
        code: 'admins_none_active',
        severity: 'critical',
        message: '0 administrador(es) ativo(s)',
        count: 0,
        recommendedAction: 'Criar ou reativar uma conta. Esta tela não cria papel novo.',
        ctaHint: '→ equipe',
      }),
    );
  }
  if (ready && inactive != null && inactive > 0) {
    signals.push(
      attention({
        code: 'admins_inactive',
        severity: 'info',
        message: `${inactive} administrador(es) desativado(s)`,
        count: inactive,
        recommendedAction: 'Reativar se a pessoa volta a entrar. O cadastro não é apagado.',
        ctaHint: '→ equipe',
      }),
    );
  }

  return {
    summary,
    kpis: [
      { id: 'total', label: 'Equipe', value: countLabel(total, ready), hint: 'GET /admin/admins' },
      { id: 'active', label: 'Ativos', value: countLabel(active, ready), hint: 'status active', tone: active === 0 ? 'danger' : undefined },
      { id: 'inactive', label: 'Desativados', value: countLabel(inactive, ready), hint: 'login impedido' },
      {
        id: 'roles',
        label: 'Papeis distintos',
        value: countLabel(roles, ready),
        hint: 'campo role, sem permissão nova',
      },
    ],
    attention: alerts,
    signals,
    actions: [
      { id: 'create', label: 'Novo administrador', hint: 'POST /admin/admins', figure: null },
      {
        id: 'list',
        label: 'Lista da equipe',
        hint: 'PATCH /admin/admins/:id/status',
        figure: figure(active, ready, 'ativo(s)'),
      },
    ],
  };
}

export function avaliacoesPrimeModel(input: {
  load: PrimeLoad;
  reviews: Array<{ status?: string | null; rating?: unknown }> | null;
}): PrimeSectionModel {
  const ready = input.load === 'ready';
  const reviews = ready ? input.reviews : null;
  const total = reviews ? reviews.length : null;
  const published = reviews
    ? reviews.every((row) => String(row.status || '').trim())
      ? reviews.filter((row) => String(row.status).trim().toLowerCase() === 'published').length
      : null
    : null;
  const hidden = reviews
    ? reviews.every((row) => String(row.status || '').trim())
      ? reviews.filter((row) => String(row.status).trim().toLowerCase() === 'hidden').length
      : null
    : null;
  let average: string = ENTERPRISE_MISSING;
  if (ready && reviews && reviews.length) {
    const ratings = reviews.map((row) =>
      typeof row.rating === 'number' && Number.isFinite(row.rating) ? row.rating : null,
    );
    if (ratings.every((rating) => rating != null)) {
      const avg = (ratings as number[]).reduce((sum, rating) => sum + rating, 0) / ratings.length;
      average = avg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
  }

  const summary = loadSummary(
    input.load,
    [
      total == null ? 'As avaliações não vieram.' : `${total} avaliação(ões).`,
      published == null ? 'Publicadas não puderam ser contadas.' : `${published} publicada(s).`,
      hidden == null ? '' : `${hidden} oculta(s).`,
    ]
      .filter(Boolean)
      .join(' '),
  );

  const signals: PrimeAttentionItem[] = [];
  if (ready && hidden != null && hidden > 0) {
    signals.push(
      attention({
        code: 'reviews_hidden',
        severity: 'info',
        message: `${hidden} avaliação(ões) oculta(s)`,
        count: hidden,
        recommendedAction: 'Publicar de novo ou excluir. Não há fila de aprovação além destes status.',
        ctaHint: '→ avaliações',
      }),
    );
  }

  return {
    summary,
    kpis: [
      { id: 'total', label: 'Avaliações', value: countLabel(total, ready), hint: 'GET /admin/reviews' },
      { id: 'published', label: 'Publicadas', value: countLabel(published, ready), hint: 'status published' },
      { id: 'hidden', label: 'Ocultas', value: countLabel(hidden, ready), hint: 'status hidden' },
      { id: 'average', label: 'Nota média', value: ready ? average : ENTERPRISE_MISSING, hint: 'só se toda nota veio' },
    ],
    attention: [],
    signals,
    actions: [
      {
        id: 'list',
        label: 'Moderar lista',
        hint: 'PATCH /admin/reviews/:id',
        figure: figure(hidden, ready, 'oculta(s)'),
      },
    ],
  };
}

const MAIL_ALERT_CODES = new Set([
  'store_notify_mail_failed',
  'mail_off_with_store_notify',
  'mail_not_configured',
]);

function mailAlertSeverity(value: unknown): PrimeAttentionItem['severity'] | null {
  const severity = String(value || '').trim().toLowerCase();
  if (severity === 'critical' || severity === 'high' || severity === 'warn' || severity === 'info') return severity;
  return null;
}

export function notificacoesPrimeModel(input: {
  load: PrimeLoad;
  enabledDevices: number | null;
  firebaseConfigured: boolean | null;
  firebaseProjectId?: string | null;
  campaigns: Array<{ status?: string | null }> | null;
  campaignTotal?: number | null;
  tokenCount: number | null;
  abandoned: { openViews?: unknown; dueViews?: unknown; sentLast7Days?: unknown } | null;
  opsReady?: boolean;
  mail?: {
    configured?: boolean;
    providerOffWithStoreNotify?: boolean;
    storeNotifyFailureCount?: number | null;
    lastPublicId?: string | null;
  } | null;
  mailAlerts?: Array<{
    code?: string | null;
    severity?: string | null;
    message?: string | null;
    count?: number | null;
    recommendedAction?: string | null;
  }> | null;
}): PrimeSectionModel {
  const ready = input.load === 'ready';
  const devices = ready ? finiteInt(input.enabledDevices) : null;
  const tokens = ready ? finiteInt(input.tokenCount) : null;
  const campaigns = ready ? input.campaigns : null;
  const pageCount = campaigns ? campaigns.length : null;
  const reportedTotal = ready ? finiteInt(input.campaignTotal) : null;
  const campaignKpi = reportedTotal != null ? reportedTotal : pageCount;
  const statusOf = (row: { status?: string | null }) => String(row.status || '').trim().toLowerCase();
  const failed = campaigns ? campaigns.filter((row) => statusOf(row) === 'failed').length : null;
  const scheduled = campaigns ? campaigns.filter((row) => statusOf(row) === 'scheduled').length : null;
  const sending = campaigns ? campaigns.filter((row) => statusOf(row) === 'sending').length : null;
  const sendable =
    scheduled != null && sending != null ? scheduled + sending : null;
  const abandoned = ready ? input.abandoned : null;
  const openViews = abandoned ? finiteInt(abandoned.openViews) : null;
  const dueViews = abandoned ? finiteInt(abandoned.dueViews) : null;
  const sent7 = abandoned ? finiteInt(abandoned.sentLast7Days) : null;
  const firebase = ready ? input.firebaseConfigured : null;
  const projectId = ready ? String(input.firebaseProjectId || '').trim() : '';
  const opsReady = input.opsReady === true;
  const mail = opsReady ? input.mail : null;
  const mailKnown =
    mail != null &&
    (typeof mail.configured === 'boolean' ||
      mail.providerOffWithStoreNotify === true ||
      (finiteInt(mail.storeNotifyFailureCount) != null && (finiteInt(mail.storeNotifyFailureCount) as number) > 0));
  const mailStatus = opsMailStatusLabel(mailKnown ? mail : null, opsReady && mailKnown);
  const lastPublicId = String(mail?.lastPublicId || '').trim();

  const summary = loadSummary(
    input.load,
    [
      devices == null ? 'Aparelhos ativos não vieram.' : `${devices} aparelho(s) ativo(s).`,
      firebase == null ? 'Firebase não veio no payload.' : firebase ? 'Firebase pronto.' : 'Firebase ausente.',
      dueViews == null ? 'Recuperação automática sem contagem.' : `${dueViews} visita(s) com atraso cumprido.`,
      !opsReady
        ? 'E-mail da loja aguarda GET /admin/ops.'
        : mail == null
          ? 'E-mail da loja não veio no snapshot.'
          : `E-mail da loja: ${mailStatus.label}.`,
    ].join(' '),
  );

  const alerts: PrimeAttentionItem[] = [];
  const signals: PrimeAttentionItem[] = [];
  if (ready && firebase === false) {
    alerts.push(
      attention({
        code: 'push_firebase_off',
        severity: 'high',
        message: 'Firebase ausente — o push não sai',
        count: 0,
        recommendedAction: 'Configure FIREBASE_SERVICE_ACCOUNT_JSON no Railway. A campanha pode ser gravada.',
        ctaHint: '→ nova campanha',
      }),
    );
  }
  if (ready && failed != null && failed > 0) {
    alerts.push(
      attention({
        code: 'push_campaigns_failed',
        severity: 'warn',
        message: `${failed} campanha(s) com status failed`,
        count: failed,
        recommendedAction: 'Conferir o histórico. Campanha já encerrada não dispara de novo.',
        ctaHint: '→ histórico',
      }),
    );
  }
  if (opsReady && input.mailAlerts) {
    for (const alert of input.mailAlerts) {
      const code = String(alert.code || '').trim();
      if (!MAIL_ALERT_CODES.has(code)) continue;
      const severity = mailAlertSeverity(alert.severity);
      const message = String(alert.message || '').trim();
      if (!severity || !message) continue;
      const item = attention({
        code,
        severity,
        message,
        count: finiteInt(alert.count),
        recommendedAction: String(alert.recommendedAction || '').trim() || ENTERPRISE_MISSING,
        evidenceLine: code === 'store_notify_mail_failed' && lastPublicId ? `último ${lastPublicId}` : null,
        ctaHint: '→ e-mail da loja',
      });
      if (severity === 'info') signals.push(item);
      else alerts.push(item);
    }
  }
  if (ready && scheduled != null && scheduled > 0) {
    signals.push(
      attention({
        code: 'push_scheduled',
        severity: 'info',
        message: `${scheduled} campanha(s) agendada(s)`,
        count: scheduled,
        recommendedAction:
          'Disparar agora pede confirmação e chama POST /admin/push/campaigns/:id/send. Cancelar continua nesta lista. A recuperação de produto não dispara.',
        ctaHint: '→ histórico',
      }),
    );
  }
  if (ready && sending != null && sending > 0) {
    signals.push(
      attention({
        code: 'push_sending',
        severity: 'info',
        message: `${sending} campanha(s) ainda em envio`,
        count: sending,
        recommendedAction:
          'Disparar agora retoma POST /admin/push/campaigns/:id/send se a API ainda aceitar. Não cria outra campanha.',
        ctaHint: '→ histórico',
      }),
    );
  }
  if (ready && dueViews != null && dueViews > 0) {
    signals.push(
      attention({
        code: 'push_abandoned_due',
        severity: 'info',
        message: `${dueViews} visita(s) com atraso cumprido na recuperação automática`,
        count: dueViews,
        recommendedAction: 'Esta tela não dispara essa mensagem.',
        evidenceLine: 'GET /admin/push/abandoned-views',
      }),
    );
  }

  const firebaseValue =
    !ready || firebase == null ? ENTERPRISE_MISSING : firebase ? 'Pronto' : 'Ausente';
  const campaignHint =
    reportedTotal != null && pageCount != null && reportedTotal !== pageCount
      ? `${pageCount} nesta página`
      : 'histórico carregado';

  return {
    summary,
    kpis: [
      { id: 'devices', label: 'Aparelhos ativos', value: countLabel(devices, ready), hint: 'enabledDevices' },
      {
        id: 'firebase',
        label: 'Firebase',
        value: firebaseValue,
        hint: projectId ? `projeto ${projectId}` : 'sem segredo',
        tone: firebase === false ? 'danger' : undefined,
      },
      { id: 'campaigns', label: 'Campanhas', value: countLabel(campaignKpi, ready), hint: campaignHint },
      {
        id: 'abandoned',
        label: 'Atraso cumprido',
        value: countLabel(dueViews, ready),
        hint:
          openViews == null || sent7 == null
            ? 'GET /admin/push/abandoned-views'
            : `${openViews} em aberto · ${sent7} em 7 dias`,
      },
      {
        id: 'mail',
        label: 'E-mail da loja',
        value: mailStatus.label,
        hint: opsReady ? 'GET /admin/ops mail' : 'aguardando snapshot',
        tone: mailStatus.tone === 'danger' ? 'danger' : undefined,
      },
    ],
    attention: alerts,
    signals,
    actions: [
      { id: 'create', label: 'Nova campanha', hint: 'POST /admin/push/campaigns', figure: figure(devices, ready, 'aparelho(s)') },
      {
        id: 'send',
        label: 'Disparar agendada',
        hint: 'POST /admin/push/campaigns/:id/send',
        figure: figure(sendable, ready, 'pronta(s)'),
      },
      {
        id: 'history',
        label: 'Histórico',
        hint: 'cancelar só agendada',
        figure: figure(scheduled, ready, 'agendada(s)'),
      },
      {
        id: 'tokens',
        label: 'Aparelhos',
        hint: 'POST /admin/push/test',
        figure: figure(tokens, ready, 'token(s)'),
      },
      {
        id: 'mail',
        label: 'E-mail da loja',
        hint: 'somente leitura',
        figure: opsReady && mailStatus.label !== ENTERPRISE_MISSING ? mailStatus.label : null,
      },
    ],
  };
}

export function marketplacePrimeModel(input: {
  load: PrimeLoad;
  sellers: Array<{
    status?: string | null;
    mpOAuthStatus?: string | null;
    _count?: { products?: number | null } | null;
  }> | null;
  commissions: Array<{ status?: string | null; amount?: unknown }> | null;
  commissionFilter: string;
}): PrimeSectionModel {
  const ready = input.load === 'ready';
  const sellers = ready ? input.sellers : null;
  const commissions = ready ? input.commissions : null;
  const sellerTotal = sellers ? sellers.length : null;
  const statusOf = (row: { status?: string | null }) => String(row.status || '').trim().toLowerCase();
  const sellersKnown = sellers ? sellers.every((row) => statusOf(row)) : false;
  const active = sellers && sellersKnown ? sellers.filter((row) => statusOf(row) === 'active').length : sellers ? null : null;
  const pending = sellers && sellersKnown ? sellers.filter((row) => statusOf(row) === 'pending').length : sellers ? null : null;
  const suspended = sellers && sellersKnown ? sellers.filter((row) => statusOf(row) === 'suspended').length : sellers ? null : null;
  const mpOf = (row: { mpOAuthStatus?: string | null }) => String(row.mpOAuthStatus || '').trim().toLowerCase();
  const mpProblem = sellers
    ? sellers.filter((row) => mpOf(row) === 'expired' || mpOf(row) === 'revoked').length
    : null;
  const activeUnlinked = sellers && sellersKnown
    ? sellers.filter((row) => statusOf(row) === 'active' && mpOf(row) !== 'linked' && mpOf(row) !== 'expired' && mpOf(row) !== 'revoked').length
    : null;
  const productCounts = sellers
    ? sellers.map((row) => finiteInt(row._count?.products))
    : null;
  const linkedProducts = productCounts && productCounts.every((count) => count != null)
    ? (productCounts as number[]).reduce((sum, count) => sum + count, 0)
    : null;

  const filter = String(input.commissionFilter || '').trim().toLowerCase() || 'pending';
  const filterSeesPending = filter === 'pending' || filter === 'all';
  const pendingRows = commissions
    ? commissions.filter((row) => String(row.status || '').trim().toLowerCase() === 'pending')
    : null;
  const pendingCommissionCount = pendingRows && filterSeesPending ? pendingRows.length : filterSeesPending ? null : null;
  let pendingAmount: number | null = null;
  if (pendingRows && filterSeesPending) {
    pendingAmount = 0;
    for (const row of pendingRows) {
      const amount = typeof row.amount === 'number' ? row.amount : Number(String(row.amount ?? '').trim());
      if (!Number.isFinite(amount)) {
        pendingAmount = null;
        break;
      }
      pendingAmount += amount;
    }
    if (pendingAmount != null) pendingAmount = Math.round(pendingAmount * 100) / 100;
  }

  const summary = loadSummary(
    input.load,
    [
      sellerTotal == null ? 'Os vendedores não vieram.' : `${sellerTotal} vendedor(es).`,
      pending == null ? 'Pendentes não puderam ser contados.' : `${pending} pendente(s).`,
      filterSeesPending
        ? pendingCommissionCount == null
          ? 'Comissões pendentes deste filtro não puderam ser contadas.'
          : `${pendingCommissionCount} comissão(ões) pendente(s) neste filtro.`
        : `Filtro ${filter}: esta lista não mede comissão pendente.`,
    ].join(' '),
  );

  const alerts: PrimeAttentionItem[] = [];
  const signals: PrimeAttentionItem[] = [];
  if (ready && pending != null && pending > 0) {
    alerts.push(
      attention({
        code: 'sellers_pending',
        severity: 'warn',
        message: `${pending} vendedor(es) pendente(s)`,
        count: pending,
        recommendedAction: 'Ativar ou deixar pendente. Não há status novo.',
        ctaHint: '→ vendedores',
      }),
    );
  }
  if (ready && mpProblem != null && mpProblem > 0) {
    alerts.push(
      attention({
        code: 'sellers_mp_problem',
        severity: 'high',
        message: `${mpProblem} vendedor(es) com MP expirado ou revogado`,
        count: mpProblem,
        recommendedAction: 'Conferir o vínculo. Esta tela não grava no Mercado Pago.',
        ctaHint: '→ vendedores',
      }),
    );
  }
  if (ready && activeUnlinked != null && activeUnlinked > 0) {
    alerts.push(
      attention({
        code: 'sellers_active_unlinked',
        severity: 'warn',
        message: `${activeUnlinked} vendedor(es) ativo(s) sem MP vinculado`,
        count: activeUnlinked,
        recommendedAction: 'Sem vínculo, o valor integral fica na conta da loja. Não há OAuth novo nesta tela.',
        ctaHint: '→ vendedores',
      }),
    );
  }
  if (ready && filterSeesPending && pendingCommissionCount != null && pendingCommissionCount > 0) {
    signals.push(
      attention({
        code: 'commissions_pending',
        severity: 'info',
        message: `${pendingCommissionCount} comissão(ões) pendente(s) neste filtro`,
        count: pendingCommissionCount,
        recommendedAction: 'Aprovar ou marcar pago no ledger. Não cobra e não estorna.',
        evidenceLine: pendingAmount == null ? null : moneyOrDash(pendingAmount),
        ctaHint: '→ comissões',
      }),
    );
  }

  return {
    summary,
    kpis: [
      { id: 'sellers', label: 'Vendedores', value: countLabel(sellerTotal, ready), hint: 'GET /admin/sellers' },
      { id: 'active', label: 'Ativos', value: countLabel(active, ready), hint: 'status active' },
      {
        id: 'pending',
        label: 'Pendentes',
        value: countLabel(pending, ready),
        hint: suspended == null ? 'status pending' : `${suspended} suspenso(s)`,
        tone: pending != null && pending > 0 ? 'warn' : undefined,
      },
      {
        id: 'products',
        label: 'Produtos vinculados',
        value: countLabel(linkedProducts, ready),
        hint: '_count.products em cada vendedor',
      },
    ],
    attention: alerts,
    signals,
    actions: [
      { id: 'create', label: 'Novo vendedor', hint: 'POST /admin/sellers', figure: null },
      {
        id: 'sellers',
        label: 'Vendedores',
        hint: 'status, dono e comissão %',
        figure: figure(active, ready, 'ativo(s)'),
      },
      {
        id: 'commissions',
        label: 'Comissões deste filtro',
        hint: `GET /admin/commissions?status=${filter}`,
        figure: figure(filterSeesPending ? pendingCommissionCount : null, ready, 'pendente(s)'),
      },
    ],
  };
}
