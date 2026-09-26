/** Visual checkout progress. Does not change routes or payment. */
export function IdentitySteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Sacola', 'Entrega', 'Pagamento'] as const;
  return (
    <ol className="id-steps" aria-label="Etapas da compra">
      {steps.map((label, index) => {
        const n = index + 1;
        const state = n === current ? 'is-current' : n < current ? 'is-done' : '';
        return (
          <li key={label} className={state} aria-current={n === current ? 'step' : undefined}>
            <i />
            <span>
              {String(n).padStart(2, '0')} {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
