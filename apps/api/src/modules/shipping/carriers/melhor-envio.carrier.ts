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
import {
  calculateMelhorEnvioFreight,
  readMelhorEnvioToken,
  type MelhorEnvioFetch,
} from './melhor-envio.quote';

/**
 * Melhor Envio — cotação HTTP real quando há token.
 * createLabel e track continuam NOT_WIRED (sem compra de etiqueta, sem rastreio inventado).
 * Sem token, quote lança NOT_CONFIGURED — não devolve taxa padrão.
 */
export class MelhorEnvioCarrierProvider implements CarrierProvider {
  readonly name = 'melhor_envio';

  constructor(
    private readonly fetchImpl?: MelhorEnvioFetch,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  /** Presence-only check — never log or return secret values. */
  static isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return readMelhorEnvioToken(env).length > 0;
  }

  isConfigured(): boolean {
    return MelhorEnvioCarrierProvider.isConfigured(this.env);
  }

  private tokenOrThrow(): string {
    const token = readMelhorEnvioToken(this.env);
    if (!token) {
      throw new CarrierNotConfiguredError(
        'melhor_envio',
        'Melhor Envio não configurado: defina MELHOR_ENVIO_TOKEN (ou MELHOR_ENVIO_ACCESS_TOKEN) no ambiente. Nunca commitar o token.',
      );
    }
    return token;
  }

  async quote(input: CarrierQuoteInput): Promise<CarrierQuoteResult> {
    const token = this.tokenOrThrow();
    const picked = await calculateMelhorEnvioFreight({
      token,
      env: this.env,
      toCep: input.cep,
      subtotal: input.subtotal,
      items: input.items,
      fetchImpl: this.fetchImpl,
    });
    return {
      price: picked.price,
      days: picked.days,
      carrier: picked.company,
      service: picked.service,
      modality: picked.service,
      informational: false,
      assumedPackage: picked.assumedPackage,
    };
  }

  async createLabel(_input: CreateLabelInput): Promise<CreateLabelResult> {
    this.tokenOrThrow();
    throw new CarrierLiveNotWiredError(
      'melhor_envio',
      'Compra de etiqueta Melhor Envio não está ligada — a cotação não compra frete. Etiqueta continua manual (envio próprio).',
    );
  }

  async track(_input: TrackInput): Promise<TrackResult> {
    this.tokenOrThrow();
    throw new CarrierLiveNotWiredError(
      'melhor_envio',
      'Rastreio Melhor Envio não está ligado. Não há sincronização automática de status.',
    );
  }
}
