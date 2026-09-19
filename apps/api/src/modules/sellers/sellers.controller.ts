import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '../../common/http';
import { SellersService } from './sellers.service';

/**
 * Public seller directory — active sellers only, no PII.
 * Distinct from `/seller/*` (owner portal) and `/admin/sellers`.
 */
@ApiTags('sellers')
@Controller('sellers')
export class SellersPublicController {
  constructor(private readonly sellers: SellersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar vendedores ativos (público, sem PII)' })
  async list() {
    return ok(await this.sellers.listPublic());
  }
}
