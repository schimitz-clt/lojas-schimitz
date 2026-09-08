import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma.service';
import {
  computeShippingQuote,
  DEFAULT_SHIPPING_SETTINGS,
  normalizeCep,
  type ShippingQuoteResult,
} from './shipping.rules';
import type { ShippingProvider, ShippingQuote, ShippingQuoteInput } from './shipping.provider';

export type UpdateShippingSettingsInput = {
  freeAbove: number;
  defaultFee: number;
  defaultDays: number;
};

export type CreateCepRuleInput = {
  cepPrefix: string;
  fee: number;
  estimatedDays: number;
  label?: string | null;
  active?: boolean;
  sortOrder?: number;
};

export type UpdateCepRuleInput = Partial<CreateCepRuleInput>;

function serializeSettings(s: {
  id: string;
  freeAbove: Decimal | number;
  defaultFee: Decimal | number;
  defaultDays: number;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    freeAbove: Number(s.freeAbove),
    defaultFee: Number(s.defaultFee),
    defaultDays: s.defaultDays,
    updatedAt: s.updatedAt,
  };
}

function serializeRule(r: {
  id: string;
  cepPrefix: string;
  fee: Decimal | number;
  estimatedDays: number;
  label: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    cepPrefix: r.cepPrefix,
    fee: Number(r.fee),
    estimatedDays: r.estimatedDays,
    label: r.label,
    active: r.active,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function assertCepPrefix(raw: string): string {
  const digits = normalizeCep(raw);
  if (digits.length < 1 || digits.length > 8) {
    throw new BadRequestException(
      'Prefixo de CEP inválido. Use de 1 a 8 dígitos (ex.: 890 ou 89010).',
    );
  }
  return digits;
}

@Injectable()
export class ShippingService implements ShippingProvider {
  name = 'self-delivery';

  constructor(private readonly prisma: PrismaService) {}

  async ensureSettings() {
    const existing = await this.prisma.shippingSettings.findUnique({ where: { id: 'default' } });
    const settings =
      existing ??
      (await this.prisma.shippingSettings.create({
        data: {
          id: 'default',
          freeAbove: new Decimal(DEFAULT_SHIPPING_SETTINGS.freeAbove),
          defaultFee: new Decimal(DEFAULT_SHIPPING_SETTINGS.defaultFee),
          defaultDays: DEFAULT_SHIPPING_SETTINGS.defaultDays,
        },
      }));
    await this.ensureDefaultPoaRules();
    return settings;
  }

  /**
   * Porto Alegre usa CEPs 90xxx e 91xxx (ex.: 91160-390, warehouse origin-91250).
   * Idempotente: só cria prefixo ausente — não sobrescreve regras admin.
   */
  async ensureDefaultPoaRules() {
    const defaults: { cepPrefix: string; label: string }[] = [
      { cepPrefix: '90', label: 'Porto Alegre (90) — frete grátis' },
      { cepPrefix: '91', label: 'Porto Alegre (91) — frete grátis' },
    ];
    for (const d of defaults) {
      const found = await this.prisma.shippingCepRule.findFirst({
        where: { cepPrefix: d.cepPrefix },
      });
      if (found) continue;
      await this.prisma.shippingCepRule.create({
        data: {
          cepPrefix: d.cepPrefix,
          fee: new Decimal(0),
          estimatedDays: 1,
          label: d.label,
          active: true,
          sortOrder: 10,
        },
      });
    }
  }

  async quote(input: ShippingQuoteInput): Promise<ShippingQuote> {
    const full = await this.quoteDetailed(input);
    return {
      price: full.price,
      days: full.days,
      carrier: full.carrier,
      modality: full.modality,
      matchedPrefix: full.matchedPrefix,
      label: full.label,
      freeAbove: full.freeAbove,
    };
  }

  async quoteDetailed(input: ShippingQuoteInput): Promise<ShippingQuoteResult> {
    const settingsRow = await this.ensureSettings();
    const rules = await this.prisma.shippingCepRule.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'desc' }],
    });
    return computeShippingQuote({
      cep: input.cep,
      subtotal: input.subtotal,
      settings: {
        freeAbove: Number(settingsRow.freeAbove),
        defaultFee: Number(settingsRow.defaultFee),
        defaultDays: settingsRow.defaultDays,
      },
      rules: rules.map((r) => ({
        cepPrefix: r.cepPrefix,
        fee: Number(r.fee),
        estimatedDays: r.estimatedDays,
        label: r.label,
        sortOrder: r.sortOrder,
      })),
    });
  }

  async getAdminConfig() {
    const settings = serializeSettings(await this.ensureSettings());
    const rules = await this.prisma.shippingCepRule.findMany({
      orderBy: [{ sortOrder: 'desc' }, { cepPrefix: 'asc' }],
    });
    return { settings, rules: rules.map(serializeRule) };
  }

  async updateSettings(input: UpdateShippingSettingsInput) {
    if (!(input.freeAbove >= 0)) throw new BadRequestException('Valor de frete grátis inválido');
    if (!(input.defaultFee >= 0)) throw new BadRequestException('Taxa padrão inválida');
    if (!(Number.isInteger(input.defaultDays) && input.defaultDays >= 1 && input.defaultDays <= 60)) {
      throw new BadRequestException('Prazo padrão deve ser entre 1 e 60 dias');
    }
    await this.ensureSettings();
    const row = await this.prisma.shippingSettings.update({
      where: { id: 'default' },
      data: {
        freeAbove: new Decimal(input.freeAbove),
        defaultFee: new Decimal(input.defaultFee),
        defaultDays: input.defaultDays,
      },
    });
    return serializeSettings(row);
  }

  async createRule(input: CreateCepRuleInput) {
    const cepPrefix = assertCepPrefix(input.cepPrefix);
    if (!(input.fee >= 0)) throw new BadRequestException('Taxa da zona inválida');
    if (!(Number.isInteger(input.estimatedDays) && input.estimatedDays >= 1 && input.estimatedDays <= 60)) {
      throw new BadRequestException('Prazo estimado deve ser entre 1 e 60 dias');
    }
    const row = await this.prisma.shippingCepRule.create({
      data: {
        cepPrefix,
        fee: new Decimal(input.fee),
        estimatedDays: input.estimatedDays,
        label: input.label?.trim() || null,
        active: input.active ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return serializeRule(row);
  }

  async updateRule(id: string, input: UpdateCepRuleInput) {
    const existing = await this.prisma.shippingCepRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Regra de CEP não encontrada');

    const data: Prisma.ShippingCepRuleUpdateInput = {};
    if (input.cepPrefix !== undefined) data.cepPrefix = assertCepPrefix(input.cepPrefix);
    if (input.fee !== undefined) {
      if (!(input.fee >= 0)) throw new BadRequestException('Taxa da zona inválida');
      data.fee = new Decimal(input.fee);
    }
    if (input.estimatedDays !== undefined) {
      if (
        !(
          Number.isInteger(input.estimatedDays) &&
          input.estimatedDays >= 1 &&
          input.estimatedDays <= 60
        )
      ) {
        throw new BadRequestException('Prazo estimado deve ser entre 1 e 60 dias');
      }
      data.estimatedDays = input.estimatedDays;
    }
    if (input.label !== undefined) data.label = input.label?.trim() || null;
    if (input.active !== undefined) data.active = input.active;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const row = await this.prisma.shippingCepRule.update({ where: { id }, data });
    return serializeRule(row);
  }

  async deleteRule(id: string) {
    const existing = await this.prisma.shippingCepRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Regra de CEP não encontrada');
    await this.prisma.shippingCepRule.delete({ where: { id } });
    return { id, deleted: true };
  }
}
