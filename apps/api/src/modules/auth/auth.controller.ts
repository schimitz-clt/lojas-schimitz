import { Body, Controller, Headers, Inject, Logger, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ok } from '../../common/http';
import { AuthService } from './auth.service';
import { CartService } from '../cart/cart.service';
import { ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto } from './dto';
import {
  clearAuthCookies,
  issueAuthSession,
  resolveAccessToken,
  resolveRefreshToken,
} from './refresh-cookie';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly log = new Logger(AuthController.name);

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(CartService) private readonly cart: CartService,
  ) {}

  private async mergeGuest(userId: string, guestToken?: string) {
    if (!guestToken?.trim()) return;
    try {
      await this.cart.mergeGuestIntoUser(userId, guestToken);
    } catch (e: any) {
      this.log.warn(`guest cart merge falhou userId=${userId}: ${e?.message || e}`);
    }
  }

  @Post('register')
  @ApiOperation({
    summary: 'Registrar cliente',
    description:
      'Resposta genérica (anti-enumeração): o mesmo sucesso se o e-mail é novo ou já existe. Sem sessão — faça login em seguida. Merge de carrinho guest ocorre no login.',
  })
  @ApiSecurity('guest-token')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return ok(await this.auth.register(dto, clientIp(req), guestToken));
  }

  @Post('login')
  @ApiOperation({ summary: 'Login' })
  @ApiSecurity('guest-token')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const tokens = await this.auth.login(dto, clientIp(req), guestToken);
    await this.mergeGuest(tokens.user.id, guestToken);
    return ok(issueAuthSession(res, tokens));
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Renovar access token',
    description:
      'Aceita refresh no cookie HttpOnly `sch_refresh` **ou** no body (`refreshToken`). Cookie tem precedência; body é fallback (localhost/legado). JSON inclui `refreshToken` por default; com REFRESH_COOKIE_ENABLED + REFRESH_JSON_TOKEN_ENABLED=false a resposta omite o campo (cookie-only). Merge de código não flipa prod — ver checklist em docs/SECURITY.md.',
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = resolveRefreshToken(req, dto?.refreshToken);
    if (!refreshToken) {
      clearAuthCookies(res);
      throw new UnauthorizedException('Refresh token inválido');
    }
    const tokens = await this.auth.refresh({ refreshToken });
    return ok(issueAuthSession(res, tokens));
  }

  @Post('logout')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout / revogar refresh',
    description:
      'Bearer access opcional. Sem access válido, ainda revoga via cookie/body `refreshToken`. Sempre limpa `sch_refresh` e `sch_access`.',
  })
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async logout(
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = resolveRefreshToken(req, body?.refreshToken);
    const access = resolveAccessToken(req);
    const result = await this.auth.logoutFlexible(access || undefined, refreshToken);
    clearAuthCookies(res);
    return ok(result);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar reset de senha (resposta genérica)' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return ok(await this.auth.forgotPassword(dto.email, clientIp(req)));
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Redefinir senha com token' })
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return ok(await this.auth.resetPassword(dto.token, dto.password, clientIp(req)));
  }
}
