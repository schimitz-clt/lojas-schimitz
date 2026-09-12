import {
  CarrierLiveNotWiredError,
  CarrierNotConfiguredError,
  type CarrierProvider,
  type CarrierQuoteInput,
  type CarrierQuoteResult,
  type CreateLabelInput,
  type CreateLabelResult,
  type TrackInput,
  type TrackResult,
} from './carrier.types';

/**
 * Stub Melhor Envio — prepara o adapter real sem fingir sucesso.
 * Sem tokens → NOT_CONFIGURED.
 * Com tokens → CARRIER_LIVE_NOT_WIRED (sem HTTP, sem cobrança, sem tracking fake).
 */
export class MelhorEnvioCarrierProvider implements CarrierProvider {
  readonly name = 'melhor_envio';

  /** Presence-only check — never log or return secret values. */
  static isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    const token = (env.MELHOR_ENVIO_TOKEN || env.MELHOR_ENVIO_ACCESS_TOKEN || '').trim();
    return token.length > 0;
  }

  isConfigured(): boolean {
    return MelhorEnvioCarrierProvider.isConfigured();
  }

  private assertReady(): void {
    if (!this.isConfigured()) {
      throw new CarrierNotConfiguredError(
        'melhor_envio',
        'Melhor Envio não configurado: defina MELHOR_ENVIO_TOKEN (ou MELHOR_ENVIO_ACCESS_TOKEN) no ambiente. Nunca commitar o token.',
      );
    }
    // Credentials present — still no live HTTP in Phase 14.
    throw new CarrierLiveNotWiredError('melhor_envio');
  }

  async quote(_input: CarrierQuoteInput): Promise<CarrierQuoteResult> {
    this.assertReady();
    // unreachable — assertReady always throws
    throw new CarrierLiveNotWiredError('melhor_envio');
  }

  async createLabel(_input: CreateLabelInput): Promise<CreateLabelResult> {
    this.assertReady();
    throw new CarrierLiveNotWiredError('melhor_envio');
  }

  async track(_input: TrackInput): Promise<TrackResult> {
    this.assertReady();
    throw new CarrierLiveNotWiredError('melhor_envio');
  }
}
