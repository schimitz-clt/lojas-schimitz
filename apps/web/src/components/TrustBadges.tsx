/** Trust / benefits row — home storefront (not Magalu branding). */
export function TrustBadges() {
  return (
    <ul className="trust-row" aria-label="Vantagens da loja">
      <li>
        <span className="trust-icon" aria-hidden="true">
          🚚
        </span>
        <div>
          <strong>Frete grátis POA</strong>
          <span className="muted">Entrega em Porto Alegre</span>
        </div>
      </li>
      <li>
        <span className="trust-icon" aria-hidden="true">
          💳
        </span>
        <div>
          <strong>PIX 5% off</strong>
          <span className="muted">ou até 12x sem juros</span>
        </div>
      </li>
      <li>
        <span className="trust-icon" aria-hidden="true">
          ↩️
        </span>
        <div>
          <strong>Troca em 7 dias</strong>
          <span className="muted">Direito a arrependimento</span>
        </div>
      </li>
      <li>
        <span className="trust-icon" aria-hidden="true">
          💬
        </span>
        <div>
          <strong>Atendimento</strong>
          <span className="muted">Chat no site ou WhatsApp</span>
        </div>
      </li>
    </ul>
  );
}
