import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { resolveAccessToken } from '../../modules/auth/refresh-cookie';
import { PrismaService } from '../../prisma.service';
import { resolveOptionalAccessUser } from './optional-jwt';
import { isAccessTokenRevoked } from '../../modules/auth/access-revocation';

@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = resolveAccessToken(req) || '';
    req.user = await resolveOptionalAccessUser({
      token,
      verify: (t) =>
        this.jwt.verifyAsync(t, {
          secret: process.env.JWT_ACCESS_SECRET,
        }),
      lookupUser: (id) =>
        this.prisma.user.findUnique({
          where: { id },
          select: { id: true, email: true, role: true, status: true },
        }),
      isRevoked: (jti) => isAccessTokenRevoked(this.prisma, jti),
    });
    return true;
  }
}
