/** Benefícios reais da loja — home. */
export function TrustBadges() {
  return (
    <ul className="trust-row" aria-label="Vantagens da loja">
      <li>
        <span className="trust-icon" aria-hidden="true">
          🚚
        </span>
        <div>
          <strong>Entrega rápida</strong>
          <span className="muted">Frete grátis em Porto Alegre</span>
        </div>
      </li>
      <li>
        <span className="trust-icon" aria-hidden="true">
          💳
        </span>
        <div>
          <strong>Pagamento seguro</strong>
          <span className="muted">PIX 5% off ou até 12x</span>
        </div>
      </li>
      <li>
        <span className="trust-icon" aria-hidden="true">
          ⚡
        </span>
        <div>
          <strong>Ofertas todo dia</strong>
          <span className="muted">Preços e estoque reais da loja</span>
        </div>
      </li>
      <li>
        <span className="trust-icon" aria-hidden="true">
          💬
        </span>
        <div>
          <strong>WhatsApp</strong>
          <span className="muted">Atendimento no chat ou no Zap</span>
        </div>
      </li>
    </ul>
  );
}
