import Link from 'next/link';
import { INSTITUTIONAL_UPDATED, PREENCHER, storeIdentityRows, type InstitutionalSection } from '@/lib/institutional-pages';

function Mark({ text }: { text: string }) {
  if (!text.includes(PREENCHER)) return <>{text}</>;
  const parts = text.split(PREENCHER);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 ? (
            <mark className="preencher">
              {PREENCHER}
            </mark>
          ) : null}
        </span>
      ))}
    </>
  );
}

export function InstitutionalPage({
  title,
  lede,
  sections,
  showIdentity = true,
}: {
  title: string;
  lede?: string;
  sections: InstitutionalSection[];
  showIdentity?: boolean;
}) {
  return (
    <article style={{ padding: '22px 0', maxWidth: 720 }}>
      <h1>{title}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Última atualização: {INSTITUTIONAL_UPDATED}
      </p>
      {lede ? <p>{lede}</p> : null}
      {sections.map((s) => (
        <section key={s.title} style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 18 }}>{s.title}</h2>
          {(s.paragraphs || []).map((p) => (
            <p key={p}>
              <Mark text={p} />
            </p>
          ))}
          {s.items ? (
            <ul style={{ lineHeight: 1.8, paddingLeft: 18 }}>
              {s.items.map((i) => (
                <li key={i}>
                  <Mark text={i} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      {showIdentity ? (
        <section style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 18 }}>Dados da loja e contato</h2>
          <ul style={{ lineHeight: 1.8, paddingLeft: 18 }}>
            {storeIdentityRows().map((r) => (
              <li key={r.label}>
                <strong>{r.label}:</strong> <Mark text={r.value} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="muted" style={{ marginTop: 22 }}>
        Veja também: <Link href="/sobre">Sobre</Link> · <Link href="/trocas-e-devolucoes">Trocas e devoluções</Link> ·{' '}
        <Link href="/frete">Frete</Link> · <Link href="/privacidade">Privacidade</Link> · <Link href="/termos">Termos</Link>
      </p>
    </article>
  );
}
