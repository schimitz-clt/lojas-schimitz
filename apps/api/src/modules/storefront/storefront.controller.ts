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
}
