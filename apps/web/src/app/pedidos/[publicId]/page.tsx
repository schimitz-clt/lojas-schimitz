'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { pixPrice, isPixPromoCollidingCouponCode } from '@/lib/pricing';
import { api, brl, isUnauthorizedError, waLink } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';
import { loginNextPath, orderRecoveryPaths, persistLastOrderPublicId, PIX_LEAVE_COPY } from '@/lib/order-recovery';
import {
  FULFILLMENT_STEPS,
  FULFILLMENT_JOURNEY_COPY,
  fulfillmentStepIndex,
  fulfillmentTimelineLabel,
  orderStatusLabel,
} from '@/lib/order-status';
import { isPixPaidLikeOrder, PIX_APPROVED_COPY, showPixGate } from '@/lib/pix-payment-ui';
import {
  buildCardIntentBody,
  CARD_APPROVED_COPY,
  CARD_PENDING_COPY,
  CARD_UNAVAILABLE_COPY,
  isCardBrickAvailable,
} from '@/lib/card-payment-ui';
import {
  deliveryEtaCopy,
  findDeliveredAt,
  type FreightSnapLike,
} from '@/lib/delivery-eta';
import { orderItemDisplayName, orderItemImageUrl } from '@/lib/order-card-ui';
import MercadoPagoCardBrick from '@/components/MercadoPagoCardBrick';
import { isPaymentSimulateUiEnabled, paymentSimulateWebhookSecret } from '@/lib/payment-simulate';
import { useOrderLiveReload } from '@/lib/use-order-live-reload';
import Link from 'next/link';
