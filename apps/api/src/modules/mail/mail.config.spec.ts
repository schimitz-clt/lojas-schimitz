import assert from 'assert';
import {
  buildMailIdempotencyKey,
  mailConfiguredFromEnvPresence,
  normalizeMailRecipient,
  resolveMailProviderMode,
} from './mail.config';

{
  assert.equal(
    mailConfiguredFromEnvPresence({
      MAIL_FROM: undefined,
      RESEND_API_KEY: 're_x',
      SMTP_HOST: 'smtp.resend.com',
    } as NodeJS.ProcessEnv),
    false,
  );
  assert.equal(
    mailConfiguredFromEnvPresence({
      MAIL_FROM: 'Lojas <a@b.com>',
      RESEND_API_KEY: 're_x',
    } as NodeJS.ProcessEnv),
    true,
  );
  assert.equal(
    mailConfiguredFromEnvPresence({
      MAIL_FROM: 'a@b.com',
      SMTP_HOST: 'smtp.gmail.com',
    } as NodeJS.ProcessEnv),
    true,
  );
  assert.equal(
    mailConfiguredFromEnvPresence({
      MAIL_FROM: 'a@b.com',
    } as NodeJS.ProcessEnv),
    false,
  );
  // Presence only: SMTP_PASS alone (no HOST / no RESEND) is NOT enough
  assert.equal(
    mailConfiguredFromEnvPresence({
      MAIL_FROM: 'a@b.com',
      SMTP_PASS: 're_secret_should_not_matter',
    } as NodeJS.ProcessEnv),
    false,
  );
  console.log('mail.config mailConfiguredFromEnvPresence — PASSOU');
}

{
  assert.equal(
    resolveMailProviderMode({
      MAIL_FROM: 'a@b.com',
      RESEND_API_KEY: 're_x',
    } as NodeJS.ProcessEnv),
    'resend-http',
  );
  assert.equal(
    resolveMailProviderMode({
      MAIL_FROM: 'a@b.com',
      SMTP_HOST: 'smtp.resend.com',
      SMTP_PASS: 're_dual',
    } as NodeJS.ProcessEnv),
    'resend-http',
  );
  assert.equal(
    resolveMailProviderMode({
      MAIL_FROM: 'a@b.com',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PASS: 'app-pass',
    } as NodeJS.ProcessEnv),
    'smtp',
  );
  assert.equal(
    resolveMailProviderMode({
      MAIL_FROM: undefined,
      RESEND_API_KEY: 're_x',
    } as NodeJS.ProcessEnv),
    'off',
  );
  assert.equal(
    resolveMailProviderMode({
      MAIL_FROM: 'a@b.com',
    } as NodeJS.ProcessEnv),
    'off',
  );
  console.log('mail.config resolveMailProviderMode — PASSOU');
}

{
  assert.equal(normalizeMailRecipient('  Ana@Ex.com '), 'ana@ex.com');
  assert.equal(
    buildMailIdempotencyKey({ kind: 'order_paid', to: 'A@B.com', publicId: 'SCH-1' }),
    'order_paid:SCH-1:a@b.com',
  );
  assert.equal(
    buildMailIdempotencyKey({ kind: 'password_reset', to: 'a@b.com', publicId: 'x' }),
    null,
  );
  assert.equal(
    buildMailIdempotencyKey({ kind: 'order_paid', to: 'a@b.com', publicId: '' }),
    null,
  );
  assert.equal(
    buildMailIdempotencyKey({
      kind: 'order_status',
      to: 'a@b.com',
      publicId: 'SCH-2',
      statusLabel: 'Organizando',
    }),
    'order_status:SCH-2:Organizando:a@b.com',
  );
  console.log('mail.config idempotency keys — PASSOU');
}


{
  assert.equal(
    buildMailIdempotencyKey({ kind: 'welcome', to: 'A@B.com' }),
    'welcome:a@b.com',
  );
  assert.equal(
    buildMailIdempotencyKey({ kind: 'order_created', to: 'a@b.com', publicId: 'SCH-9' }),
    'order_created:SCH-9:a@b.com',
  );
  assert.equal(
    buildMailIdempotencyKey({ kind: 'payment_refused', to: 'a@b.com', publicId: 'SCH-9' }),
    'payment_refused:SCH-9:a@b.com',
  );
  assert.equal(
    buildMailIdempotencyKey({ kind: 'welcome', to: '  ' }),
    null,
  );
  // Different fulfillment labels must not collide
  const a = buildMailIdempotencyKey({
    kind: 'order_status',
    to: 'a@b.com',
    publicId: 'SCH-2',
    statusLabel: 'Organizando',
  });
  const b = buildMailIdempotencyKey({
    kind: 'order_status',
    to: 'a@b.com',
    publicId: 'SCH-2',
    statusLabel: 'Em embalagem',
  });
  assert.ok(a && b && a !== b);
  console.log('mail.config Phase 15 idempotency kinds — PASSOU');
}

console.log('mail.config tests ok');
