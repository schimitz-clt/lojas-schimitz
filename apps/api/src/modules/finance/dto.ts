import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsBoolean, IsIn, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Every controlled admin action requires an explicit confirmation + a written reason (audited). */
export class ConfirmedActionDto {
  @ApiProperty({ description: 'Motivo (mín. 10 caracteres) — gravado na auditoria' })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;

  @ApiProperty({ description: 'Deve ser true (confirmação explícita)' })
  @IsBoolean()
  @Equals(true, { message: 'confirm deve ser true' })
  confirm!: boolean;
}

export class ReconcileDto extends ConfirmedActionDto {
  @ApiProperty({ enum: ['ORDER', 'PAYMENT', 'PERIOD'] })
  @IsIn(['ORDER', 'PAYMENT', 'PERIOD'])
  scope!: 'ORDER' | 'PAYMENT' | 'PERIOD';

  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() paymentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() to?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoRepair?: boolean;
}

export class RefundRequestDto extends ConfirmedActionDto {
  @ApiPropertyOptional({ description: 'Valor parcial em BRL; omitir = estorno total do saldo' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;
}

export class ReviewDto extends ConfirmedActionDto {
  @ApiProperty({ enum: ['UNDER_REVIEW', 'CLEARED'] })
  @IsIn(['UNDER_REVIEW', 'CLEARED'])
  status!: 'UNDER_REVIEW' | 'CLEARED';
}

export class ResolveDiscrepancyDto extends ConfirmedActionDto {
  @ApiPropertyOptional({ enum: ['RESOLVED', 'ACKNOWLEDGED'] })
  @IsOptional()
  @IsIn(['RESOLVED', 'ACKNOWLEDGED'])
  status?: 'RESOLVED' | 'ACKNOWLEDGED';
}

/**
 * Manual ledger adjustment (ADJUSTMENT_CREATED). Append-only: a wrong adjustment is corrected by a
 * new opposite adjustment, never by editing/deleting. Must reference a payment and/or an order.
 */
export class LedgerAdjustmentDto extends ConfirmedActionDto {
  @ApiProperty({ enum: ['CREDIT', 'DEBIT'], description: 'CREDIT = entrada, DEBIT = saída' })
  @IsIn(['CREDIT', 'DEBIT'])
  direction!: 'CREDIT' | 'DEBIT';

  @ApiProperty({ description: 'Valor em BRL (> 0, até 2 casas)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  amount!: number;

  @ApiPropertyOptional() @IsOptional() @IsUUID() paymentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
}
