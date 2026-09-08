import assert from 'assert';
import {
  adminOrderPaidEmail,
  orderDeliveredEmail,
  orderPaidEmail,
  orderReadyForPickupEmail,
  orderShippedEmail,
  passwordResetEmail,
} from './mail.templates';
import { MailService } from './mail.service';

const paid = orderPaidEmail({ publicId: 'SCH-1', total: 10, customerName: 'Ana' });
assert.ok(paid.subject.includes('Pedido pago'));
assert.ok(paid.text.includes('SCH-1'));
assert.ok(paid.html.includes('Ana'));

const ready = orderReadyForPickupEmail({ publicId: 'SCH-3', total: 30 });
assert.ok(ready.subject.includes('Pronto para coleta'));
assert.ok(ready.text.includes('SCH-3'));

const shipped = orderShippedEmail({ publicId: 'SCH-2', total: 20 });
assert.ok(shipped.subject.includes('Saiu para entrega'));
assert.ok(shipped.text.includes('SCH-2'));

const delivered = orderDeliveredEmail({ publicId: 'SCH-4', total: 40 });
assert.ok(delivered.subject.includes('entregue'));

const adminPaid = adminOrderPaidEmail({
  publicId: 'SCH-9',
  total: 150,
  customerName: 'Lucas',
  customerEmail: 'schimitzclaiton@gmail.com',
  adminUrl: 'https://example.com/admin',
  whatsappUrl: 'https://wa.me/5551996253766?text=Nova%20venda',
});
assert.ok(adminPaid.subject.includes('Nova venda paga'));
assert.ok(adminPaid.subject.includes('SCH-9'));
assert.ok(adminPaid.text.includes('schimitzclaiton@gmail.com'));
assert.ok(adminPaid.html.includes('wa.me/5551996253766'));
assert.ok(adminPaid.html.includes('/admin'));

const reset = passwordResetEmail({
  customerName: 'Ana',
  resetUrl: 'http://localhost:3000/redefinir-senha?token=abc',
  expiresMinutes: 60,
});
assert.ok(reset.subject.includes('Redefinição'));
assert.ok(reset.text.includes('redefinir-senha'));
assert.ok(reset.html.includes('Ana'));

console.log('mail.templates tests ok');

/** Snapshot + restore env keys used by MailService. */
function withMailEnv(patch: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const keys = [
    'RESEND_API_KEY',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'MAIL_FROM',
  ];
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) prev[k] = process.env[k];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const restore = () => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  };
  return Promise.resolve(fn()).finally(restore);
}

async function testResendHttpPath() {
  await withMailEnv(
    {
      RESEND_API_KEY: 're_test_unit_key_xxxxxxxx',
      MAIL_FROM: 'Lojas Schimitz <onboarding@resend.dev>',
      SMTP_HOST: undefined,
      SMTP_PASS: undefined,
      SMTP_USER: undefined,
      SMTP_PORT: undefined,
    },
    async () => {
      const calls: { url: string; init: RequestInit }[] = [];
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init?: RequestInit) => {
        calls.push({ url: String(url), init: init || {} });
        return new Response(JSON.stringify({ id: 'email_test_123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      try {
        const mail = new MailService();
        assert.equal(mail.isConfigured(), true);
        const result = await mail.notifyPasswordReset('user@example.com', {
          customerName: 'Ana',
          resetUrl: 'http://localhost:3000/redefinir-senha?token=abc',
          expiresMinutes: 60,
        });
        assert.equal(result.sent, true);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, 'https://api.resend.com/emails');
        assert.equal(calls[0].init.method, 'POST');
        const headers = calls[0].init.headers as Record<string, string>;
        assert.equal(headers.Authorization, 'Bearer re_test_unit_key_xxxxxxxx');
        assert.equal(headers['Content-Type'], 'application/json');
        const body = JSON.parse(String(calls[0].init.body));
        assert.equal(body.from, 'Lojas Schimitz <onboarding@resend.dev>');
        assert.deepEqual(body.to, ['user@example.com']);
        assert.ok(String(body.subject).includes('Redefinição'));
        assert.ok(String(body.html).includes('Ana'));
        assert.ok(String(body.text).includes('redefinir-senha'));
        console.log('mail.service Resend HTTP (RESEND_API_KEY) — PASSOU');
      } finally {
        globalThis.fetch = origFetch;
      }
    },
  );
}

async function testResendDualUseSmtpPass() {
  await withMailEnv(
    {
      RESEND_API_KEY: undefined,
      SMTP_HOST: 'smtp.resend.com',
      SMTP_PASS: 're_dual_use_key_yyyyyyyy',
      SMTP_USER: 'resend',
      SMTP_PORT: '465',
      MAIL_FROM: 'Lojas Schimitz <onboarding@resend.dev>',
    },
    async () => {
      const calls: { url: string; init: RequestInit }[] = [];
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async (url: any, init?: RequestInit) => {
        calls.push({ url: String(url), init: init || {} });
        return new Response(JSON.stringify({ id: 'email_dual_456' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      try {
        const mail = new MailService();
        assert.equal(mail.isConfigured(), true);
        const result = await mail.notifyOrderPaid('buyer@example.com', {
          publicId: 'SCH-1',
          total: 10,
          customerName: 'Ana',
        });
        assert.equal(result.sent, true);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, 'https://api.resend.com/emails');
        const headers = calls[0].init.headers as Record<string, string>;
        assert.equal(headers.Authorization, 'Bearer re_dual_use_key_yyyyyyyy');
        console.log('mail.service Resend HTTP (SMTP_PASS dual-use) — PASSOU');
      } finally {
        globalThis.fetch = origFetch;
      }
    },
  );
}

async function testResendHttpFailure() {
  await withMailEnv(
    {
      RESEND_API_KEY: 're_bad_key',
      MAIL_FROM: 'Lojas Schimitz <onboarding@resend.dev>',
      SMTP_HOST: undefined,
      SMTP_PASS: undefined,
    },
    async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ message: 'Invalid API key' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })) as typeof fetch;
      try {
        const mail = new MailService();
        const result = await mail.notifyPasswordReset('user@example.com', {
          resetUrl: 'http://localhost/x',
          expiresMinutes: 60,
        });
        assert.equal(result.sent, false);
        if (!result.sent) assert.equal(result.reason, 'send_failed');
        console.log('mail.service Resend HTTP failure — PASSOU');
      } finally {
        globalThis.fetch = origFetch;
      }
    },
  );
}

async function testOffWhenNoConfig() {
  await withMailEnv(
    {
      RESEND_API_KEY: undefined,
      SMTP_HOST: undefined,
      SMTP_PASS: undefined,
      MAIL_FROM: undefined,
    },
    async () => {
      const mail = new MailService();
      assert.equal(mail.isConfigured(), false);
      const result = await mail.notifyPasswordReset('user@example.com', {
        resetUrl: 'http://localhost/x',
        expiresMinutes: 60,
      });
      assert.equal(result.sent, false);
      if (!result.sent) assert.equal(result.reason, 'smtp_not_configured');
      console.log('mail.service off when unconfigured — PASSOU');
    },
  );
}

(async () => {
  await testResendHttpPath();
  await testResendDualUseSmtpPass();
  await testResendHttpFailure();
  await testOffWhenNoConfig();
  console.log('mail.service tests ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
