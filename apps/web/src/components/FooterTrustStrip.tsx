import { waLink } from '@/lib/api';
import { footerTrustItems } from '@/lib/footer-trust';
import { formatWhatsAppDisplay, storeWhatsAppDigits } from '@/lib/whatsapp';

const FOOTER_WA_TEXT = 'Olá, vim pelo site da Lojas Schimitz e preciso de atendimento.';

/** Compact footer trust — PIX/cartão, WhatsApp da loja, entrega. */
export function FooterTrustStrip() {
  const items = footerTrustItems({
    whatsappHref: waLink(FOOTER_WA_TEXT),
    whatsappDisplay: formatWhatsAppDisplay(storeWhatsAppDigits(process.env.NEXT_PUBLIC_WHATSAPP)),
  });

  return (
    <ul className="footer-trust" aria-label="Pagamento, atendimento e entrega">
      {items.map((item) => (
        <li key={item.id}>
          <strong>{item.title}</strong>
          {item.href ? (
            <a href={item.href} target="_blank" rel="noreferrer">
              {item.body}
            </a>
          ) : (
            <span>{item.body}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
