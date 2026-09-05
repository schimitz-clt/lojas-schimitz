import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

const DEFAULT_TITLE = 'Lojas Schimitz';
const DEFAULT_DESCRIPTION =
  'Tudo o que você precisa. No padrão das grandes. Eletro, celulares e casa em Porto Alegre.';

export type UpdateStoreSettingsInput = {
  siteTitle: string;
  siteDescription: string;
  ogImageUrl?: string | null;
};

export type CreateBannerInput = {
  title?: string;
  alt?: string;
  imageUrl: string;
  linkUrl?: string | null;
  sortOrder?: number;
  active?: boolean;
};

export type UpdateBannerInput = Partial<CreateBannerInput>;

function serializeSettings(s: {
  id: string;
  siteTitle: string;
  siteDescription: string;
  ogImageUrl: string | null;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    siteTitle: s.siteTitle,
    siteDescription: s.siteDescription,
    ogImageUrl: s.ogImageUrl,
    updatedAt: s.updatedAt,
  };
}

function serializeBanner(b: {
  id: string;
  title: string;
  alt: string;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: b.id,
    title: b.title,
    alt: b.alt,
    imageUrl: b.imageUrl,
    linkUrl: b.linkUrl,
    sortOrder: b.sortOrder,
    active: b.active,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function assertImageUrl(url: string) {
  const t = url.trim();
  if (!t) throw new BadRequestException('Informe a URL da imagem do banner');
  if (t.length > 2000) throw new BadRequestException('URL da imagem muito longa');
  return t;
}

function normalizeLink(url?: string | null): string | null {
  if (url == null) return null;
  const t = String(url).trim();
  if (!t) return null;
  if (t.length > 2000) throw new BadRequestException('Link do banner muito longo');
  if (!(t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/'))) {
    throw new BadRequestException('Link inválido. Use http(s):// ou caminho começando com /');
  }
  return t;
}

@Injectable()
export class StorefrontService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSettings() {
    const existing = await this.prisma.storeSettings.findUnique({ where: { id: 'default' } });
    if (existing) return existing;
    return this.prisma.storeSettings.create({
      data: {
        id: 'default',
        siteTitle: DEFAULT_TITLE,
        siteDescription: DEFAULT_DESCRIPTION,
      },
    });
  }

  async getPublicSettings() {
    const s = await this.ensureSettings();
    return serializeSettings(s);
  }

  async getAdminSettings() {
    return this.getPublicSettings();
  }

  async updateSettings(input: UpdateStoreSettingsInput) {
    const title = input.siteTitle.trim();
    const description = input.siteDescription.trim();
    if (title.length < 2) throw new BadRequestException('Título do site muito curto');
    if (description.length < 10) throw new BadRequestException('Descrição SEO muito curta');
    let og: string | null = null;
    if (input.ogImageUrl != null && String(input.ogImageUrl).trim()) {
      og = assertImageUrl(String(input.ogImageUrl));
    }
    await this.ensureSettings();
    const updated = await this.prisma.storeSettings.update({
      where: { id: 'default' },
      data: {
        siteTitle: title.slice(0, 120),
        siteDescription: description.slice(0, 320),
        ogImageUrl: og,
      },
    });
    return serializeSettings(updated);
  }

  async listPublicBanners() {
    const rows = await this.prisma.homeBanner.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(serializeBanner);
  }

  async listAdminBanners() {
    const rows = await this.prisma.homeBanner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(serializeBanner);
  }

  async createBanner(input: CreateBannerInput) {
    const imageUrl = assertImageUrl(input.imageUrl);
    const maxSort = await this.prisma.homeBanner.aggregate({ _max: { sortOrder: true } });
    const sortOrder =
      input.sortOrder != null && Number.isFinite(input.sortOrder)
        ? Math.trunc(input.sortOrder)
        : (maxSort._max.sortOrder ?? -1) + 1;
    const row = await this.prisma.homeBanner.create({
      data: {
        title: (input.title || '').trim().slice(0, 120),
        alt: (input.alt || input.title || '').trim().slice(0, 160),
        imageUrl,
        linkUrl: normalizeLink(input.linkUrl),
        sortOrder,
        active: input.active !== false,
      },
    });
    return serializeBanner(row);
  }

  async updateBanner(id: string, input: UpdateBannerInput) {
    const existing = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner não encontrado');
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = String(input.title).trim().slice(0, 120);
    if (input.alt !== undefined) data.alt = String(input.alt).trim().slice(0, 160);
    if (input.imageUrl !== undefined) data.imageUrl = assertImageUrl(input.imageUrl);
    if (input.linkUrl !== undefined) data.linkUrl = normalizeLink(input.linkUrl);
    if (input.sortOrder !== undefined) data.sortOrder = Math.trunc(Number(input.sortOrder));
    if (input.active !== undefined) data.active = Boolean(input.active);
    const row = await this.prisma.homeBanner.update({ where: { id }, data });
    return serializeBanner(row);
  }

  async deleteBanner(id: string) {
    const existing = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner não encontrado');
    await this.prisma.homeBanner.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Reordena banners: array de IDs na ordem desejada (índice = sortOrder). */
  async reorderBanners(orderedIds: string[]) {
    if (!Array.isArray(orderedIds) || !orderedIds.length) {
      throw new BadRequestException('Informe a lista de IDs na ordem desejada');
    }
    const unique = [...new Set(orderedIds.map(String))];
    if (unique.length !== orderedIds.length) {
      throw new BadRequestException('IDs duplicados na reordenação');
    }
    const existing = await this.prisma.homeBanner.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((b) => b.id));
    for (const id of unique) {
      if (!existingIds.has(id)) throw new NotFoundException(`Banner não encontrado: ${id}`);
    }
    await this.prisma.$transaction(
      unique.map((id, index) =>
        this.prisma.homeBanner.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return this.listAdminBanners();
  }
}
