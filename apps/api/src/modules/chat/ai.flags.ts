/**
 * Schimitz AI feature flags — default safe.
 * Tools + FAQ work without an LLM key. LLM is never required.
 */

export type ChatAiMode = 'off' | 'faq' | 'alfa';

function truthy(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'alfa'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

export function resolveChatAiMode(env: NodeJS.ProcessEnv = process.env): ChatAiMode {
  const enabled = truthy(env.SCHIMITZ_AI_ENABLED, true);
  const raw = (env.CHAT_AI_MODE || 'alfa').trim().toLowerCase();
  if (!enabled || raw === 'off') return 'off';
  if (raw === 'faq') return 'faq';
  return 'alfa';
}

export function llmKeyPresent(env: NodeJS.ProcessEnv = process.env): boolean {
  const key = (env.OPENAI_API_KEY || env.CHAT_API_KEY || '').trim();
  return key.length > 0;
}

/** Level 2 only in alfa AND when a key exists. Never force a paid call. */
export function llmAllowed(mode: ChatAiMode, hasKey: boolean): boolean {
  return mode === 'alfa' && hasKey;
}

export function publicToolNames(mode: ChatAiMode): string[] {
  if (mode === 'off') return [];
  if (mode === 'faq') return ['searchProducts', 'getStorePolicies'];
  return [
    'searchProducts',
    'getProduct',
    'compareProducts',
    'checkAvailability',
    'getStorePolicies',
    'getShippingEstimate',
  ];
}

export function privateToolNames(mode: ChatAiMode): string[] {
  if (mode === 'alfa') return ['getOrderStatus', 'getCustomerOrders'];
  return [];
}
