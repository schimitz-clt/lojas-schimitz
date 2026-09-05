import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './common/audit.service';
import { InventoryService } from './modules/inventory/inventory.service';
import { createPaymentProviderFromEnv } from './modules/payments/payment.provider';

@Global()
@Module({
  providers: [
    PrismaService,
    AuditService,
    InventoryService,
    { provide: 'PaymentProvider', useFactory: () => createPaymentProviderFromEnv() },
  ],
  exports: [PrismaService, AuditService, InventoryService, 'PaymentProvider'],
})
export class PrismaModule {}
