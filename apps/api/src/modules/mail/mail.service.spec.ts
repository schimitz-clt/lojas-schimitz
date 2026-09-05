import assert from 'assert';
import { MailService } from './mail.service';
import { orderPaidEmail, orderShippedEmail } from './mail.templates';

async function main() {
  // Sem SMTP → no-op sem throw
  delete process.env.SMTP_HOST;
  delete process.env.MAIL_FROM;
  const mail = new MailService();
  assert.equal(mail.isConfigured(), false);
  const r = await mail.notifyOrderPaid('cliente@test.local', {
    publicId: 'SCH-TEST',
    total: 99.9,
    customerName: 'Ana',
  });
  assert.equal(r.sent, false);
  assert.equal(r.reason, 'smtp_not_configured');

  const paid = orderPaidEmail({ publicId: 'SCH-1', total: 10, customerName: 'João' });
  assert.ok(paid.subject.includes('Pedido pago'));
  assert.ok(paid.text.includes('SCH-1'));
  assert.ok(paid.html.includes('SCH-1'));

  const shipped = orderShippedEmail({ publicId: 'SCH-2', total: 20 });
  assert.ok(shipped.subject.includes('Saiu para entrega'));
  assert.ok(shipped.text.includes('SCH-2'));

  console.log('mail.service tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
