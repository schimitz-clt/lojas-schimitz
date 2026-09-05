import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../common/http';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {
    return ok(await this.auth.register(dto));
  }

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    return ok(await this.auth.login(dto));
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
}
