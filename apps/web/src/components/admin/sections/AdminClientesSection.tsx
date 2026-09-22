'use client';

import { brl } from '@/lib/api';
import { orderStatusLabel } from '@/lib/order-status';
import { ENTERPRISE_MISSING, moneyOrDash, textOrDash } from '@/lib/admin-enterprise-ui';
import {
  CLIENTES_DO_LEDE,
  CLIENTES_EVIDENCE_LEDE,
  CLIENTES_NOW_LEDE,
  CLIENTES_READONLY_NOTE,
  clientesPrimeModel,
} from '@/lib/admin-prime-sections-ui';
import { AdminPrimeCommand, scrollAdminAnchor } from '@/components/admin/AdminPrimeCommand';
import { AdminOrderStatusChip, AdminStatusChip } from '@/components/admin/AdminStatusChip';
import { customerAccountLabel, customerAccountTone } from '@/lib/admin-pro-ui';
import {
  customerHistoryEmptyMessage,
  customerOrderPaymentLabel,
  customerOrdersEmptyMessage,
  formatAdminDate,
  formatAdminDateTime,
  formatCustomerAddressLine,
  formatCustomerCityUf,
} from '@/lib/admin-customers-ui';
import { useAdminConsole } from '@/components/admin/admin-console-context';

const ANCHOR: Record<string, string> = {
  customers_inactive: 'admin-clientes-list',
  customers_truncated: 'admin-clientes-list',
  customers_no_phone: 'admin-clientes-list',
  search: 'admin-clientes-search',
  list: 'admin-clientes-list',
  total: 'admin-clientes-list',
  shown: 'admin-clientes-list',
  inactive: 'admin-clientes-list',
  paid: 'admin-clientes-list',
};

