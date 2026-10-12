/**
 * O link de redefinição de senha (contém token) nunca pode ir para o log em staging/produção,
 * mesmo com e-mail desligado. Só em dev/test local.
 */
import assert from 'assert';
import { MailService } from './mail.service';

const KEYS = ['MAIL_FROM', 'RESEND_API_KEY', 'SMTP_HOST', 'APP_ENV', 'NODE_ENV', 'RAILWAY_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_NAME'];

async function run(env: Record<string, string>): Promise<string[]> {
  const saved: Record<string, string | undefined> = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  Object.assign(process.env, env);
  try {
    const svc: any = new MailService();
    const lines: string[] = [];
    svc.log = { warn: (m: string) => lines.push(m), log: () => undefined, error: () => undefined, debug: () => undefined };
    await svc.notifyPasswordReset('a@b.c', { customerName: 'Ana', resetUrl: 'https://x.test/redefinir-senha?token=SEGREDO123' });
    return lines;
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

async function main() {
  // staging: NODE_ENV não é "production" (caso real do Railway staging) → NÃO pode logar
  const cases: Record<string, string>[] = [
    { APP_ENV: 'staging', NODE_ENV: 'development' },
    { RAILWAY_ENVIRONMENT: 'staging' },
    { APP_ENV: 'production' },
    { NODE_ENV: 'production' },
  ];
  for (const env of cases) {
    const lines = await run(env);
    assert.ok(!lines.some((l) => l.includes('SEGREDO123')), `vazou token com ${JSON.stringify(env)}`);
  }
  // dev local continua útil
  const dev = await run({ NODE_ENV: 'development' });
  assert.ok(dev.some((l) => l.includes('SEGREDO123')), 'em dev o link deve aparecer no log');
  console.log('mail reset-link log tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
