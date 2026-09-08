import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto';
import { LoginAttemptService } from './login-attempt.service';

const RESET_TTL_MS = 60 * 60 * 1000; // 1h
const RESET_MAX_PER_EMAIL = 3;
const RESET_MAX_PER_IP = 8;
const RESET_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);
  /** Sliding window counters for forgot-password (separate from login brute-force). */
  private readonly resetBuckets = new Map<string, number[]>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(LoginAttemptService) private readonly attempts: LoginAttemptService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto, ip = 'unknown', _guestToken?: string) {
    this.attempts.assertAllowed(ip, dto.email);
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (exists) {
      this.attempts.recordFailure(ip, dto.email);
      throw new ConflictException('E-mail já cadastrado');
    }
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        phone: dto.phone?.trim() || null,
        role: 'customer',
      },
    });
    this.attempts.clear(ip, dto.email);
    return this.issue(user.id, user.email, user.role, user.name);
  }

  async login(dto: LoginDto, ip = 'unknown', _guestToken?: string) {
    this.attempts.assertAllowed(ip, dto.email);
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || user.status !== 'active') {
      this.attempts.recordFailure(ip, dto.email);
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      this.attempts.recordFailure(ip, dto.email);
      throw new UnauthorizedException('Credenciais inválidas');
    }
    this.attempts.clear(ip, dto.email);
    return this.issue(user.id, user.email, user.role, user.name);
  }

  /**
   * Always returns the same generic message (no e-mail enumeration).
   * Persists hashed token; e-mails via SMTP or logs link when SMTP is off (local).
   */
  async forgotPassword(emailRaw: string, ip = 'unknown') {
    const email = (emailRaw || '').trim().toLowerCase();
    this.assertResetAllowed(ip, email);

    const generic = {
      accepted: true,
      message:
        'Se o e-mail estiver cadastrado, enviaremos instruções para redefinir a senha em alguns minutos.',
    };

    if (!email) return generic;

    const user = await this.prisma.user.findUnique({ where: { email } });
    // Count request even when user missing (anti-enumeration + flood control)
    this.recordResetRequest(ip, email);

    if (!user || user.status !== 'active') {
      return generic;
    }

    // Invalidate previous unused tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        requestIp: ip || null,
      },
    });

    const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_WEB_URL || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const resetUrl = `${site}/redefinir-senha?token=${encodeURIComponent(rawToken)}`;

    await this.mail.notifyPasswordReset(user.email, {
      customerName: user.name,
      resetUrl,
      expiresMinutes: Math.floor(RESET_TTL_MS / 60000),
    });

    return generic;
  }

  async resetPassword(rawToken: string, newPassword: string, ip = 'unknown') {
    const token = (rawToken || '').trim();
    if (!token || token.length < 20) {
      throw new BadRequestException({ message: 'Token inválido ou expirado', code: 'RESET_TOKEN_INVALID' });
    }

    this.assertResetAllowed(ip);
    const tokenHash = this.hashResetToken(token);
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      this.recordResetRequest(ip);
      throw new BadRequestException({ message: 'Token inválido ou expirado', code: 'RESET_TOKEN_INVALID' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
    if (!user || user.status !== 'active') {
      throw new BadRequestException({ message: 'Token inválido ou expirado', code: 'RESET_TOKEN_INVALID' });
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      // Invalidate any other outstanding reset tokens
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      // Invalidate all sessions
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    this.log.log(`Password reset completed for userId=${user.id} ip=${ip}`);
    return { reset: true, message: 'Senha atualizada. Faça login com a nova senha.' };
  }

  async refresh(dto: RefreshDto) {
    let payload: { sub: string; typ?: string; jti?: string };
    try {
      payload = await this.jwt.verifyAsync(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('Refresh token inválido');

    const matched = await this.findRefreshRow(payload.sub, dto.refreshToken, payload.jti);
    if (!matched || matched.revokedAt || matched.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token inválido, expirado ou revogado');
    }

    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({ message: 'Usuário inválido', code: 'USER_INACTIVE' });
    }

    return this.issue(user.id, user.email, user.role, user.name);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      let jti: string | undefined;
      try {
        const payload = await this.jwt.verifyAsync<{ jti?: string }>(refreshToken, {
          secret: process.env.JWT_REFRESH_SECRET,
        });
        jti = payload.jti;
      } catch {
        jti = undefined;
      }
      const matched = await this.findRefreshRow(userId, refreshToken, jti);
      if (matched && !matched.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: matched.id },
          data: { revokedAt: new Date() },
        });
      }
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { loggedOut: true };
  }


  hashResetToken(raw: string) {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  private assertResetAllowed(ip: string, email?: string) {
    const now = Date.now();
    const ipKey = `rip:${(ip || 'unknown').trim() || 'unknown'}`;
    const ipCount = this.pruneBucket(ipKey, now);
    if (ipCount >= RESET_MAX_PER_IP) {
      throw new HttpException(
        {
          message: 'Muitas solicitações de redefinição. Aguarde 15 minutos e tente novamente.',
          code: 'RATE_LIMITED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (email) {
      const emailKey = `remail:${email.trim().toLowerCase()}`;
      if (this.pruneBucket(emailKey, now) >= RESET_MAX_PER_EMAIL) {
        throw new HttpException(
          {
            message: 'Muitas solicitações para este e-mail. Aguarde 15 minutos.',
            code: 'RATE_LIMITED',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private recordResetRequest(ip: string, email?: string) {
    const now = Date.now();
    const ipKey = `rip:${(ip || 'unknown').trim() || 'unknown'}`;
    const bucket = this.resetBuckets.get(ipKey) ?? [];
    bucket.push(now);
    this.resetBuckets.set(ipKey, bucket);
    this.pruneBucket(ipKey, now);
    if (email) {
      const emailKey = `remail:${email.trim().toLowerCase()}`;
      const eb = this.resetBuckets.get(emailKey) ?? [];
      eb.push(now);
      this.resetBuckets.set(emailKey, eb);
      this.pruneBucket(emailKey, now);
    }
  }

  private pruneBucket(key: string, now = Date.now()) {
    const cutoff = now - RESET_WINDOW_MS;
    const bucket = (this.resetBuckets.get(key) ?? []).filter((t) => t > cutoff);
    if (bucket.length === 0) this.resetBuckets.delete(key);
    else this.resetBuckets.set(key, bucket);
    return bucket.length;
  }

  private async findRefreshRow(userId: string, refreshToken: string, jti?: string) {
    if (jti) {
      const byJti = await this.prisma.refreshToken.findUnique({ where: { jti } });
      if (byJti && byJti.userId === userId) return byJti;
    }
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    for (const t of tokens) {
      if (await argon2.verify(t.tokenHash, refreshToken)) return t;
    }
    return null;
  }

  private async issue(sub: string, email: string, role: string, name: string) {
    const accessToken = await this.jwt.signAsync(
      { sub, email, role },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
      },
    );
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub, typ: 'refresh', jti },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d',
      },
    );
    const tokenHash = await argon2.hash(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({ data: { userId: sub, tokenHash, expiresAt, jti } });
    return {
      user: { id: sub, email, role, name },
      accessToken,
      refreshToken,
    };
  }
}
