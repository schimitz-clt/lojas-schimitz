import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(action: string, opts?: { actorId?: string; entity?: string; entityId?: string; meta?: Record<string, unknown> }) {
    const safe = { ...(opts?.meta || {}) };
    delete (safe as any).password;
    delete (safe as any).accessToken;
    delete (safe as any).refreshToken;
    delete (safe as any).token;
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          actorId: opts?.actorId,
          entity: opts?.entity,
          entityId: opts?.entityId,
          meta: safe as Prisma.InputJsonValue,
        },
      });
    } catch {
      // never block request on audit
    }
  }
}
