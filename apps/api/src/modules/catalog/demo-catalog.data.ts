/**
 * Catálogo demonstrativo — exatamente 100 SKUs DEMO-0001..DEMO-0100.
 * Não é mercadoria real. O seed grava isto; o CSV comercial não.
 */
import type { DemoArt } from './demo-catalog-art';

export const DEMO_CATALOG_SIZE = 100;
export const DEMO_SKU_PREFIX = 'DEMO-';
export const DEMO_BADGE = 'Demonstrativo';

export const DEMO_CATEGORY_SLUGS = [
  'eletro',
  'celulares',
  'informatica',
  'eletrodomesticos',
  'casa',
  'eletronicos',
  'utilidades',
  'ferramentas',
  'beleza',
  'moda',
] as const;

export type DemoCategorySlug = (typeof DEMO_CATEGORY_SLUGS)[number];

/** Categorias que o seed pode criar se ainda não existirem. Não renomeia as já existentes. */
export const DEMO_CATEGORY_SEEDS: { slug: DemoCategorySlug; name: string; sort: number }[] = [
  { slug: 'eletro', name: 'TVs e Áudio', sort: 1 },
  { slug: 'celulares', name: 'Celulares', sort: 2 },
  { slug: 'informatica', name: 'Informática', sort: 3 },
  { slug: 'eletrodomesticos', name: 'Eletrodomésticos', sort: 4 },
  { slug: 'casa', name: 'Casa', sort: 5 },
  { slug: 'eletronicos', name: 'Eletrônicos', sort: 8 },
  { slug: 'utilidades', name: 'Utilidades', sort: 9 },
  { slug: 'ferramentas', name: 'Ferramentas', sort: 10 },
  { slug: 'beleza', name: 'Beleza', sort: 11 },
  { slug: 'moda', name: 'Moda e acessórios', sort: 12 },
];

const CATEGORY_THEME: Record<DemoCategorySlug, { bg: string; accent: string; line: 'Série Demo' | 'Linha Demo' }> = {
  eletro: { bg: '#1b2430', accent: '#f5c518', line: 'Série Demo' },
  celulares: { bg: '#1a2230', accent: '#7eb6ff', line: 'Série Demo' },
  informatica: { bg: '#1c2433', accent: '#8fd0c6', line: 'Série Demo' },
  eletrodomesticos: { bg: '#241c1a', accent: '#f0a070', line: 'Série Demo' },
  casa: { bg: '#241e18', accent: '#e6c27a', line: 'Série Demo' },
  eletronicos: { bg: '#1a2030', accent: '#f5c518', line: 'Linha Demo' },
  utilidades: { bg: '#1e241c', accent: '#c5d68a', line: 'Linha Demo' },
  ferramentas: { bg: '#242018', accent: '#e0a15a', line: 'Linha Demo' },
  beleza: { bg: '#2a1c24', accent: '#f0b4c8', line: 'Linha Demo' },
  moda: { bg: '#221c28', accent: '#d7c4f0', line: 'Linha Demo' },
};

export type DemoCatalogItem = {
  sku: string;
  name: string;
  slug: string;
  description: string;
  categorySlug: DemoCategorySlug;
  price: number;
  compareAtPrice: number;
  weightKg: number;
  widthCm: number;
  heightCm: number;
  lengthCm: number;
  badge: typeof DEMO_BADGE;
  art: DemoArt;
  imagePath: string;
  bg: string;
  accent: string;
  line: 'Série Demo' | 'Linha Demo';
};

type Spec = {
  name: string;
  categorySlug: DemoCategorySlug;
  art: DemoArt;
  price: number;
  compareAtPrice: number;
  weightKg: number;
  widthCm: number;
  heightCm: number;
  lengthCm: number;
  blurb: string;
};

