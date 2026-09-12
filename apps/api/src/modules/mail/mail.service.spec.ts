import assert from 'assert';
import {
  adminOrderPaidEmail,
  orderCreatedEmail,
  orderDeliveredEmail,
  orderPaidEmail,
  orderReadyForPickupEmail,
  orderShippedEmail,
  orderStatusEmail,
  passwordResetEmail,
  paymentRefusedEmail,
  welcomeRegisterEmail,
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

const welcome = welcomeRegisterEmail({ customerName: 'Ana', siteUrl: 'https://lojasschimitz.com.br' });
assert.ok(welcome.subject.includes('Bem-vindo'));
assert.ok(welcome.text.includes('Lojas Schimitz'));
assert.ok(welcome.html.includes('Ana'));

const created = orderCreatedEmail({ publicId: 'SCH-C', total: 55, customerName: 'Ana' });
assert.ok(created.subject.includes('Pedido criado'));
assert.ok(created.text.includes('SCH-C'));
assert.ok(created.text.includes('aguardando pagamento'));

const refused = paymentRefusedEmail({ publicId: 'SCH-R', total: 12 });
assert.ok(refused.subject.includes('não aprovado'));
assert.ok(refused.text.includes('SCH-R'));

const organizing = orderStatusEmail({
  publicId: 'SCH-O',
  total: 1,
  statusLabel: 'Organizando',
});
assert.ok(organizing.subject.includes('Organizando'));
assert.ok(organizing.text.includes('SCH-O'));

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
        assert.equal(mail.getProviderMode(), 'resend-http');
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

async function testProviderModeAndIdempotency() {
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
      let calls = 0;
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        calls += 1;
        return new Response(JSON.stringify({ id: `email_idem_${calls}` }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;
      try {
        const mail = new MailService();
        assert.equal(mail.getProviderMode(), 'resend-http');
        assert.equal(mail.isMailConfiguredFromEnv(), true);
        const first = await mail.notifyOrderPaid('buyer@example.com', {
          publicId: 'SCH-IDEM',
          total: 10,
          customerName: 'Ana',
        });
        assert.equal(first.sent, true);
        if (first.sent) {
          assert.equal(first.mode, 'resend-http');
          assert.equal(first.messageId, 'email_idem_1');
        }
        const second = await mail.notifyOrderPaid('buyer@example.com', {
          publicId: 'SCH-IDEM',
          total: 10,
          customerName: 'Ana',
        });
        assert.equal(second.sent, false);
        if (!second.sent) assert.equal(second.reason, 'duplicate');
        assert.equal(calls, 1, 'duplicate must not hit provider');

        // Different publicId is a new send
        const third = await mail.notifyOrderPaid('buyer@example.com', {
          publicId: 'SCH-OTHER',
          total: 11,
        });
        assert.equal(third.sent, true);
        assert.equal(calls, 2);

        // Failed send releases claim — retry allowed
        mail.clearIdempotencyForTests();
        globalThis.fetch = (async () =>
          new Response(JSON.stringify({ message: 'fail' }), { status: 500 })) as typeof fetch;
        const fail = await mail.notifyAdminOrderPaid('admin@example.com', {
          publicId: 'SCH-FAIL',
          total: 1,
          adminUrl: 'https://example.com/admin',
        });
        assert.equal(fail.sent, false);
        if (!fail.sent) assert.equal(fail.reason, 'send_failed');

        let okCalls = 0;
        globalThis.fetch = (async () => {
          okCalls += 1;
          return new Response(JSON.stringify({ id: 'email_retry_ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }) as typeof fetch;
        const retry = await mail.notifyAdminOrderPaid('admin@example.com', {
          publicId: 'SCH-FAIL',
          total: 1,
          adminUrl: 'https://example.com/admin',
        });
        assert.equal(retry.sent, true);
        assert.equal(okCalls, 1);
        console.log('mail.service provider mode + idempotency — PASSOU');
      } finally {
        globalThis.fetch = origFetch;
      }
    },
  );
}

async function testPasswordResetNotIdempotent() {
  await withMailEnv(
    {
      RESEND_API_KEY: 're_test_unit_key_xxxxxxxx',
      MAIL_FROM: 'Lojas Schimitz <onboarding@resend.dev>',
      SMTP_HOST: undefined,
      SMTP_PASS: undefined,
    },
    async () => {
      let calls = 0;
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        calls += 1;
        return new Response(JSON.stringify({ id: `email_reset_${calls}` }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;
      try {
        const mail = new MailService();
        const a = await mail.notifyPasswordReset('user@example.com', {
          resetUrl: 'http://localhost/a',
          expiresMinutes: 60,
        });
        const b = await mail.notifyPasswordReset('user@example.com', {
          resetUrl: 'http://localhost/b',
          expiresMinutes: 60,
        });
        assert.equal(a.sent, true);
        assert.equal(b.sent, true);
        assert.equal(calls, 2, 'password reset must allow resend');
        console.log('mail.service password reset not idempotent — PASSOU');
      } finally {
        globalThis.fetch = origFetch;
      }
    },
  );
}


async function testPhase15IdempotentKinds() {
  await withMailEnv(
    {
      RESEND_API_KEY: 're_test_unit_key_xxxxxxxx',
      MAIL_FROM: 'Lojas Schimitz <onboarding@resend.dev>',
      SMTP_HOST: undefined,
      SMTP_PASS: undefined,
    },
    async () => {
      let calls = 0;
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        calls += 1;
        return new Response(JSON.stringify({ id: `email_p15_${calls}` }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;
      try {
        const mail = new MailService();
        mail.clearIdempotencyForTests();

        const w1 = await mail.notifyWelcome('new@example.com', { customerName: 'Ana' });
        const w2 = await mail.notifyWelcome('new@example.com', { customerName: 'Ana' });
        assert.equal(w1.sent, true);
        assert.equal(w2.sent, false);
        if (!w2.sent) assert.equal(w2.reason, 'duplicate');

        const c1 = await mail.notifyOrderCreated('buyer@example.com', {
          publicId: 'SCH-P15C',
          total: 10,
        });
        const c2 = await mail.notifyOrderCreated('buyer@example.com', {
          publicId: 'SCH-P15C',
          total: 10,
        });
        assert.equal(c1.sent, true);
        assert.equal(c2.sent, false);
        if (!c2.sent) assert.equal(c2.reason, 'duplicate');

        const r1 = await mail.notifyPaymentRefused('buyer@example.com', {
          publicId: 'SCH-P15R',
          total: 10,
        });
        const r2 = await mail.notifyPaymentRefused('buyer@example.com', {
          publicId: 'SCH-P15R',
          total: 10,
        });
        assert.equal(r1.sent, true);
        assert.equal(r2.sent, false);
        if (!r2.sent) assert.equal(r2.reason, 'duplicate');

        // Fulfillment status labels must not collide
        const s1 = await mail.notifyOrderStatus('buyer@example.com', {
          publicId: 'SCH-P15S',
          total: 10,
          statusLabel: 'Organizando',
        });
        const s2 = await mail.notifyOrderStatus('buyer@example.com', {
          publicId: 'SCH-P15S',
          total: 10,
          statusLabel: 'Em embalagem',
        });
        const s1b = await mail.notifyOrderStatus('buyer@example.com', {
          publicId: 'SCH-P15S',
          total: 10,
          statusLabel: 'Organizando',
        });
        assert.equal(s1.sent, true);
        assert.equal(s2.sent, true);
        assert.equal(s1b.sent, false);
        if (!s1b.sent) assert.equal(s1b.reason, 'duplicate');

        const ship1 = await mail.notifyOrderShipped('buyer@example.com', {
          publicId: 'SCH-P15SH',
          total: 10,
        });
        const ship2 = await mail.notifyOrderShipped('buyer@example.com', {
          publicId: 'SCH-P15SH',
          total: 10,
        });
        assert.equal(ship1.sent, true);
        assert.equal(ship2.sent, false);

        const d1 = await mail.notifyOrderDelivered('buyer@example.com', {
          publicId: 'SCH-P15D',
          total: 10,
        });
        const d2 = await mail.notifyOrderDelivered('buyer@example.com', {
          publicId: 'SCH-P15D',
          total: 10,
        });
        assert.equal(d1.sent, true);
        assert.equal(d2.sent, false);

        console.log('mail.service Phase 15 idempotent kinds — PASSOU');
      } finally {
        globalThis.fetch = origFetch;
      }
    },
  );
}

(async () => {
  await testResendHttpPath();
  await testResendDualUseSmtpPass();
  await testResendHttpFailure();
  await testOffWhenNoConfig();
  await testProviderModeAndIdempotency();
  await testPasswordResetNotIdempotent();
  await testPhase15IdempotentKinds();
  console.log('mail.service tests ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
