import type { CarrierProvider } from './carrier.types';
import { MelhorEnvioCarrierProvider } from './melhor-envio.carrier';
import { PropriaCarrierProvider } from './propria.carrier';

export type CarrierProviderMode = 'propria' | 'melhor_envio';

export function resolveCarrierProviderMode(
  env: NodeJS.ProcessEnv = process.env,
): CarrierProviderMode {
  const raw = String(env.CARRIER_PROVIDER || 'propria').toLowerCase().trim();
  if (raw === 'melhor_envio' || raw === 'melhorenvio' || raw === 'me') {
    return 'melhor_envio';
  }
  return 'propria';
}

/**
 * Selects the label/track CarrierProvider from env.
 * Default: propria (manual). CARRIER_PROVIDER=melhor_envio still does not buy labels:
 * createLabel/track throw CARRIER_LIVE_NOT_WIRED.
 * A cotação de frete da vitrine não passa por aqui — ShippingService chama o calculate
 * do Melhor Envio sempre que o token existe, sem mudar CARRIER_PROVIDER.
 */
export function createCarrierProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CarrierProvider {
  const mode = resolveCarrierProviderMode(env);
  if (mode === 'melhor_envio') {
    return new MelhorEnvioCarrierProvider();
  }
  return new PropriaCarrierProvider();
}

export function isMelhorEnvioConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return MelhorEnvioCarrierProvider.isConfigured(env);
}
