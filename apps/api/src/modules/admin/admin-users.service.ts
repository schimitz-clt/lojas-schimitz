import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../prisma.service';
import { AdminCreateAdminDto } from './dto';

const ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Pure helpers — unit-tested. */
export function assertCanDeactivateAdmin(opts: {
  actorId: string;
  targetId: string;
  activeAdminCount: number;
}) {
  if (opts.actorId === opts.targetId) {
    throw new BadRequestException('Você não pode desativar a si mesmo');
  }
  if (opts.activeAdminCount <= 1) {
    throw new BadRequestException('Não é possível desativar o último administrador ativo');
  }
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listAdmins() {
    return this.prisma.user.findMany({
      where: { role: 'admin' },
      select: ADMIN_SELECT,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createAdmin(actorId: string, dto: AdminCreateAdminDto) {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      if (exists.role === 'admin') {
        throw new ConflictException('Já existe um administrador com este e-mail');
      }
      throw new ConflictException(
        'Este e-mail já está cadastrado como cliente. Use outro e-mail para o admin.',
      );
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash,
        role: 'admin',
        status: 'active',
      },
      select: ADMIN_SELECT,
    });

    await this.audit.log('admin.user.create', {
      actorId,
      entity: 'User',
      entityId: user.id,
      meta: { email: user.email, name: user.name },
    });

    return user;
  }

  async setStatus(actorId: string, targetId: string, status: 'active' | 'blocked') {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.role !== 'admin') {
      throw new NotFoundException('Administrador não encontrado');
    }

    if (status === 'blocked') {
      const activeAdminCount = await this.prisma.user.count({
        where: { role: 'admin', status: 'active' },
      });
      assertCanDeactivateAdmin({ actorId, targetId, activeAdminCount });
    }

    if (target.status === status) {
      return {
        id: target.id,
        email: target.email,
        name: target.name,
        role: target.role,
        status: target.status,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { status },
      select: ADMIN_SELECT,
    });

    if (status === 'blocked') {
      await this.prisma.refreshToken.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log(
      status === 'blocked' ? 'admin.user.deactivate' : 'admin.user.reactivate',
      {
        actorId,
        entity: 'User',
        entityId: targetId,
        meta: { email: updated.email, status },
      },
    );

    return updated;
  }
}