const SPECS: Spec[] = [
  { name: 'Smart TV 50" 4K UHD — Série Demo', categorySlug: 'eletro', art: 'tv', price: 1899.9, compareAtPrice: 2299.9, weightKg: 9.8, widthCm: 112, heightCm: 66, lengthCm: 8, blurb: 'Tela 4K ilustrativa para a sala, com moldura fina e suporte incluso no desenho da vitrine.' },
  { name: 'Smart TV 55" 4K UHD — Série Demo', categorySlug: 'eletro', art: 'tv', price: 2299.9, compareAtPrice: 2699.9, weightKg: 12.4, widthCm: 123, heightCm: 72, lengthCm: 8, blurb: 'Painel 55 polegadas de demonstração, pensado para comparar tamanho na navegação da loja.' },
  { name: 'Smart TV 65" 4K UHD — Série Demo', categorySlug: 'eletro', art: 'tv', price: 3299.9, compareAtPrice: 3899.9, weightKg: 18.2, widthCm: 145, heightCm: 84, lengthCm: 9, blurb: 'Formato grande de vitrine para a categoria TVs e Áudio, sem vínculo com marca de fabricante.' },
  { name: 'Smart TV 43" Full HD — Série Demo', categorySlug: 'eletro', art: 'tv', price: 1399.9, compareAtPrice: 1699.9, weightKg: 7.1, widthCm: 96, heightCm: 57, lengthCm: 8, blurb: 'TV compacta de demonstração para quartos e espaços menores.' },
  { name: 'Soundbar 2.1 com subwoofer — Série Demo', categorySlug: 'eletro', art: 'speaker', price: 699.9, compareAtPrice: 899.9, weightKg: 4.6, widthCm: 90, heightCm: 8, lengthCm: 12, blurb: 'Barra de som ilustrativa com canal de graves, só para a prateleira de áudio.' },
  { name: 'Caixa de som Bluetooth 20W — Série Demo', categorySlug: 'eletro', art: 'speaker', price: 249.9, compareAtPrice: 329.9, weightKg: 1.2, widthCm: 18, heightCm: 18, lengthCm: 8, blurb: 'Caixa portátil genérica da linha de áudio demonstrativa.' },
  { name: 'Fone de ouvido com fio estéreo — Série Demo', categorySlug: 'eletro', art: 'headphone', price: 79.9, compareAtPrice: 119.9, weightKg: 0.22, widthCm: 16, heightCm: 18, lengthCm: 6, blurb: 'Fone com fio para a vitrine de áudio, distinto dos modelos de celular.' },
  { name: 'Receptor de TV digital — Série Demo', categorySlug: 'eletro', art: 'tv', price: 149.9, compareAtPrice: 199.9, weightKg: 0.35, widthCm: 16, heightCm: 4, lengthCm: 12, blurb: 'Conversor ilustrativo para TVs sem sintonizador, item de navegação.' },
  { name: 'Suporte articulado para TV — Série Demo', categorySlug: 'eletro', art: 'tv', price: 129.9, compareAtPrice: 179.9, weightKg: 1.8, widthCm: 42, heightCm: 28, lengthCm: 8, blurb: 'Suporte de parede genérico para a categoria de TVs.' },
  { name: 'Controle remoto universal — Série Demo', categorySlug: 'eletro', art: 'tv', price: 49.9, compareAtPrice: 69.9, weightKg: 0.12, widthCm: 18, heightCm: 5, lengthCm: 3, blurb: 'Controle ilustrativo da prateleira de TVs e Áudio.' },

  { name: 'Smartphone 128GB — Série Demo', categorySlug: 'celulares', art: 'phone', price: 1299, compareAtPrice: 1599, weightKg: 0.19, widthCm: 7.5, heightCm: 16, lengthCm: 0.9, blurb: 'Aparelho genérico de 128 GB para a vitrine de celulares.' },
  { name: 'Smartphone 256GB — Série Demo', categorySlug: 'celulares', art: 'phone', price: 1799, compareAtPrice: 2099, weightKg: 0.2, widthCm: 7.6, heightCm: 16.2, lengthCm: 0.9, blurb: 'Versão de maior armazenamento, só demonstrativa.' },
  { name: 'Capa protetora transparente — Série Demo', categorySlug: 'celulares', art: 'phone', price: 39.9, compareAtPrice: 59.9, weightKg: 0.04, widthCm: 8, heightCm: 16, lengthCm: 1.2, blurb: 'Capa flexível ilustrativa para a seção de acessórios de celular.' },
  { name: 'Película de vidro temperado — Série Demo', categorySlug: 'celulares', art: 'phone', price: 29.9, compareAtPrice: 49.9, weightKg: 0.03, widthCm: 8, heightCm: 16, lengthCm: 0.4, blurb: 'Película genérica da linha de proteção para celular.' },
  { name: 'Carregador de parede USB-C 20W — Série Demo', categorySlug: 'celulares', art: 'cable', price: 69.9, compareAtPrice: 99.9, weightKg: 0.08, widthCm: 5, heightCm: 5, lengthCm: 3, blurb: 'Fonte compacta ilustrativa para a vitrine de acessórios.' },
  { name: 'Cabo USB-C 1 m — Série Demo', categorySlug: 'celulares', art: 'cable', price: 34.9, compareAtPrice: 49.9, weightKg: 0.05, widthCm: 10, heightCm: 2, lengthCm: 10, blurb: 'Cabo de um metro para a categoria de celulares.' },
  { name: 'Fone Bluetooth com estojo — Série Demo', categorySlug: 'celulares', art: 'headphone', price: 199.9, compareAtPrice: 279.9, weightKg: 0.06, widthCm: 6, heightCm: 5, lengthCm: 3, blurb: 'Fone sem fio ilustrativo, desenhado como acessório de celular e não como caixa de som.' },
  { name: 'Power bank 10000 mAh — Série Demo', categorySlug: 'celulares', art: 'phone', price: 149.9, compareAtPrice: 199.9, weightKg: 0.22, widthCm: 7, heightCm: 14, lengthCm: 1.6, blurb: 'Bateria portátil genérica da prateleira de celulares.' },
  { name: 'Suporte veicular para celular — Série Demo', categorySlug: 'celulares', art: 'phone', price: 59.9, compareAtPrice: 89.9, weightKg: 0.15, widthCm: 10, heightCm: 12, lengthCm: 8, blurb: 'Suporte de painel ilustrativo para a seção de acessórios.' },
  { name: 'Cartão de memória 128GB — Série Demo', categorySlug: 'celulares', art: 'phone', price: 89.9, compareAtPrice: 129.9, weightKg: 0.01, widthCm: 3, heightCm: 2, lengthCm: 0.2, blurb: 'Cartão genérico para expandir o armazenamento na vitrine.' },

  { name: 'Notebook 15" 8GB — Série Demo', categorySlug: 'informatica', art: 'laptop', price: 2499, compareAtPrice: 2899, weightKg: 1.8, widthCm: 36, heightCm: 2.2, lengthCm: 24, blurb: 'Notebook de uso geral ilustrativo, 8 GB, para a vitrine de informática.' },
  { name: 'Notebook 14" 16GB — Série Demo', categorySlug: 'informatica', art: 'laptop', price: 3499, compareAtPrice: 3999, weightKg: 1.4, widthCm: 32, heightCm: 1.8, lengthCm: 22, blurb: 'Formato mais leve de demonstração, 16 GB, sem marca de fabricante.' },
  { name: 'Mouse sem fio — Série Demo', categorySlug: 'informatica', art: 'mouse', price: 79.9, compareAtPrice: 109.9, weightKg: 0.08, widthCm: 6, heightCm: 4, lengthCm: 11, blurb: 'Mouse óptico genérico da seção de informática.' },
  { name: 'Teclado ABNT2 com fio — Série Demo', categorySlug: 'informatica', art: 'laptop', price: 129.9, compareAtPrice: 169.9, weightKg: 0.55, widthCm: 44, heightCm: 3, lengthCm: 14, blurb: 'Teclado com layout ABNT2 ilustrativo para o dia a dia.' },
  { name: 'Monitor 24" Full HD — Série Demo', categorySlug: 'informatica', art: 'tv', price: 799.9, compareAtPrice: 999.9, weightKg: 3.4, widthCm: 54, heightCm: 40, lengthCm: 18, blurb: 'Monitor de mesa da vitrine de informática, não é uma smart TV.' },
  { name: 'Webcam HD — Série Demo', categorySlug: 'informatica', art: 'laptop', price: 189.9, compareAtPrice: 249.9, weightKg: 0.12, widthCm: 8, heightCm: 4, lengthCm: 5, blurb: 'Câmera de vídeo ilustrativa para chamadas.' },
  { name: 'Headset com microfone — Série Demo', categorySlug: 'informatica', art: 'headphone', price: 219.9, compareAtPrice: 289.9, weightKg: 0.28, widthCm: 18, heightCm: 20, lengthCm: 8, blurb: 'Headset de trabalho da categoria informática, distinto do fone de celular.' },
  { name: 'SSD 480GB — Série Demo', categorySlug: 'informatica', art: 'laptop', price: 279.9, compareAtPrice: 349.9, weightKg: 0.05, widthCm: 10, heightCm: 0.7, lengthCm: 7, blurb: 'Unidade de armazenamento ilustrativa para a prateleira de PCs.' },
  { name: 'Roteador Wi-Fi dual band — Série Demo', categorySlug: 'informatica', art: 'laptop', price: 249.9, compareAtPrice: 329.9, weightKg: 0.32, widthCm: 20, heightCm: 4, lengthCm: 14, blurb: 'Roteador genérico da vitrine de redes.' },
  { name: 'Hub USB 4 portas — Série Demo', categorySlug: 'informatica', art: 'cable', price: 89.9, compareAtPrice: 129.9, weightKg: 0.09, widthCm: 10, heightCm: 2, lengthCm: 4, blurb: 'Concentrador USB ilustrativo para notebooks.' },

  { name: 'Geladeira frost free 340L — Série Demo', categorySlug: 'eletrodomesticos', art: 'fridge', price: 2499, compareAtPrice: 2999, weightKg: 58, widthCm: 60, heightCm: 175, lengthCm: 68, blurb: 'Refrigerador de duas portas ilustrativo para a cozinha da vitrine.' },
  { name: 'Fogão 4 bocas — Série Demo', categorySlug: 'eletrodomesticos', art: 'kitchen', price: 1199, compareAtPrice: 1499, weightKg: 26, widthCm: 55, heightCm: 90, lengthCm: 60, blurb: 'Fogão de piso genérico da seção de eletrodomésticos.' },
  { name: 'Micro-ondas 20L — Série Demo', categorySlug: 'eletrodomesticos', art: 'kitchen', price: 549.9, compareAtPrice: 699.9, weightKg: 11, widthCm: 45, heightCm: 26, lengthCm: 34, blurb: 'Micro-ondas de bancada ilustrativo, 20 litros.' },
  { name: 'Lavadora de roupas 11kg — Série Demo', categorySlug: 'eletrodomesticos', art: 'fridge', price: 1899, compareAtPrice: 2299, weightKg: 32, widthCm: 60, heightCm: 100, lengthCm: 62, blurb: 'Lavadora de abertura superior para a vitrine de casa.' },
  { name: 'Ar-condicionado 9000 BTUs — Série Demo', categorySlug: 'eletrodomesticos', art: 'fridge', price: 1599, compareAtPrice: 1999, weightKg: 24, widthCm: 80, heightCm: 28, lengthCm: 20, blurb: 'Split ilustrativo de 9.000 BTUs, sem nome de fabricante.' },
  { name: 'Liquidificador 600W — Série Demo', categorySlug: 'eletrodomesticos', art: 'kitchen', price: 159.9, compareAtPrice: 219.9, weightKg: 2.1, widthCm: 18, heightCm: 38, lengthCm: 18, blurb: 'Liquidificador de copo genérico da prateleira de cozinha.' },
  { name: 'Ferro de passar a vapor — Série Demo', categorySlug: 'eletrodomesticos', art: 'kitchen', price: 129.9, compareAtPrice: 179.9, weightKg: 1.1, widthCm: 28, heightCm: 14, lengthCm: 12, blurb: 'Ferro a vapor ilustrativo para a seção de eletrodomésticos.' },
  { name: 'Aspirador de pó vertical — Série Demo', categorySlug: 'eletrodomesticos', art: 'tool', price: 399.9, compareAtPrice: 549.9, weightKg: 2.8, widthCm: 25, heightCm: 110, lengthCm: 18, blurb: 'Aspirador vertical genérico, desenhado como eletrodoméstico e não como ferramenta.' },
  { name: 'Cafeteira elétrica — Série Demo', categorySlug: 'eletrodomesticos', art: 'kitchen', price: 189.9, compareAtPrice: 249.9, weightKg: 1.6, widthCm: 20, heightCm: 28, lengthCm: 18, blurb: 'Cafeteira de filtro ilustrativa para o café da manhã da vitrine.' },
  { name: 'Ventilador de coluna — Série Demo', categorySlug: 'eletrodomesticos', art: 'lamp', price: 229.9, compareAtPrice: 299.9, weightKg: 4.2, widthCm: 42, heightCm: 125, lengthCm: 42, blurb: 'Ventilador de coluna genérico da categoria de eletrodomésticos.' },

  { name: 'Jogo de panelas 5 peças — Série Demo', categorySlug: 'casa', art: 'kitchen', price: 249.9, compareAtPrice: 349.9, weightKg: 3.8, widthCm: 40, heightCm: 20, lengthCm: 28, blurb: 'Conjunto de panelas ilustrativo para a cozinha.' },
  { name: 'Conjunto de cama casal — Série Demo', categorySlug: 'casa', art: 'lamp', price: 199.9, compareAtPrice: 279.9, weightKg: 1.9, widthCm: 40, heightCm: 12, lengthCm: 30, blurb: 'Jogo de lençóis casal genérico da seção Casa.' },
  { name: 'Luminária de mesa — Série Demo', categorySlug: 'casa', art: 'lamp', price: 119.9, compareAtPrice: 169.9, weightKg: 0.9, widthCm: 16, heightCm: 42, lengthCm: 16, blurb: 'Luminária de cabeceira ilustrativa.' },
  { name: 'Organizador de closet — Série Demo', categorySlug: 'casa', art: 'bag', price: 89.9, compareAtPrice: 129.9, weightKg: 1.4, widthCm: 40, heightCm: 30, lengthCm: 30, blurb: 'Caixa organizadora genérica para o quarto.' },
  { name: 'Tapete sala 200x140 — Série Demo', categorySlug: 'casa', art: 'lamp', price: 329.9, compareAtPrice: 449.9, weightKg: 3.2, widthCm: 40, heightCm: 10, lengthCm: 40, blurb: 'Tapete ilustrativo de sala, enrolado na arte da vitrine.' },
  { name: 'Jogo de toalhas 4 peças — Série Demo', categorySlug: 'casa', art: 'bag', price: 99.9, compareAtPrice: 149.9, weightKg: 1.1, widthCm: 30, heightCm: 12, lengthCm: 24, blurb: 'Jogo de banho genérico da categoria Casa.' },
  { name: 'Cortina blackout — Série Demo', categorySlug: 'casa', art: 'lamp', price: 159.9, compareAtPrice: 219.9, weightKg: 1.5, widthCm: 20, heightCm: 8, lengthCm: 20, blurb: 'Cortina ilustrativa para quarto, medida de vitrine.' },
  { name: 'Lixeira com pedal 12L — Série Demo', categorySlug: 'casa', art: 'kitchen', price: 79.9, compareAtPrice: 119.9, weightKg: 1.3, widthCm: 24, heightCm: 40, lengthCm: 24, blurb: 'Lixeira de cozinha genérica.' },
  { name: 'Escorredor de louças — Série Demo', categorySlug: 'casa', art: 'kitchen', price: 69.9, compareAtPrice: 99.9, weightKg: 0.8, widthCm: 42, heightCm: 18, lengthCm: 28, blurb: 'Escorredor de pia ilustrativo.' },
  { name: 'Porta-temperos 6 potes — Série Demo', categorySlug: 'casa', art: 'bottle', price: 54.9, compareAtPrice: 79.9, weightKg: 0.7, widthCm: 28, heightCm: 8, lengthCm: 16, blurb: 'Conjunto de potes da prateleira de organização da casa.' },

  { name: 'Fone Bluetooth ANC — Linha Demo', categorySlug: 'eletronicos', art: 'headphone', price: 349.9, compareAtPrice: 449.9, weightKg: 0.25, widthCm: 18, heightCm: 20, lengthCm: 8, blurb: 'Fone com cancelamento ilustrativo da linha de eletrônicos, não é uma TV.' },
  { name: 'Smartwatch com tela — Linha Demo', categorySlug: 'eletronicos', art: 'watch', price: 299.9, compareAtPrice: 399.9, weightKg: 0.05, widthCm: 4, heightCm: 5, lengthCm: 1.2, blurb: 'Relógio inteligente genérico da vitrine de eletrônicos.' },
  { name: 'Caixa de som portátil — Linha Demo', categorySlug: 'eletronicos', art: 'speaker', price: 189.9, compareAtPrice: 259.9, weightKg: 0.6, widthCm: 18, heightCm: 8, lengthCm: 8, blurb: 'Caixa compacta ilustrativa, distinta da soundbar de sala.' },
  { name: 'Carregador sem fio — Linha Demo', categorySlug: 'eletronicos', art: 'cable', price: 99.9, compareAtPrice: 149.9, weightKg: 0.12, widthCm: 10, heightCm: 1, lengthCm: 10, blurb: 'Base de carga ilustrativa da linha de eletrônicos.' },
  { name: 'Adaptador HDMI — Linha Demo', categorySlug: 'eletronicos', art: 'cable', price: 59.9, compareAtPrice: 89.9, weightKg: 0.04, widthCm: 6, heightCm: 2, lengthCm: 4, blurb: 'Adaptador genérico para a prateleira de conectividade.' },
  { name: 'Pen drive 64GB — Linha Demo', categorySlug: 'eletronicos', art: 'cable', price: 49.9, compareAtPrice: 69.9, weightKg: 0.01, widthCm: 5, heightCm: 1, lengthCm: 2, blurb: 'Pen drive ilustrativo de 64 GB.' },
  { name: 'Fone intra-auricular com fio — Linha Demo', categorySlug: 'eletronicos', art: 'headphone', price: 39.9, compareAtPrice: 59.9, weightKg: 0.03, widthCm: 8, heightCm: 4, lengthCm: 3, blurb: 'Fone de ouvido simples da linha de eletrônicos.' },
  { name: 'Estabilizador de tensão — Linha Demo', categorySlug: 'eletronicos', art: 'speaker', price: 219.9, compareAtPrice: 289.9, weightKg: 3.5, widthCm: 16, heightCm: 18, lengthCm: 22, blurb: 'Estabilizador ilustrativo para equipamentos da casa.' },
  { name: 'Extensão elétrica 5 tomadas — Linha Demo', categorySlug: 'eletronicos', art: 'cable', price: 64.9, compareAtPrice: 89.9, weightKg: 0.45, widthCm: 30, heightCm: 4, lengthCm: 6, blurb: 'Filtro de linha genérico da vitrine de eletrônicos.' },
  { name: 'Relógio digital de mesa — Linha Demo', categorySlug: 'eletronicos', art: 'watch', price: 79.9, compareAtPrice: 119.9, weightKg: 0.18, widthCm: 12, heightCm: 8, lengthCm: 5, blurb: 'Relógio de cabeceira ilustrativo, não é smartwatch.' },

  { name: 'Garrafa térmica 1L — Linha Demo', categorySlug: 'utilidades', art: 'bottle', price: 69.9, compareAtPrice: 99.9, weightKg: 0.45, widthCm: 10, heightCm: 28, lengthCm: 10, blurb: 'Garrafa térmica genérica da seção de utilidades.' },
  { name: 'Jogo de talheres 16 peças — Linha Demo', categorySlug: 'utilidades', art: 'kitchen', price: 89.9, compareAtPrice: 129.9, weightKg: 0.9, widthCm: 26, heightCm: 5, lengthCm: 18, blurb: 'Faqueiro ilustrativo para o dia a dia.' },
  { name: 'Forma de bolo antiaderente — Linha Demo', categorySlug: 'utilidades', art: 'kitchen', price: 44.9, compareAtPrice: 69.9, weightKg: 0.4, widthCm: 26, heightCm: 7, lengthCm: 26, blurb: 'Forma redonda genérica da prateleira de utilidades.' },
  { name: 'Tábua de corte — Linha Demo', categorySlug: 'utilidades', art: 'kitchen', price: 39.9, compareAtPrice: 59.9, weightKg: 0.55, widthCm: 30, heightCm: 2, lengthCm: 20, blurb: 'Tábua de cozinha ilustrativa.' },
  { name: 'Pote hermético 1,2L — Linha Demo', categorySlug: 'utilidades', art: 'bottle', price: 29.9, compareAtPrice: 44.9, weightKg: 0.2, widthCm: 14, heightCm: 12, lengthCm: 14, blurb: 'Pote com tampa da linha de organização.' },
  { name: 'Panela de pressão 4,5L — Linha Demo', categorySlug: 'utilidades', art: 'kitchen', price: 159.9, compareAtPrice: 219.9, weightKg: 2.4, widthCm: 22, heightCm: 20, lengthCm: 22, blurb: 'Panela de pressão ilustrativa, item de utilidades.' },
  { name: 'Frigideira antiaderente 24cm — Linha Demo', categorySlug: 'utilidades', art: 'kitchen', price: 79.9, compareAtPrice: 119.9, weightKg: 0.8, widthCm: 24, heightCm: 6, lengthCm: 42, blurb: 'Frigideira genérica de 24 cm.' },
  { name: 'Jarra de vidro 1,5L — Linha Demo', categorySlug: 'utilidades', art: 'bottle', price: 49.9, compareAtPrice: 74.9, weightKg: 0.7, widthCm: 12, heightCm: 24, lengthCm: 12, blurb: 'Jarra ilustrativa para a mesa.' },
  { name: 'Escumadeira de silicone — Linha Demo', categorySlug: 'utilidades', art: 'kitchen', price: 24.9, compareAtPrice: 39.9, weightKg: 0.08, widthCm: 8, heightCm: 2, lengthCm: 32, blurb: 'Utensílio de silicone da vitrine de utilidades.' },
  { name: 'Conjunto de potes 5 peças — Linha Demo', categorySlug: 'utilidades', art: 'bottle', price: 64.9, compareAtPrice: 94.9, weightKg: 0.6, widthCm: 28, heightCm: 14, lengthCm: 20, blurb: 'Kit de potes ilustrativo para a despensa.' },

  { name: 'Jogo de chaves de fenda — Linha Demo', categorySlug: 'ferramentas', art: 'tool', price: 49.9, compareAtPrice: 79.9, weightKg: 0.4, widthCm: 22, heightCm: 3, lengthCm: 8, blurb: 'Jogo de chaves ilustrativo da seção de ferramentas.' },
  { name: 'Martelo de unha — Linha Demo', categorySlug: 'ferramentas', art: 'tool', price: 39.9, compareAtPrice: 59.9, weightKg: 0.55, widthCm: 32, heightCm: 4, lengthCm: 12, blurb: 'Martelo genérico para a vitrine de ferramentas.' },
  { name: 'Trena 5 m — Linha Demo', categorySlug: 'ferramentas', art: 'tool', price: 29.9, compareAtPrice: 44.9, weightKg: 0.18, widthCm: 8, heightCm: 8, lengthCm: 4, blurb: 'Trena de bolso ilustrativa.' },
  { name: 'Alicate universal — Linha Demo', categorySlug: 'ferramentas', art: 'tool', price: 34.9, compareAtPrice: 54.9, weightKg: 0.25, widthCm: 20, heightCm: 5, lengthCm: 3, blurb: 'Alicate genérico da linha de ferramentas.' },
  { name: 'Nível de bolha 40 cm — Linha Demo', categorySlug: 'ferramentas', art: 'tool', price: 27.9, compareAtPrice: 42.9, weightKg: 0.2, widthCm: 40, heightCm: 3, lengthCm: 2, blurb: 'Nível ilustrativo de 40 centímetros.' },
  { name: 'Serra manual — Linha Demo', categorySlug: 'ferramentas', art: 'tool', price: 44.9, compareAtPrice: 69.9, weightKg: 0.35, widthCm: 45, heightCm: 12, lengthCm: 3, blurb: 'Serra de mão genérica, sem marca de fabricante.' },
  { name: 'Parafusadeira a bateria — Linha Demo', categorySlug: 'ferramentas', art: 'tool', price: 299.9, compareAtPrice: 399.9, weightKg: 1.2, widthCm: 20, heightCm: 22, lengthCm: 8, blurb: 'Parafusadeira ilustrativa da vitrine de ferramentas.' },
  { name: 'Jogo de brocas — Linha Demo', categorySlug: 'ferramentas', art: 'tool', price: 59.9, compareAtPrice: 89.9, weightKg: 0.3, widthCm: 16, heightCm: 3, lengthCm: 10, blurb: 'Estojo de brocas genérico.' },
  { name: 'Lanterna de mão — Linha Demo', categorySlug: 'ferramentas', art: 'tool', price: 45.9, compareAtPrice: 69.9, weightKg: 0.22, widthCm: 16, heightCm: 4, lengthCm: 4, blurb: 'Lanterna ilustrativa da seção de ferramentas, não é um eletrônico de áudio.' },
  { name: 'Maleta de ferramentas 40 peças — Linha Demo', categorySlug: 'ferramentas', art: 'tool', price: 189.9, compareAtPrice: 259.9, weightKg: 3.6, widthCm: 40, heightCm: 12, lengthCm: 28, blurb: 'Maleta ilustrativa com conjunto de mão.' },

  { name: 'Secador de cabelo 1800W — Linha Demo', categorySlug: 'beleza', art: 'beauty', price: 149.9, compareAtPrice: 219.9, weightKg: 0.55, widthCm: 24, heightCm: 10, lengthCm: 8, blurb: 'Secador ilustrativo da vitrine de beleza.' },
  { name: 'Chapinha cerâmica — Linha Demo', categorySlug: 'beleza', art: 'beauty', price: 129.9, compareAtPrice: 189.9, weightKg: 0.4, widthCm: 28, heightCm: 4, lengthCm: 4, blurb: 'Prancha genérica da seção de cuidados.' },
  { name: 'Aparador de pelos — Linha Demo', categorySlug: 'beleza', art: 'beauty', price: 99.9, compareAtPrice: 149.9, weightKg: 0.18, widthCm: 16, heightCm: 4, lengthCm: 4, blurb: 'Aparador ilustrativo, sem marca comercial.' },
  { name: 'Espelho de mesa com luz — Linha Demo', categorySlug: 'beleza', art: 'beauty', price: 119.9, compareAtPrice: 169.9, weightKg: 0.7, widthCm: 18, heightCm: 30, lengthCm: 10, blurb: 'Espelho de maquiagem genérico.' },
  { name: 'Kit de pincéis — Linha Demo', categorySlug: 'beleza', art: 'beauty', price: 59.9, compareAtPrice: 89.9, weightKg: 0.12, widthCm: 20, heightCm: 3, lengthCm: 6, blurb: 'Conjunto de pincéis ilustrativo da categoria beleza.' },
  { name: 'Necessaire de viagem — Linha Demo', categorySlug: 'beleza', art: 'bag', price: 49.9, compareAtPrice: 79.9, weightKg: 0.2, widthCm: 22, heightCm: 8, lengthCm: 12, blurb: 'Nécessaire genérica da linha de beleza.' },
  { name: 'Escova modeladora — Linha Demo', categorySlug: 'beleza', art: 'beauty', price: 139.9, compareAtPrice: 189.9, weightKg: 0.35, widthCm: 30, heightCm: 6, lengthCm: 6, blurb: 'Escova térmica ilustrativa.' },
  { name: 'Cortador de unhas — Linha Demo', categorySlug: 'beleza', art: 'beauty', price: 19.9, compareAtPrice: 29.9, weightKg: 0.03, widthCm: 8, heightCm: 1, lengthCm: 2, blurb: 'Cortador simples da vitrine de cuidados.' },
  { name: 'Massageador facial — Linha Demo', categorySlug: 'beleza', art: 'beauty', price: 89.9, compareAtPrice: 129.9, weightKg: 0.15, widthCm: 12, heightCm: 4, lengthCm: 4, blurb: 'Massageador ilustrativo da seção de beleza.' },
  { name: 'Organizador de maquiagem — Linha Demo', categorySlug: 'beleza', art: 'bag', price: 74.9, compareAtPrice: 109.9, weightKg: 0.5, widthCm: 24, heightCm: 12, lengthCm: 16, blurb: 'Caixa organizadora genérica para a penteadeira.' },

  { name: 'Mochila urbana 20L — Linha Demo', categorySlug: 'moda', art: 'bag', price: 159.9, compareAtPrice: 219.9, weightKg: 0.6, widthCm: 30, heightCm: 42, lengthCm: 14, blurb: 'Mochila ilustrativa da seção de moda e acessórios.' },
  { name: 'Carteira compacta — Linha Demo', categorySlug: 'moda', art: 'bag', price: 69.9, compareAtPrice: 99.9, weightKg: 0.08, widthCm: 11, heightCm: 2, lengthCm: 9, blurb: 'Carteira genérica da vitrine de acessórios.' },
  { name: 'Cinto de material sintético — Linha Demo', categorySlug: 'moda', art: 'bag', price: 59.9, compareAtPrice: 89.9, weightKg: 0.18, widthCm: 110, heightCm: 3, lengthCm: 3, blurb: 'Cinto ilustrativo, material sintético genérico.' },
  { name: 'Boné aba curva — Linha Demo', categorySlug: 'moda', art: 'bag', price: 49.9, compareAtPrice: 74.9, weightKg: 0.09, widthCm: 20, heightCm: 12, lengthCm: 18, blurb: 'Boné liso da linha de acessórios, sem escudo de marca.' },
  { name: 'Óculos de sol — Linha Demo', categorySlug: 'moda', art: 'watch', price: 89.9, compareAtPrice: 139.9, weightKg: 0.04, widthCm: 15, heightCm: 5, lengthCm: 5, blurb: 'Óculos genéricos da vitrine de moda.' },
  { name: 'Relógio de pulso analógico — Linha Demo', categorySlug: 'moda', art: 'watch', price: 129.9, compareAtPrice: 189.9, weightKg: 0.07, widthCm: 4, heightCm: 24, lengthCm: 1, blurb: 'Relógio de pulso ilustrativo, distinto do smartwatch.' },
  { name: 'Meia cano médio kit 3 — Linha Demo', categorySlug: 'moda', art: 'bag', price: 34.9, compareAtPrice: 49.9, weightKg: 0.1, widthCm: 16, heightCm: 4, lengthCm: 10, blurb: 'Kit de meias genérico da seção de moda.' },
  { name: 'Guarda-chuva compacto — Linha Demo', categorySlug: 'moda', art: 'bag', price: 54.9, compareAtPrice: 79.9, weightKg: 0.28, widthCm: 28, heightCm: 5, lengthCm: 5, blurb: 'Guarda-chuva ilustrativo de bolsa.' },
  { name: 'Lenço estampado — Linha Demo', categorySlug: 'moda', art: 'bag', price: 39.9, compareAtPrice: 59.9, weightKg: 0.05, widthCm: 20, heightCm: 2, lengthCm: 20, blurb: 'Lenço genérico da vitrine de acessórios.' },
  { name: 'Porta-cartões — Linha Demo', categorySlug: 'moda', art: 'bag', price: 44.9, compareAtPrice: 69.9, weightKg: 0.04, widthCm: 10, heightCm: 1, lengthCm: 7, blurb: 'Porta-cartões ilustrativo da linha de moda.' },
];

