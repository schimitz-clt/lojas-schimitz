import { Body, Controller, Headers, Inject, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { CartService } from '../cart/cart.service';
import { ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto } from './dto';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

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
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const tokens = await this.auth.register(dto, clientIp(req), guestToken);
    await this.mergeGuest(tokens.user.id, guestToken);
    return ok(tokens);
  }

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const tokens = await this.auth.login(dto, clientIp(req), guestToken);
    await this.mergeGuest(tokens.user.id, guestToken);
    return ok(tokens);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(@Body() dto: RefreshDto) {
    return ok(await this.auth.refresh(dto));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser('sub') userId: string, @Body() body: { refreshToken?: string }) {
    return ok(await this.auth.logout(userId, body?.refreshToken));
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return ok(await this.auth.forgotPassword(dto.email, clientIp(req)));
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return ok(await this.auth.resetPassword(dto.token, dto.password, clientIp(req)));
  }
}
