/**
 * Conteúdo das páginas institucionais (Sobre, Trocas e devoluções, Frete).
 * Só fatos reais do repositório/site. O que não sabemos aparece como [PREENCHER] visível —
 * nunca inventado. CDC (Lei 8.078/1990) e Decreto 7.962/2013 (comércio eletrônico).
 */
import { storeLegalIdentity, type StoreLegalIdentity } from './store-legal-identity';

export const PREENCHER = '[PREENCHER]';
export const INSTITUTIONAL_UPDATED = '21 de outubro de 2026';
export const STORE_CONTACT_EMAIL = 'schimitzclaiton@gmail.com';
export const RETURN_ADDRESS = 'Rua Wolfram Metzler, 287, Bairro Rubem Berta, Porto Alegre/RS, CEP 91250-320';
export const STORE_CITY = 'Porto Alegre / RS';

export function orPreencher(v: string | null | undefined, what: string): string {
  const s = String(v ?? '').trim();
  return s || `${PREENCHER} ${what}`;
}

/** Dados exigidos pelo Decreto 7.962/2013, art. 2º. Ausentes viram [PREENCHER]. */
export function storeIdentityRows(id: StoreLegalIdentity = storeLegalIdentity()): { label: string; value: string }[] {
  return [
    { label: 'Nome empresarial / responsável', value: orPreencher(id.legalName, 'nome do responsável ou razão social') },
    { label: 'CNPJ ou CPF', value: orPreencher(id.cnpj ?? id.cnpjNote, 'CNPJ ou CPF') },
    { label: 'Endereço físico', value: orPreencher(id.address, 'endereço completo') },
    { label: 'Cidade', value: STORE_CITY },
    { label: 'E-mail', value: id.privacyEmail || STORE_CONTACT_EMAIL },
    { label: 'WhatsApp', value: id.whatsappDisplay },
  ];
}

export type InstitutionalSection = { title: string; paragraphs?: string[]; items?: string[] };

export const SOBRE_SECTIONS: InstitutionalSection[] = [
  {
    title: 'Quem somos',
    paragraphs: [
      'A Lojas Schimitz é uma loja online de Porto Alegre com eletro, celulares, casa e utilidades, vendendo pelo site lojasschimitz.com.br e pelo aplicativo Android.',
      'A Lojas Schimitz nasceu como loja física em Porto Alegre. Em junho de 2026, o proprietário Claiton da Silva Schimitz abriu a loja online para atender um público maior. Nosso compromisso é simples: produtos de alta qualidade com um custo excelente e entregas no prazo combinado, para que cada cliente fique satisfeito com a compra.',
    ],
  },
  {
    title: 'Como compramos e entregamos',
    items: [
      'Pagamento por PIX ou cartão, processado pelo Mercado Pago.',
      'Frete calculado pelo CEP no checkout. Em Porto Alegre (CEP iniciando em 90 ou 91) pode haver frete grátis, conforme a regra vigente.',
      'Alguns produtos podem ser vendidos sob encomenda: quando for o caso, a página do produto mostra o prazo extra antes da compra.',
      'O andamento do pedido (separando, enviado, entregue) fica em Meus pedidos.',
    ],
  },
];

export const TROCAS_SECTIONS: InstitutionalSection[] = [
  {
    title: 'Direito de arrependimento (7 dias)',
    paragraphs: [
      'Compras feitas pelo site ou app podem ser canceladas em até 7 dias corridos a partir do recebimento do produto, sem precisar dizer o motivo (CDC, art. 49).',
      'Nesse caso devolvemos integralmente o valor pago, incluindo o frete, pelo mesmo meio de pagamento (PIX ou estorno no cartão pelo Mercado Pago). O custo de devolução do produto não é cobrado de você.',
    ],
  },
  {
    title: 'Produto com defeito',
    items: [
      'Prazo para reclamar de defeito aparente: 30 dias para produtos não duráveis e 90 dias para duráveis, contados da entrega (CDC, art. 26). Defeito oculto: o prazo conta de quando o defeito aparecer.',
      'Se o defeito não for resolvido em até 30 dias, você escolhe entre troca por outro igual, devolução do valor pago ou abatimento proporcional do preço (CDC, art. 18).',
      'A garantia do fabricante, quando houver, soma-se à garantia legal.',
    ],
  },
  {
    title: 'Como pedir',
    items: [
      'Fale pelo WhatsApp ou e-mail informando o número do pedido e, se for defeito, fotos ou vídeo do problema.',
      'Combinamos a coleta ou a postagem do produto, de preferência com a embalagem e acessórios.',
      `Endereço para devolução: ${RETURN_ADDRESS}.`,
      'O reembolso é feito depois que o produto chega e é conferido. Estorno no cartão segue o prazo da operadora.',
    ],
  },
];

export const FRETE_SECTIONS: InstitutionalSection[] = [
  {
    title: 'Como o frete é calculado',
    items: [
      'O valor e o prazo aparecem no checkout depois que você informa o CEP, antes de pagar.',
      'Em Porto Alegre (CEP iniciando em 90 ou 91) pode haver frete grátis, conforme a regra vigente mostrada no checkout.',
      `Transportadoras utilizadas: ${PREENCHER}.`,
    ],
  },
  {
    title: 'Prazos',
    items: [
      'O prazo começa a contar depois da confirmação do pagamento.',
      'Produtos sob encomenda têm um prazo extra, mostrado na página do produto antes da compra.',
      'Os prazos são estimativas da transportadora. Se houver atraso, avisamos pelo WhatsApp ou e-mail.',
    ],
  },
  {
    title: 'Acompanhar e receber',
    items: [
      'O status e o código de rastreio, quando houver, ficam em Meus pedidos.',
      'Confira a embalagem na entrega. Se estiver violada ou danificada, recuse ou registre a ocorrência e fale com a gente.',
      'Informe endereço completo e telefone para facilitar a entrega.',
    ],
  },
];

export const SOBRE_SEO = {
  title: 'Sobre a Lojas Schimitz',
  description: 'Quem somos, como vendemos e como falar com a Lojas Schimitz, loja online de Porto Alegre.',
  path: '/sobre',
} as const;
export const TROCAS_SEO = {
  title: 'Trocas e devoluções',
  description: 'Arrependimento em 7 dias, produto com defeito e como pedir troca ou devolução na Lojas Schimitz (CDC).',
  path: '/trocas-e-devolucoes',
} as const;
export const FRETE_SEO = {
  title: 'Frete e entrega',
  description: 'Como o frete é calculado, prazos, frete grátis em Porto Alegre e rastreio dos pedidos da Lojas Schimitz.',
  path: '/frete',
} as const;
