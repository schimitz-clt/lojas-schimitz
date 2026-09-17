'use client';

import type { ReactNode } from 'react';
import {
  orderStatusChipClass,
  productActiveChipClass,
  productStockChipClass,
  type AdminChipTone,
} from '@/lib/admin-pro-ui';

type Props = {
  label: string;
  tone?: AdminChipTone;
  title?: string;
  className?: string;
};

/** Compact professional status/meta chip for Pedidos + Catálogo. */
export function AdminStatusChip({ label, tone, title, className }: Props): ReactNode {
  const toneClass = tone ? `admin-chip-status admin-chip-status--${tone}` : 'admin-chip-status';
  return (
    <span className={`${toneClass}${className ? ` ${className}` : ''}`} title={title}>
      {label}
    </span>
  );
}

export function AdminOrderStatusChip({
  status,
  label,
}: {
  status: string;
  label: string;
}): ReactNode {
  return <span className={orderStatusChipClass(status)}>{label}</span>;
}

export function AdminProductActiveChip({ active }: { active: boolean }): ReactNode {
  return (
    <span className={productActiveChipClass(active)}>{active ? 'Ativo' : 'Inativo'}</span>
  );
}

export function AdminProductStockChip({
  onHand,
  threshold,
  active = true,
  label,
}: {
  onHand: number;
  threshold: number;
  active?: boolean;
  label: string;
}): ReactNode {
  return <span className={productStockChipClass(onHand, threshold, active)}>{label}</span>;
}
