export type OrderMailContext = {
  customerName?: string | null;
  publicId: string;
  total: number;
  statusLabel?: string;
};

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function greeting(name?: string | null) {
  const n = (name || '').trim();
  return n ? `Olá, ${n}!` : 'Olá!';
}

function wrapHtml(title: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; line-height: 1.5;">
  <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">${title}</h1>
    ${bodyHtml}
    <p style="margin-top: 24px; font-size: 13px; color: #555;">Lojas Schimitz · WhatsApp (51) 99625-3766</p>
  </div>
</body>
</html>`;
}

export function orderPaidEmail(ctx: OrderMailContext) {
  const total = formatBRL(ctx.total);
  const subject = `Pedido pago — ${ctx.publicId}`;
  const text = `${greeting(ctx.customerName)}

Recebemos o pagamento do seu pedido ${ctx.publicId}.

Total: ${total}

Já vamos organizar e preparar a entrega.
Obrigado por comprar na Lojas Schimitz.
`;
  const html = wrapHtml(
    'Pedido pago',
    `<p>${greeting(ctx.customerName)}</p>
     <p>Recebemos o pagamento do seu pedido <strong>${ctx.publicId}</strong>.</p>
     <p>Total: <strong>${total}</strong></p>
     <p>Já vamos organizar e preparar a entrega.</p>
     <p>Obrigado por comprar na Lojas Schimitz.</p>`,
  );
  return { subject, text, html };
}

export function orderReadyForPickupEmail(ctx: OrderMailContext) {
  const total = formatBRL(ctx.total);
  const subject = `Pronto para coleta — ${ctx.publicId}`;
  const text = `${greeting(ctx.customerName)}

Seu pedido ${ctx.publicId} está pronto para coleta / saída para entrega.

Total: ${total}

Em breve ele estará a caminho.
Lojas Schimitz
`;
  const html = wrapHtml(
    'Pronto para coleta',
    `<p>${greeting(ctx.customerName)}</p>
     <p>Seu pedido <strong>${ctx.publicId}</strong> está <strong>pronto para coleta</strong>.</p>
     <p>Total: <strong>${total}</strong></p>
     <p>Em breve ele estará a caminho.</p>`,
  );
  return { subject, text, html };
}

export function orderShippedEmail(ctx: OrderMailContext) {
  const total = formatBRL(ctx.total);
  const subject = `Saiu para entrega — ${ctx.publicId}`;
  const text = `${greeting(ctx.customerName)}

Seu pedido ${ctx.publicId} saiu para entrega (em trânsito).

Total: ${total}

Em breve ele chegará até você.
Lojas Schimitz
`;
  const html = wrapHtml(
    'Saiu para entrega',
    `<p>${greeting(ctx.customerName)}</p>
     <p>Seu pedido <strong>${ctx.publicId}</strong> <strong>saiu para entrega</strong> (em trânsito).</p>
     <p>Total: <strong>${total}</strong></p>
     <p>Em breve ele chegará até você.</p>`,
  );
  return { subject, text, html };
}

export function orderDeliveredEmail(ctx: OrderMailContext) {
  const total = formatBRL(ctx.total);
  const subject = `Pedido entregue — ${ctx.publicId}`;
  const text = `${greeting(ctx.customerName)}

Seu pedido ${ctx.publicId} foi marcado como entregue.

Total: ${total}

Obrigado por comprar na Lojas Schimitz.
`;
  const html = wrapHtml(
    'Pedido entregue',
    `<p>${greeting(ctx.customerName)}</p>
     <p>Seu pedido <strong>${ctx.publicId}</strong> foi marcado como <strong>entregue</strong>.</p>
     <p>Total: <strong>${total}</strong></p>
     <p>Obrigado por comprar na Lojas Schimitz.</p>`,
  );
  return { subject, text, html };
}

export function orderStatusEmail(ctx: OrderMailContext) {
  const total = formatBRL(ctx.total);
  const label = ctx.statusLabel || 'atualizado';
  const subject = `Pedido ${label} — ${ctx.publicId}`;
  const text = `${greeting(ctx.customerName)}

Seu pedido ${ctx.publicId} foi atualizado: ${label}.

Total: ${total}

Lojas Schimitz
`;
  const html = wrapHtml(
    `Pedido ${label}`,
    `<p>${greeting(ctx.customerName)}</p>
     <p>Seu pedido <strong>${ctx.publicId}</strong> foi atualizado: <strong>${label}</strong>.</p>
     <p>Total: <strong>${total}</strong></p>`,
  );
  return { subject, text, html };
}
