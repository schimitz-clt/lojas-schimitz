import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';
import { resolveAccessToken } from '../../modules/auth/refresh-cookie';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = resolveAccessToken(req) || '';
    if (!token) throw new UnauthorizedException({ message: 'Token ausente', code: 'UNAUTHORIZED' });
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string; email?: string; role?: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      if (!payload?.sub) throw new UnauthorizedException({ message: 'Token inválido', code: 'UNAUTHORIZED' });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, status: true, name: true },
      });
      if (!user) {
        throw new UnauthorizedException({ message: 'Usuário inexistente', code: 'USER_INACTIVE' });
      }
      if (user.status !== 'active') {
        throw new UnauthorizedException({ message: 'Usuário inativo', code: 'USER_INACTIVE' });
      }

      req.user = { ...payload, sub: user.id, email: user.email, role: user.role, status: user.status };
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException({ message: 'Token inválido', code: 'UNAUTHORIZED' });
    }
  }
}
