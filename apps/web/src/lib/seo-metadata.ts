/**
 * Per-route storefront metadata. The root layout must not set canonical to `/`,
 * or every client page inherits the homepage URL (live bug on /produtos, /suporte, …).
 */

import type { Metadata } from 'next';
import {
  BRAND_SHARE_IMAGE_ALT,
  BRAND_SHARE_IMAGE_HEIGHT,
  BRAND_SHARE_IMAGE_PATH,
  BRAND_SHARE_IMAGE_WIDTH,
  type ResolvedShareImage,
  resolveShareImage,
  shareImageTag,
} from './og-image';

export const SEO_LOCALE = 'pt_BR';

export type StorefrontPageSeo = {
  title: string;
  description: string;
  path: string;
  /** Default true. Auth, cart, and account screens are noindex. */
  index?: boolean;
  siteName?: string;
  origin?: string;
  image?: ResolvedShareImage;
};

export const PRODUTOS_SEO = {
  title: 'Produtos',
  description:
    'Catálogo da Lojas Schimitz em Porto Alegre: eletro, celulares, informática, casa e mais. Preço, frete, PIX e parcelas na página do produto.',
  path: '/produtos',
} as const;

export const SUPORTE_SEO = {
  title: 'Suporte',
  description:
    'Atendimento da Lojas Schimitz por chat no site ou WhatsApp (51) 99625-3766. Ajuda com pedido, frete, PIX e troca.',
  path: '/suporte',
} as const;

export const MARKETPLACE_SEO = {
  title: 'Marketplace',
  description:
    'Marketplace Lojas Schimitz — catálogo com Vendido por, checkout unificado e portal do vendedor. Split Mercado Pago só com flags de produção (ops).',
  path: '/marketplace',
} as const;

export const PRIVACIDADE_SEO = {
  title: 'Política de Privacidade',
  description:
    'Como a Lojas Schimitz trata dados de conta, pedidos, pagamentos e cookies no site e no app.',
  path: '/privacidade',
} as const;

export const TERMOS_SEO = {
  title: 'Termos de Uso',
  description: 'Condições de compra na Lojas Schimitz: preços, frete, pagamentos PIX/cartão e trocas.',
  path: '/termos',
} as const;

export const COMPARAR_SEO = {
  title: 'Comparar produtos',
  description: 'Compare até 3 produtos da Lojas Schimitz — preço, PIX, parcelas, estoque e categoria.',
  path: '/comparar',
  index: false,
} as const;

export const ENTRAR_SEO = {
  title: 'Entrar',
  description: 'Entre na sua conta da Lojas Schimitz para ver pedidos e dados.',
  path: '/entrar',
  index: false,
} as const;

export const CADASTRO_SEO = {
  title: 'Criar meu cadastro',
  description: 'Crie seu cadastro de cliente na Lojas Schimitz.',
  path: '/cadastro',
  index: false,
} as const;

export const SACOLA_SEO = {
  title: 'Sacola',
  description: 'Sacola de compras da Lojas Schimitz.',
  path: '/carrinho',
  index: false,
} as const;

export const SALVOS_SEO = {
  title: 'Salvos',
  description: 'Produtos salvos na Lojas Schimitz.',
  path: '/favoritos',
  index: false,
} as const;

export const CONTA_SEO = {
  title: 'Sua conta',
  description: 'Sua conta na Lojas Schimitz: pedidos, dados e salvos.',
  path: '/conta',
  index: false,
} as const;

export const CHECKOUT_SEO = {
  title: 'Checkout',
  description: 'Checkout da Lojas Schimitz.',
  path: '/checkout',
  index: false,
} as const;

export const PEDIDOS_SEO = {
  title: 'Meus pedidos',
  description: 'Acompanhe seus pedidos na Lojas Schimitz.',
  path: '/pedidos',
  index: false,
} as const;

export const ESQUECI_SENHA_SEO = {
  title: 'Esqueci minha senha',
  description: 'Recuperar o acesso à conta da Lojas Schimitz.',
  path: '/esqueci-senha',
  index: false,
} as const;

export const REDEFINIR_SENHA_SEO = {
  title: 'Redefinir senha',
  description: 'Definir uma nova senha na Lojas Schimitz.',
  path: '/redefinir-senha',
  index: false,
} as const;

export const NOTIFICACOES_SEO = {
  title: 'Notificações',
  description: 'Avisos da sua conta na Lojas Schimitz.',
  path: '/notificacoes',
  index: false,
} as const;

export const VENDEDOR_SEO = {
  title: 'Portal do vendedor',
  description: 'Portal do vendedor da Lojas Schimitz.',
  path: '/vendedor',
  index: false,
} as const;

export function pageUrl(origin: string, path: string): string {
  const base = origin.replace(/\/$/, '');
  if (!path || path === '/') return base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/** Missing product or department. No canonical to the homepage. */
export function missingPageMetadata(): Metadata {
  return {
    title: 'Página não encontrada',
    description: 'Esse endereço não existe ou o produto saiu do ar.',
    robots: { index: false, follow: true },
    openGraph: {
      title: 'Página não encontrada',
      description: 'Esse endereço não existe ou o produto saiu do ar.',
      locale: SEO_LOCALE,
      type: 'website',
      images: [
        {
          url: BRAND_SHARE_IMAGE_PATH,
          alt: BRAND_SHARE_IMAGE_ALT,
          width: BRAND_SHARE_IMAGE_WIDTH,
          height: BRAND_SHARE_IMAGE_HEIGHT,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Página não encontrada',
      description: 'Esse endereço não existe ou o produto saiu do ar.',
      images: [BRAND_SHARE_IMAGE_PATH],
    },
  };
}

export function storefrontPageMetadata(input: StorefrontPageSeo): Metadata {
  const siteName = input.siteName || 'Lojas Schimitz';
  const index = input.index !== false;
  // Relative URLs stay relative unless the caller passes `origin` (request-time
  // generateMetadata). metadataBase on the root layout absolutizes them, so a
  // local build cannot bake http://localhost into static pages.
  const image =
    input.image ||
    (input.origin
      ? resolveShareImage(null, input.origin)
      : {
          url: BRAND_SHARE_IMAGE_PATH,
          alt: BRAND_SHARE_IMAGE_ALT,
          twitterCard: 'summary_large_image' as const,
          branded: true,
        });
  const url = input.origin ? pageUrl(input.origin, input.path) : input.path;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: input.title,
      description: input.description,
      locale: SEO_LOCALE,
      type: 'website',
      url,
      siteName,
      images: [shareImageTag(image)],
    },
    twitter: {
      card: image.twitterCard,
      title: input.title,
      description: input.description,
      images: [image.url],
    },
  };
}
