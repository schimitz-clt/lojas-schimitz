/**
 * Cost levels: 0 FAQ/rules → 1 structured tools → 2 LLM only when needed.
 * Deterministic intent → tool routing (cheaper than an LLM tool loop).
 */

import { llmAllowed, type ChatAiMode } from './ai.flags';
import {
  classifyIntent,
  extractBudgetMax,
  extractCategoryHint,
  extractCepFromMessage,
  extractOrderPublicId,
  extractProductRefs,
  extractSearchTerms,
  type ChatIntent,
} from './chat.intent';

export type PlannedTool = { name: string; args: Record<string, unknown> };

export type RoutePlan = {
  intent: ChatIntent;
  level: 0 | 1 | 2;
  tools: PlannedTool[];
  useLlm: boolean;
};

function searchArgs(message: string): Record<string, unknown> {
  const terms = extractSearchTerms(message);
  const query = terms.slice(0, 5).join(' ') || message.trim().slice(0, 80);
  const category = extractCategoryHint(message);
  const budgetMax = extractBudgetMax(message);
  return {
    query,
    ...(category ? { category } : {}),
    ...(budgetMax != null ? { budgetMax } : {}),
  };
}

export function planChatTurn(input: {
  message: string;
  mode: ChatAiMode;
  hasLlm: boolean;
  userId?: string | null;
}): RoutePlan {
  const message = input.message || '';
  const intent = classifyIntent(message);
  const allowLlm = llmAllowed(input.mode, input.hasLlm);

  if (input.mode === 'off') {
    return { intent, level: 0, tools: [], useLlm: false };
  }

  if (intent === 'handoff' || intent === 'refuse') {
    return { intent, level: 0, tools: [], useLlm: false };
  }

  if (intent === 'faq') {
    const tools: PlannedTool[] =
      input.mode === 'alfa' ? [{ name: 'getStorePolicies', args: {} }] : [];
    return { intent, level: 0, tools, useLlm: false };
  }

  if (input.mode === 'faq') {
    if (intent === 'search' || intent === 'get_product' || intent === 'availability' || intent === 'compare') {
      return { intent, level: 1, tools: [{ name: 'searchProducts', args: searchArgs(message) }], useLlm: false };
    }
    if (intent === 'policies' || intent === 'shipping') {
      return { intent, level: 0, tools: [{ name: 'getStorePolicies', args: {} }], useLlm: false };
    }
    return { intent, level: 0, tools: [], useLlm: false };
  }

  // alfa
  const tools: PlannedTool[] = [];

  if (intent === 'policies') {
    tools.push({ name: 'getStorePolicies', args: {} });
  } else if (intent === 'shipping') {
    const cep = extractCepFromMessage(message);
    tools.push({ name: 'getShippingEstimate', args: cep ? { cep } : {} });
    tools.push({ name: 'getStorePolicies', args: {} });
  } else if (intent === 'compare') {
    const refs = extractProductRefs(message);
    if (refs.length >= 2) {
      tools.push({ name: 'compareProducts', args: { refs } });
    } else {
      tools.push({ name: 'searchProducts', args: searchArgs(message) });
    }
  } else if (intent === 'get_product') {
    const refs = extractProductRefs(message);
    if (refs[0]) tools.push({ name: 'getProduct', args: { ref: refs[0] } });
    else tools.push({ name: 'searchProducts', args: searchArgs(message) });
  } else if (intent === 'availability') {
    const refs = extractProductRefs(message);
    if (refs[0]) tools.push({ name: 'checkAvailability', args: { ref: refs[0] } });
    else tools.push({ name: 'searchProducts', args: searchArgs(message) });
  } else if (intent === 'search') {
    tools.push({ name: 'searchProducts', args: searchArgs(message) });
  } else if (intent === 'order') {
    const publicId = extractOrderPublicId(message);
    if (publicId) tools.push({ name: 'getOrderStatus', args: { publicId } });
    else tools.push({ name: 'getCustomerOrders', args: {} });
  } else if (intent === 'general') {
    // Cheap catalog peek only if there are searchable terms
    const terms = extractSearchTerms(message);
    if (terms.length >= 2) {
      tools.push({ name: 'searchProducts', args: searchArgs(message) });
    }
  }

  const hasPrivate = tools.some((t) => t.name === 'getOrderStatus' || t.name === 'getCustomerOrders');
  const useLlm = allowLlm && intent === 'general' && !hasPrivate;
  const level: 0 | 1 | 2 = useLlm ? 2 : tools.length ? 1 : 0;
  return { intent, level, tools, useLlm };
}
