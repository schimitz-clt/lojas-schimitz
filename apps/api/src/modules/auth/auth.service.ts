import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto';
import { LoginAttemptService } from './login-attempt.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly attempts: LoginAttemptService,
  ) {}

  async register(dto: RegisterDto, ip = 'unknown') {
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

  async login(dto: LoginDto, ip = 'unknown') {
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
    const tokens = await this.issue(user.id, user.email, user.role, user.name);
    return tokens;
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
