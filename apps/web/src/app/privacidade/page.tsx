import type { Metadata } from 'next';
import Link from 'next/link';
import { PRIVACIDADE_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';
import {
  ACCOUNT_DELETION_PATH,
  PRIVACY_INTRO,
  PRIVACY_POLICY_UPDATED,
  PRIVACY_SECTIONS,
} from '@/lib/privacy-policy';
import { storeLegalIdentity } from '@/lib/store-legal-identity';

export const metadata: Metadata = storefrontPageMetadata(PRIVACIDADE_SEO);

const listStyle = { lineHeight: 1.7, paddingLeft: 18 } as const;

export default function PrivacidadePage() {
  const id = storeLegalIdentity();
  return (
    <article style={{ padding: '22px 0', maxWidth: 760 }}>
      <h1>Política de Privacidade</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Última atualização: {PRIVACY_POLICY_UPDATED}
      </p>
      <p>{PRIVACY_INTRO}</p>

      <section id="controlador" style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Quem é o controlador e como falar com a gente</h2>
        <ul style={listStyle}>
          <li>
            Controlador: <strong>{id.legalName ?? 'Lojas Schimitz'}</strong>
          </li>
          {id.cnpj ? <li>CNPJ: {id.cnpj}</li> : null}
          {id.address ? <li>Endereço: {id.address}</li> : null}
          <li>
            WhatsApp (canal de privacidade e atendimento):{' '}
            <a href={id.whatsappHref} target="_blank" rel="noreferrer">
              {id.whatsappDisplay}
            </a>
          </li>
          {id.privacyEmail ? (
            <li>
              E-mail: <a href={`mailto:${id.privacyEmail}`}>{id.privacyEmail}</a>
            </li>
          ) : null}
        </ul>
      </section>

      {PRIVACY_SECTIONS.map((s) => (
        <section key={s.id} id={s.id} style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 18 }}>{s.title}</h2>
          {s.rows ? (
            <ul style={listStyle}>
              {s.rows.map((r) => (
                <li key={r.data} style={{ marginBottom: 10 }}>
                  <strong>{r.data}.</strong> {r.why}{' '}
                  <span className="muted">Base legal: {r.basis}.</span>
                </li>
              ))}
            </ul>
          ) : null}
          {s.items ? (
            <ul style={listStyle}>
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
          {(s.paragraphs || []).map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}

      <section id="excluir-conta" style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18 }}>Excluir sua conta</h2>
        <p>
          Veja como pedir a exclusão e o que é apagado ou mantido em{' '}
          <Link href={ACCOUNT_DELETION_PATH}>Excluir conta</Link>.
        </p>
      </section>
    </article>
  );
}
