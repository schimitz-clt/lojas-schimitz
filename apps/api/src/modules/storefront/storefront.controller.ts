import { Controller, Get } from '@nestjs/common';
import { ok } from '../../common/http';
import { StorefrontService } from './storefront.service';

@Controller()
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  /** SEO / identidade pública da loja */
  @Get('store/settings')
  async settings() {
    return ok(await this.storefront.getPublicSettings());
  }

  /** Banners ativos da home (ordenados) */
  @Get('store/banners')
  async banners() {
    return ok(await this.storefront.listPublicBanners());
  }

  /** Prateleiras da home (Ofertas / Novidades / Mais vendidos) — catálogo real */
  @Get('store/shelves')
  async shelves() {
    return ok(await this.storefront.listPublicShelves());
  }

  /** Avaliações publicadas de produtos vendáveis. Lista vazia quando não há nenhuma. */
  @Get('store/reviews')
  async reviews() {
    return ok(await this.storefront.listPublicReviews());
  }
}
