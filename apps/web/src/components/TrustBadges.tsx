/** Benefícios reais da loja — home. */
const HOME_ITEMS = [
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

/** Honest checkout trust — no invented seals or “100% seguro”. */
const CHECKOUT_ITEMS = [
  {
    ico: '🔒',
    title: 'Compra segura',
    sub: 'Ambiente protegido na loja online',
  },
  {
    ico: '💳',
    title: 'Mercado Pago',
    sub: 'Pagamento processado pelo Mercado Pago.',
  },
  {
    ico: '🛡',
    title: 'Cartão protegido',
    sub: 'A Lojas Schimitz não armazena os dados do seu cartão.',
  },
] as const;

type Props = {
  /** home = vitrine; checkout = confiança no pagamento (sem inventar parcelas). */
  variant?: 'home' | 'checkout';
};

export function TrustBadges({ variant = 'home' }: Props) {
  const items = variant === 'checkout' ? CHECKOUT_ITEMS : HOME_ITEMS;
  const label = variant === 'checkout' ? 'Compra e pagamento' : 'Vantagens da loja';

  return (
    <ul className={variant === 'checkout' ? 'trust-row trust-row-checkout' : 'trust-row'} aria-label={label}>
      {items.map((item) => (
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
