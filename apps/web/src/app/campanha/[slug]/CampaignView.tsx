'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, brl, waLink } from '@/lib/api';
import { installmentLine, pixPrice, pixSavings } from '@/lib/pricing';
import { formatWhatsAppDisplay } from '@/lib/whatsapp';
import {
  campaignChapters,
  displayHeadline,
  pixOffLabel,
  posterToken,
  type CampaignChapter,
} from '@/lib/identidade';
import { parseProductStory } from '@/lib/product-story';
import { pdpBenefitTrustItems } from '@/lib/pdp-trust';
import { resolveProductImageUrl, resolveProductStock } from '@/lib/product-media';
import { isDemoCatalogProduct } from '@/lib/demo-catalog';
import { SchimitzMonogram, SchimitzWordmark } from '@/components/brand/SchimitzMark';
import { PriceCount, Reveal } from '@/components/identidade/Motion';
import type { Product } from '@/components/ProductCard';

export type CampaignProduct = Product & {
  description?: string;
  sku?: string | null;
  highlights?: unknown;
  features?: unknown;
  boxContents?: unknown;
  weightKg?: number | string | null;
};

function chapterTitle(chapter: CampaignChapter, name: string): string {
  if (chapter.id === 'specs') return name;
  if (chapter.id === 'highlights') return 'O que você leva';
  if (chapter.id === 'box') return 'Na caixa';
  return name;
}

export function CampaignView({ product }: { product: CampaignProduct }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const price = Number(product.price);
  const pix = pixPrice(price);
  const headline = displayHeadline(product.name);
  const poster = posterToken(product.name);
  const img = resolveProductImageUrl(product);
  const chapters = campaignChapters(product);
  const story = parseProductStory(product);
  const stock = resolveProductStock(product);
  const blocked = isDemoCatalogProduct(product) || (stock != null && stock <= 0);
  const trust = pdpBenefitTrustItems();
  const phone = formatWhatsAppDisplay(process.env.NEXT_PUBLIC_WHATSAPP);
  const totalChapters = chapters.length + 1;

  async function buy() {
    if (blocked || busy) return;
    setBusy(true);
    setErr('');
    try {
      await api('/cart/items', { method: 'POST', body: JSON.stringify({ productId: product.id, qty: 1 }) });
      window.dispatchEvent(new Event('sch-cart-updated'));
      router.push('/carrinho');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Não foi possível adicionar à sacola');
      setBusy(false);
    }
  }

  return (
    <article className="id-campanha">
      <header className="id-camp-hero">
        <div className="id-grain" aria-hidden="true" />
        <div className="id-sweep" aria-hidden="true" />
        <p className="id-kicker id-mono">
          <span>{product.category?.name || 'Campanha'}</span>
          <span>{product.sku || 'Lojas Schimitz'}</span>
        </p>
        {poster ? <p className="id-poster-xl id-display" aria-hidden="true">{poster}</p> : null}
        <div className="id-stage">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="id-stage-img id-lcp" src={img} alt="" width={720} height={540} fetchPriority="high" decoding="async" />
          ) : (
            <span className="id-ph" aria-hidden="true">
              <SchimitzMonogram size={88} ring />
            </span>
          )}
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="id-floor-reflect" src={img} alt="" aria-hidden="true" width={480} height={160} decoding="async" />
          ) : null}
        </div>
        <h1 className="id-display">
          {headline.lead}
          {headline.accent ? (
            <>
              <br />
              <i>{headline.accent}</i>
            </>
          ) : null}
        </h1>
        {product.description ? <p className="id-install">{product.description}</p> : null}
        {chapters.length ? (
          <p className="id-cap id-mono">
            Role a história
            <b> 01—{String(totalChapters).padStart(2, '0')}</b>
          </p>
        ) : null}
      </header>

      {chapters.map((chapter, index) => (
        <Reveal key={chapter.id}>
          <section
            className={`id-chapter ${index % 2 === 0 ? 'id-chapter-cream' : 'id-chapter-night'}`}
            aria-labelledby={`camp-${chapter.id}`}
          >
            <p className="id-chapter-kicker id-mono">
              <span>
                {String(index + 1).padStart(2, '0')} — {chapter.kicker}
              </span>
            </p>
            <h2 id={`camp-${chapter.id}`} className="id-display">
              {chapterTitle(chapter, product.name)}
            </h2>
            {chapter.id === 'specs' ? (
              <ul className="id-specs">
                {chapter.specs.map((row) => (
                  <li key={row.label}>
                    <strong className="id-num">
                      {row.number}
                      {row.unit ? <small>{row.unit}</small> : null}
                    </strong>
                    <span className="id-mono">{row.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {chapter.id === 'highlights' ? (
              <ul>
                {chapter.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {chapter.id === 'story' ? <p>{chapter.text}</p> : null}
            {chapter.id === 'box' ? (
              <ul>
                {chapter.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        </Reveal>
      ))}

      <Reveal>
        <section className="id-offer" aria-labelledby="camp-offer">
          <p className="id-chapter-kicker id-mono">
            <span>
              {String(chapters.length + 1).padStart(2, '0')} — A oferta
            </span>
            <span>PIX · cartão</span>
          </p>
          <h2 id="camp-offer" className="id-display">
            {product.name}
          </h2>
          <p className="id-price">
            <PriceCount value={pix} />
          </p>
          <p className="id-mono">{pixOffLabel()}</p>
          <p>{installmentLine(price)} no cartão</p>
          {pixSavings(price) > 0 ? <p>Economia de {brl(pixSavings(price))} no PIX.</p> : null}
          <ul className="id-perks">
            {trust.map((item) => (
              <li key={item.id}>
                <span>{item.title}</span>
                <span>{item.body}</span>
              </li>
            ))}
            {story.features
              .filter((row) => /garantia/i.test(row.label) || /garantia/i.test(row.value))
              .slice(0, 1)
              .map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <span>{row.value}</span>
                </li>
              ))}
          </ul>
          {err ? <p role="alert">{err}</p> : null}
          <button className="id-offer-cta" type="button" onClick={buy} disabled={blocked || busy}>
            {blocked ? 'Indisponível' : busy ? 'Adicionando…' : 'Comprar agora'}
          </button>
          <p>
            <Link href={`/produto/${product.slug}`}>Ver a página do produto</Link>
          </p>
        </section>
      </Reveal>

      <a className="id-wa" href={waLink(`Olá, vim pela campanha do produto ${product.name}`)}>
        <span>
          <span className="id-mono">Dúvidas? WhatsApp</span>
          <b>{phone}</b>
        </span>
      </a>
      <p className="id-kicker" style={{ padding: '0 22px 28px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <SchimitzMonogram size={28} ring />
          <SchimitzWordmark />
        </span>
        <span className="id-mono">lojasschimitz.com.br</span>
      </p>

      <div className="id-camp-bar">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" width={52} height={52} />
        ) : (
          <span className="id-ph" aria-hidden="true">
            <SchimitzMonogram size={28} />
          </span>
        )}
        <div>
          <small className="id-mono">{pixOffLabel()}</small>
          <strong className="id-num">{brl(pix)}</strong>
        </div>
        <button className="id-buy" type="button" onClick={buy} disabled={blocked || busy}>
          Comprar <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}
