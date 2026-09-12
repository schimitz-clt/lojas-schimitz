/**
 * MEGA Phase 14 — logistics concept separation (do not collapse these):
 *
 * - FREIGHT   — price / ETA quote (ShippingProvider + CEP rules today).
 * - CARRIER   — who moves the parcel (propria | melhor_envio | …); label + track adapter.
 * - TRACKING  — Order.trackingCode (+ optional externalShipmentId later); customer-visible code.
 * - ORDER     — commerce aggregate + OrderStatus state machine (paid → … → delivered).
 * - DELIVERY  — fulfillment outcome (in_transit → delivered); not a separate DB entity yet.
 *
 * ShippingProvider remains the FREIGHT authority for checkout.
 * CarrierProvider prepares label/track adapters without claiming live carrier integration.
 */

export type CarrierQuoteInput = {
  cep: string;
  subtotal: number;
  items?: { qty: number; weightKg?: number }[];
};

export type CarrierQuoteResult = {
  price: number;
  days: number;
  carrier: string;
  service?: string;
  modality?: string;
  /** True when quote is informational / manual — FREIGHT still comes from ShippingProvider. */
  informational?: boolean;
};

export type CreateLabelInput = {
  orderId: string;
  publicId: string;
  trackingCode?: string | null;
  carrierHint?: string | null;
  addressSnap?: unknown;
};

export type CreateLabelResult = {
  carrier: string;
  trackingCode: string | null;
  labelUrl?: string | null;
  externalShipmentId?: string | null;
  /** manual = admin-entered; api = external carrier (not wired live in Phase 14). */
  mode: 'manual' | 'api';
};

export type TrackInput = {
  trackingCode: string;
  carrier?: string | null;
  externalShipmentId?: string | null;
};

export type TrackStatus =
  | 'unknown'
  | 'posted'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception';

export type TrackResult = {
  trackingCode: string;
  carrier: string;
  status: TrackStatus;
  events: { at?: string; description: string }[];
  /** Never invent sync success — adapters may omit raw entirely. */
  raw?: Record<string, unknown>;
};

export interface CarrierProvider {
  readonly name: string;
  quote(input: CarrierQuoteInput): Promise<CarrierQuoteResult>;
  createLabel(input: CreateLabelInput): Promise<CreateLabelResult>;
  track(input: TrackInput): Promise<TrackResult>;
}

/** Thrown when a live carrier adapter is selected/used without credentials. */
export class CarrierNotConfiguredError extends Error {
  readonly code = 'NOT_CONFIGURED' as const;
  readonly status = 503;
  readonly carrier: string;

  constructor(carrier: string, message?: string) {
    super(
      message ||
        `Transportadora "${carrier}" não configurada (credenciais ausentes). Use CARRIER_PROVIDER=propria ou configure tokens no ambiente.`,
    );
    this.name = 'CarrierNotConfiguredError';
    this.carrier = carrier;
  }
}

/** Credentials present but HTTP live path intentionally not wired — never fake success. */
export class CarrierLiveNotWiredError extends Error {
  readonly code = 'CARRIER_LIVE_NOT_WIRED' as const;
  readonly status = 501;
  readonly carrier: string;

  constructor(carrier: string, message?: string) {
    super(
      message ||
        `Adapter live "${carrier}" ainda não implementado — credenciais detectadas, sem chamada HTTP / cobrança.`,
    );
    this.name = 'CarrierLiveNotWiredError';
    this.carrier = carrier;
  }
}
