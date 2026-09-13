/**
 * Structured chat/AI logs — intent, tools, llm, latency.
 * Never dump PII, message text, emails, tokens or API keys.
 */

import { structuredLog } from '../../common/structured-log';

export type ChatObserveFields = {
  intent: string;
  tools: string[];
  llm: boolean;
  level: 0 | 1 | 2;
  latencyMs: number;
  conversationId?: string;
  productCount?: number;
  refused?: boolean;
  reason?: string;
};

function convTag(id?: string): string | undefined {
  if (!id || typeof id !== 'string') return undefined;
  // Last 8 chars only — enough to correlate, not a full identifier dump.
  return id.replace(/[^a-z0-9-]/gi, '').slice(-8) || undefined;
}

export function logChatTurn(fields: ChatObserveFields): void {
  structuredLog('info', 'schimitz_ai', {
    intent: fields.intent,
    tools: Array.isArray(fields.tools) ? fields.tools.slice(0, 8) : [],
    llm: Boolean(fields.llm),
    level: fields.level,
    latencyMs: Math.max(0, Math.round(fields.latencyMs)),
    conversation: convTag(fields.conversationId),
    productCount: fields.productCount ?? 0,
    refused: Boolean(fields.refused),
    ...(fields.reason ? { reason: fields.reason } : {}),
  });
}
