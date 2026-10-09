import type { Metadata } from 'next';
import Link from 'next/link';
import { storefrontPageMetadata } from '@/lib/seo-metadata';
import {
  ACCOUNT_DELETION_DELETED,
  ACCOUNT_DELETION_KEPT,
  ACCOUNT_DELETION_NOTES,
  ACCOUNT_DELETION_SEO,
  ACCOUNT_DELETION_SLA_DAYS,
  ACCOUNT_DELETION_STEPS,
  accountDeletionWhatsappHref,
} from '@/lib/account-deletion';
import { DEFAULT_STORE_WHATSAPP } from '@/lib/whatsapp';
import AccountDeletionRequest from './AccountDeletionRequest';

export const metadata: Metadata = storefrontPageMetadata(ACCOUNT_DELETION_SEO);

const listStyle = { lineHeight: 1.7, paddingLeft: 18 } as const;

function waDisplay(digits: string) {
  const d = digits.startsWith('55') ? digits.slice(2) : digits;
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : digits;
}

export default function ExcluirContaPage() {
  return (
    <article style={{ padding: '22px 0', maxWidth: 760 }}>
      <h1>Excluir conta</h1>
      <p>
        Você pode pedir a exclusão da sua conta da <strong>Lojas Schimitz</strong> (site
        lojasschimitz.com.br e app Android &quot;Lojas Schimitz&quot;) a qualquer momento. A conta é
        a mesma no site e no app.
      </p>

      <AccountDeletionRequest />

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Como pedir</h2>
        <ol style={listStyle}>
          {ACCOUNT_DELETION_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p>
          Não consegue entrar na conta? Peça pelo WhatsApp{' '}
          <a href={accountDeletionWhatsappHref()} target="_blank" rel="noreferrer">
            {waDisplay(DEFAULT_STORE_WHATSAPP)}
          </a>{' '}
          informando o e-mail do cadastro. Para proteger a conta, podemos pedir uma confirmação de
          que ela é sua. O prazo é o mesmo: até {ACCOUNT_DELETION_SLA_DAYS} dias.
        </p>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>O que é apagado</h2>
        <ul style={listStyle}>
          {ACCOUNT_DELETION_DELETED.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>O que é mantido e por quanto tempo</h2>
        <ul style={listStyle}>
          {ACCOUNT_DELETION_KEPT.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Bom saber</h2>
        <ul style={listStyle}>
          {ACCOUNT_DELETION_NOTES.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p>
          Mais detalhes na <Link href="/privacidade">Política de Privacidade</Link>.
        </p>
      </section>
    </article>
  );
}
