/** Benefícios reais da loja — home. */
const ITEMS = [
  {
    ico: '🚚',
    title: 'Frete grátis em POA',
    sub: 'Entrega própria em Porto Alegre',
  },
  {
    ico: '💠',
    title: '5% off no PIX',
    sub: 'Desconto automático no checkout',
  },
  {
    ico: '💳',
    title: 'Até 12x sem juros',
    sub: 'Via Mercado Pago',
  },
  {
    ico: '🔁',
    title: 'Troca em 7 dias',
    sub: 'Compra com tranquilidade',
  },
] as const;

export function TrustBadges() {
  return (
    <ul className="trust-row" aria-label="Vantagens da loja">
      {ITEMS.map((item) => (
        <li key={item.title}>
          <span className="trust-icon" aria-hidden="true">
            {item.ico}
          </span>
          <div>
            <strong>{item.title}</strong>
            <span className="muted">{item.sub}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
