import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.create({
      data: {
        userId,
        label: dto.label ?? 'Casa',
        cep: dto.cep.replace(/\D/g, ''),
        street: dto.street,
        number: dto.number,
        complement: dto.complement,
        district: dto.district,
        city: dto.city,
        uf: dto.uf.toUpperCase(),
        ibge: dto.ibge,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    const existing = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Endereço não encontrado');

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.cep !== undefined ? { cep: dto.cep.replace(/\D/g, '') } : {}),
        ...(dto.street !== undefined ? { street: dto.street } : {}),
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.complement !== undefined ? { complement: dto.complement } : {}),
        ...(dto.district !== undefined ? { district: dto.district } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.uf !== undefined ? { uf: dto.uf.toUpperCase() } : {}),
        ...(dto.ibge !== undefined ? { ibge: dto.ibge } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Endereço não encontrado');
    await this.prisma.address.delete({ where: { id } });
    return { deleted: true };
  }
}