function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return `demo-${base}`;
}

function descriptionFor(spec: Spec, line: 'Série Demo' | 'Linha Demo'): string {
  return [
    spec.blurb,
    `Marca: ${line}. Schimitz Demo.`,
    'Item de catálogo demonstrativo da Lojas Schimitz: aparece na vitrine para navegação, busca e página do produto.',
    'Não é oferta de venda, não reserva estoque e não gera cobrança.',
  ].join(' ');
}

export function demoCatalogSku(index1: number): string {
  return `${DEMO_SKU_PREFIX}${String(index1).padStart(4, '0')}`;
}

export function demoCatalogImagePath(sku: string): string {
  return `/demo-catalog/${sku}.svg`;
}

function buildCatalog(specs: Spec[]): DemoCatalogItem[] {
  return specs.map((spec, index) => {
    const theme = CATEGORY_THEME[spec.categorySlug];
    const sku = demoCatalogSku(index + 1);
    return {
      sku,
      name: spec.name,
      slug: slugify(spec.name),
      description: descriptionFor(spec, theme.line),
      categorySlug: spec.categorySlug,
      price: spec.price,
      compareAtPrice: spec.compareAtPrice,
      weightKg: spec.weightKg,
      widthCm: spec.widthCm,
      heightCm: spec.heightCm,
      lengthCm: spec.lengthCm,
      badge: DEMO_BADGE,
      art: spec.art,
      imagePath: demoCatalogImagePath(sku),
      bg: theme.bg,
      accent: theme.accent,
      line: theme.line,
    };
  });
}

export const DEMO_CATALOG: DemoCatalogItem[] = buildCatalog(SPECS);

export function demoCatalogSkuSet(): Set<string> {
  return new Set(DEMO_CATALOG.map((item) => item.sku));
}