export function AdminClientesSection() {
  const {
    customers,
    customersTotal,
    customersSnapshot,
    customerQ,
    setCustomerQ,
    customerBusy,
    customerDetail,
    customerDetailBusy,
    loadCustomers,
    openCustomer,
    closeCustomer,
    openPedidoFromCustomer,
  } = useAdminConsole();

  const model = clientesPrimeModel({
    load: customersSnapshot,
    total: customersSnapshot === 'ready' ? customersTotal : null,
    items: customersSnapshot === 'ready' ? customers : null,
  });

  function go(id: string) {
    const anchor = ANCHOR[id];
    if (anchor) scrollAdminAnchor(anchor);
  }

  return (
    <>
      <AdminPrimeCommand
        eyebrow="Clientes"
        title="Cadastro e histórico, só leitura."
        endpoint="GET /admin/customers · GET /admin/customers/:id"
        busy={customerBusy}
        onRefresh={() => void loadCustomers(customerQ)}
        nowLede={CLIENTES_NOW_LEDE}
        summary={model.summary}
        kpis={model.kpis}
        onKpi={go}
        load={customersSnapshot}
        attention={model.attention}
        signals={model.signals}
        onAttention={go}
        doLede={CLIENTES_DO_LEDE}
        actions={model.actions}
        onAction={go}
      />

      <div className="admin-section-panel admin-crm-panel" id="admin-clientes-evidence">
        <p className="admin-ent-kicker">Evidência</p>
        <h2 className="admin-cc-block__title">O que o cadastro mostra</h2>
        <p className="admin-cc-block__lede">{CLIENTES_EVIDENCE_LEDE}</p>
        <p className="admin-ent-note">{CLIENTES_READONLY_NOTE}</p>
        <div className="admin-toolbar admin-crm-toolbar" id="admin-clientes-search">
          <form
            className="admin-toolbar__row"
            onSubmit={(e) => {
              e.preventDefault();
              void loadCustomers(customerQ);
            }}
          >
            <label className="admin-search-field" style={{ flex: 1, minWidth: 200, maxWidth: 'none' }}>
              <span>Buscar (nome, e-mail ou telefone)</span>
              <input
                value={customerQ}
                onChange={(e) => setCustomerQ(e.target.value)}
                placeholder="Ex.: Maria ou 5199…"
              />
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={customerBusy}>
              {customerBusy ? 'Buscando…' : 'Buscar'}
            </button>
            <button
              className="btn ghost admin-btn-ghost-pro"
              type="button"
              disabled={customerBusy}
              onClick={() => {
                setCustomerQ('');
                void loadCustomers('');
              }}
            >
              Limpar
            </button>
          </form>
        </div>
        <div className="admin-crm-layout">
          <div className="admin-crm-list" id="admin-clientes-list">
            <div className="admin-dense-list">
              {customersSnapshot === 'ready'
                ? customers.map((c) => {
                    const selected = customerDetail?.id === c.id;
                    const cityUf = formatCustomerCityUf(c);
                    return (
                      <div key={c.id} className={`admin-dense-row${selected ? ' is-selected' : ''}`}>
                        <div className="admin-dense-row__main">
                          <div className="admin-dense-row__title">
                            <b>{textOrDash(c.name)}</b>
                            <AdminStatusChip
                              label={customerAccountLabel(c.status)}
                              tone={customerAccountTone(c.status)}
                            />
                          </div>
                          <div className="admin-dense-row__meta">
                            {textOrDash(c.email)}
                            {c.phone ? ` · ${c.phone}` : ` · tel. ${ENTERPRISE_MISSING}`}
                            {cityUf ? ` · ${cityUf}` : ''}
                          </div>
                          <div className="admin-dense-row__meta">
                            {c.ordersCount} pedido(s) · pagos {c.paidOrdersCount} · {moneyOrDash(c.paidTotal)}
                            {c.lastOrderAt ? ` · último ${formatAdminDate(c.lastOrderAt)}` : ` · último ${ENTERPRISE_MISSING}`}
                          </div>
                        </div>
                        <div className="admin-dense-row__actions">
                          <button
                            type="button"
                            className="btn ghost admin-btn-ghost-pro"
                            disabled={customerDetailBusy}
                            onClick={() => void openCustomer(c.id)}
                          >
                            {selected ? 'Atualizar' : 'Ver histórico'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                : null}
              {customersSnapshot === 'ready' && !customers.length ? (
                <p className="admin-empty">{customerHistoryEmptyMessage(Boolean(customerQ.trim()))}</p>
              ) : null}
              {customersSnapshot !== 'ready' ? (
                <p className="admin-empty">
                  {customersSnapshot === 'error'
                    ? 'Lista indisponível. Nenhum cliente foi estimado.'
                    : 'Lendo GET /admin/customers…'}
                </p>
              ) : null}
            </div>
          </div>
          {customerDetail ? (
            <div id="admin-customer-detail" className="admin-detail-panel admin-crm-detail">
              <div className="admin-crm-detail__head">
                <h3 style={{ margin: 0 }}>
                  {textOrDash(customerDetail.name)}{' '}
                  <AdminStatusChip
                    label={customerAccountLabel(customerDetail.status)}
                    tone={customerAccountTone(customerDetail.status)}
                  />
                </h3>
                <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={closeCustomer}>
                  Fechar
                </button>
              </div>
              <div className="admin-ent-facts">
                <div className="admin-ent-fact">
                  <span>E-mail</span>
                  <strong>{textOrDash(customerDetail.email)}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Telefone</span>
                  <strong>{textOrDash(customerDetail.phone)}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Cliente desde</span>
                  <strong>{formatAdminDate(customerDetail.createdAt)}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Pedidos</span>
                  <strong>{customerDetail.ordersCount}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Pagos</span>
                  <strong>{customerDetail.paidOrdersCount}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Total pago</span>
                  <strong>{moneyOrDash(customerDetail.paidTotal)}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Último pedido</span>
                  <strong>{formatAdminDate(customerDetail.lastOrderAt)}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>Último pago</span>
                  <strong>{formatAdminDate(customerDetail.lastPaidAt)}</strong>
                </div>
                <div className="admin-ent-fact">
                  <span>SCHIMITZ+</span>
                  <strong>{moneyOrDash(customerDetail.cashbackBalance)}</strong>
                </div>
              </div>
              <div className="admin-crm-addresses">
                <h4 className="admin-crm-subhead">Endereço</h4>
                {(customerDetail.addresses || []).length ? (
                  <ul className="admin-crm-address-list">
                    {(customerDetail.addresses || []).map((a, idx) => (
                      <li key={a.id || `${a.cep}-${idx}`}>
                        {a.isDefault ? <AdminStatusChip label="Padrão" tone="accent" /> : null}
                        {a.label ? <b>{a.label}</b> : null} {formatCustomerAddressLine(a) || ENTERPRISE_MISSING}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-dense-row__meta" style={{ marginTop: 0 }}>
                    Nenhum endereço cadastrado
                    {formatCustomerCityUf(customerDetail)
                      ? ` · cidade no pedido: ${formatCustomerCityUf(customerDetail)}`
                      : '.'}
                  </p>
                )}
              </div>
              <h4 className="admin-crm-subhead">
                Histórico de pedidos
                {customerDetail.orders.length
                  ? ` (${customerDetail.orders.length}${
                      customerDetail.ordersCount > customerDetail.orders.length
                        ? ` de ${customerDetail.ordersCount}`
                        : ''
                    })`
                  : ''}
              </h4>
              <div className="admin-dense-list admin-crm-history">
                {customerDetail.orders.map((o) => (
                  <div key={o.id} className="admin-dense-row admin-crm-order">
                    <div className="admin-dense-row__main">
                      <div className="admin-dense-row__title">
                        <span className="admin-dense-row__code">{o.publicId}</span>
                        <AdminOrderStatusChip status={o.status} label={orderStatusLabel(o.status)} />
                        {o.paymentMethod ? (
                          <AdminStatusChip
                            label={customerOrderPaymentLabel(o.paymentMethod)}
                            tone={o.paymentMethod === 'pix' ? 'ok' : 'info'}
                            title={o.paymentStatus ? `status ${o.paymentStatus}` : undefined}
                          />
                        ) : (
                          <AdminStatusChip label={ENTERPRISE_MISSING} tone="neutral" />
                        )}
                      </div>
                      <div className="admin-dense-row__meta">
                        {brl(o.total)}
                        {o.freight ? ` · frete ${brl(o.freight)}` : ''}
                        {o.discount ? ` · desc. ${brl(o.discount)}` : ''}
                        {' · '}
                        {formatAdminDateTime(o.createdAt)}
                      </div>
                      <div className="admin-dense-row__meta">
                        {o.items.map((it) => `${it.qty}× ${it.name}`).join(', ') || ENTERPRISE_MISSING}
                      </div>
                    </div>
                    <div className="admin-dense-row__actions">
                      <button
                        type="button"
                        className="btn ghost admin-btn-ghost-pro"
                        onClick={() => openPedidoFromCustomer(o.id)}
                      >
                        Ver pedido
                      </button>
                    </div>
                  </div>
                ))}
                {!customerDetail.orders.length ? (
                  <p className="admin-empty">{customerOrdersEmptyMessage()}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="admin-detail-panel admin-crm-detail admin-crm-detail--empty">
              <p className="admin-empty" style={{ margin: 0 }}>
                Selecione um cliente para ver cadastro, endereço e histórico real de pedidos.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
