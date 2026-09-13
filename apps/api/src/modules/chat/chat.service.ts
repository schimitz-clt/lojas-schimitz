import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { ShippingService } from '../shipping/shipping.service';
import type { ChatProductHit, ChatReply, ChatStatus } from './chat.dto';
import { HANDOFF_MESSAGE, storeWhatsAppUrl } from './chat.facts';
import {
  faqReply,
  isConversationId,
  noLlmFallbackReply,
  parseLlmJson,
} from './chat.intent';
import { appendTurn, getConversation, type ChatTurn } from './chat.memory';
import { buildSystemPrompt } from './chat.prompt';
import { llmAllowed, llmKeyPresent, privateToolNames, publicToolNames, resolveChatAiMode } from './ai.flags';
import { logChatTurn } from './ai.observe';
import { createAiProvider, type AiChatMessage, type AiProvider } from './ai.provider';
import { planChatTurn } from './ai.router';
import { assessUserMessage, wrapUserAsData } from './ai.security';
import {
  collectProducts,
  executeTool,
  toolsExposedToLlm,
  type ToolContext,
  type ToolResult,
} from './ai.tools';

@Injectable()
export class ChatService {
  private readonly log = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipping: ShippingService,
  ) {}

  status(): ChatStatus {
    const mode = resolveChatAiMode();
    return {
      name: 'Schimitz AI',
      phase: 'alfa',
      mode,
      llmConfigured: llmKeyPresent(),
      tools: publicToolNames(mode),
      privateTools: privateToolNames(mode),
    };
  }

  async reply(input: { message: string; conversationId?: string; userId?: string | null }): Promise<ChatReply> {
    const started = Date.now();
    const mode = resolveChatAiMode();
    const hasLlm = llmKeyPresent();
    const verdict = assessUserMessage(input.message);
    const conversationId = isConversationId(input.conversationId) ? input.conversationId : randomUUID();
    const history = getConversation(conversationId);
    const whatsappUrl = storeWhatsAppUrl();

    if (verdict.action === 'refuse') {
      this.remember(conversationId, verdict.sanitized, verdict.reply);
      logChatTurn({
        intent: 'refuse',
        tools: [],
        llm: false,
        level: 0,
        latencyMs: Date.now() - started,
        conversationId,
        refused: true,
        reason: verdict.reason,
      });
      return {
        conversationId,
        reply: verdict.reply,
        handoff: false,
        whatsappUrl,
        llm: false,
        products: [],
        level: 0,
        tools: [],
        intent: 'refuse',
      };
    }

    const message = verdict.sanitized;
    const plan = planChatTurn({ message, mode, hasLlm, userId: input.userId });
    const handoffNow = plan.intent === 'handoff';
    const waText = handoffNow
      ? `Olá, vim pelo chat da Lojas Schimitz.\n\nAssunto: ${message.slice(0, 240)}`
      : undefined;
    const wa = storeWhatsAppUrl(waText);

    if (handoffNow) {
      const reply = `${HANDOFF_MESSAGE} WhatsApp: ${wa}`;
      this.remember(conversationId, message, reply);
      logChatTurn({
        intent: plan.intent,
        tools: [],
        llm: false,
        level: 0,
        latencyMs: Date.now() - started,
        conversationId,
      });
      return { conversationId, reply, handoff: true, whatsappUrl: wa, llm: false, products: [], level: 0, tools: [], intent: plan.intent };
    }

    const ctx: ToolContext = {
      userId: input.userId,
      prisma: this.prisma,
      shipping: this.shipping,
    };

    const toolResults: ToolResult[] = [];
    for (const t of plan.tools) {
      try {
        toolResults.push(await executeTool(t.name, t.args, ctx));
      } catch (err) {
        this.log.warn(`tool ${t.name} falhou: ${err instanceof Error ? err.message : err}`);
        toolResults.push({ name: t.name, ok: false, code: 'TOOL_ERROR', data: null });
      }
    }

    const products = collectProducts(toolResults);

    let llmUsed = false;
    let generated: { reply: string; handoff: boolean } | null = null;
    if (plan.useLlm && llmAllowed(mode, hasLlm)) {
      try {
        const provider = createAiProvider();
        if (provider) {
          generated = await this.callLlm(provider, history, message, products, toolResults);
          if (generated) llmUsed = true;
        }
      } catch (err) {
        this.log.warn(`LLM falhou, usando fallback: ${err instanceof Error ? err.message : err}`);
      }
    }

    let reply: string;
    let handoff = false;
    if (generated) {
      handoff = generated.handoff;
      reply = handoff && !/wa\.me\//i.test(generated.reply) ? `${generated.reply}\n\nWhatsApp: ${wa}` : generated.reply;
    } else {
      reply = this.deterministicReply(message, plan.intent, toolResults, products);
    }

    this.remember(conversationId, message, reply);
    logChatTurn({
      intent: plan.intent,
      tools: toolResults.map((t) => t.name),
      llm: llmUsed,
      level: llmUsed ? 2 : plan.level,
      latencyMs: Date.now() - started,
      conversationId,
      productCount: products.length,
    });
    return {
      conversationId,
      reply,
      handoff,
      whatsappUrl: wa,
      llm: llmUsed,
      products,
      level: llmUsed ? 2 : plan.level,
      tools: toolResults.map((t) => t.name),
      intent: plan.intent,
    };
  }

  private remember(conversationId: string, user: string, assistant: string) {
    appendTurn(conversationId, { role: 'user', content: user });
    appendTurn(conversationId, { role: 'assistant', content: assistant });
  }

  private deterministicReply(
    message: string,
    intent: string,
    toolResults: ToolResult[],
    products: ChatProductHit[],
  ): string {
    const faq = faqReply(message);

    if (intent === 'order') {
      const orderTool = toolResults.find((t) => t.name === 'getOrderStatus' || t.name === 'getCustomerOrders');
      if (!orderTool || orderTool.code === 'LOGIN_REQUIRED') {
        return 'Para ver pedidos é preciso entrar na conta. Acompanhe em /pedidos — o visitante não acessa pedido de outra pessoa. WhatsApp (51) 99625-3766 se precisar de ajuda.';
      }
      if (orderTool.code === 'ORDER_NOT_FOUND') {
        return 'Não encontrei esse pedido na sua conta. Confira o código em /pedidos. Não mostro pedido de outro cliente.';
      }
      if (orderTool.code === 'NEED_ORDER_ID') {
        return 'Me envie o código do pedido (SCH-…) da sua conta, ou veja a lista em /pedidos.';
      }
      if (orderTool.ok && orderTool.name === 'getOrderStatus') {
        const o = (orderTool.data as { order?: { publicId: string; status: string; trackingCode?: string | null } })?.order;
        if (o) {
          const track = o.trackingCode ? ` Rastreio: ${o.trackingCode}.` : '';
          return `Pedido ${o.publicId}: status ${o.status}.${track} Detalhes em /pedidos/${o.publicId}.`;
        }
      }
      if (orderTool.ok && orderTool.name === 'getCustomerOrders') {
        const orders = (orderTool.data as { orders?: { publicId: string; status: string }[] })?.orders || [];
        if (!orders.length) return 'Não há pedidos recentes nesta conta. Veja /pedidos.';
        const lines = orders.slice(0, 5).map((o) => `${o.publicId} (${o.status})`).join(', ');
        return `Seus pedidos recentes: ${lines}. Detalhes em /pedidos.`;
      }
    }

    if (intent === 'shipping') {
      const ship = toolResults.find((t) => t.name === 'getShippingEstimate');
      if (ship?.code === 'NEED_CEP') {
        return 'Frete grátis em Porto Alegre (CEP iniciando em 90). Fora de POA, cotamos no checkout. Informe um CEP de 8 dígitos se quiser uma estimativa agora.';
      }
      if (ship?.ok && ship.data && typeof ship.data === 'object') {
        const q = ship.data as { price?: number; days?: number; label?: string | null };
        const price = Number(q.price);
        const label = q.label || (price <= 0 ? 'Frete grátis' : `R$ ${price.toFixed(2).replace('.', ',')}`);
        const days = q.days != null ? ` Prazo estimado: ${q.days} dia(s).` : '';
        return `Cotação pela regra da loja: ${label}.${days} O checkout confirma o valor final — eu só apresento.`;
      }
      if (faq) return faq;
    }

    if (intent === 'get_product' || intent === 'availability') {
      const miss = toolResults.find((t) => t.code === 'NOT_FOUND');
      if (miss && !products.length) {
        return 'Não encontrei esse produto no catálogo atual. Não invento item, preço nem estoque. Tente outro nome/modelo ou veja /produtos.';
      }
    }

    if (intent === 'compare') {
      const amb = toolResults.find((t) => t.name === 'compareProducts' && t.code === 'AMBIGUOUS');
      if (amb) {
        const cands =
          (amb.data as { products?: { name?: string }[] } | null)?.products?.map((p) => p.name).filter(Boolean) ||
          products.map((p) => p.name);
        const names = cands.slice(0, 5).join(', ');
        return names
          ? `Encontrei mais de uma opção (${names}). Qual exatamente você quer comparar? Não invento produto.`
          : 'Encontrei mais de uma opção no catálogo. Qual exatamente você quer comparar? Não invento produto.';
      }
      const miss = toolResults.find((t) => t.name === 'compareProducts' && (t.code === 'NOT_FOUND' || t.code === 'NEED_TWO'));
      if (miss && products.length < 2) {
        return 'Não consegui comparar: preciso de dois produtos claros do catálogo. Diga os nomes ou slugs (ex.: compara geladeira e aspirador).';
      }
    }

    if (products.length) {
      if (intent === 'compare' && products.length >= 2) {
        return 'Comparei só o que está no catálogo. Preço, PIX (5% off) e estoque são os da loja — sem atributos inventados.';
      }
      if (intent === 'availability') {
        const p = products[0];
        return p.inStock
          ? `${p.name} está em estoque no catálogo atual. Preço da loja: confirme na página do produto.`
          : `${p.name} está sem estoque no momento. Não reservo nem invento disponibilidade.`;
      }
      return 'Encontrei estas opções no catálogo atual. Os preços são os da loja — não invento produto que não esteja listado.';
    }

    if (faq) return faq;
    return noLlmFallbackReply({ faq: null, hasProducts: false });
  }

  private async callLlm(
    provider: AiProvider,
    history: ChatTurn[],
    message: string,
    products: ChatProductHit[],
    priorTools: ToolResult[],
  ): Promise<{ reply: string; handoff: boolean } | null> {
    const toolNote = priorTools.length
      ? `\nRESULTADOS DAS TOOLS (fonte única; não invente além disto):\n${JSON.stringify(
          priorTools.map((t) => ({ name: t.name, code: t.code, data: t.data })),
        ).slice(0, 3500)}`
      : '';

    const messages: AiChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(products) + toolNote },
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: wrapUserAsData(message) },
    ];

    // Optional one extra tool round, then a JSON-only close. Max 2 HTTP calls.
    let completion = await provider.complete({
      messages,
      tools: toolsExposedToLlm(),
      temperature: 0.2,
      maxTokens: 400,
    });

    if (completion.toolCalls.length) {
      const ctx: ToolContext = { prisma: this.prisma, shipping: this.shipping, userId: null };
      messages.push({
        role: 'assistant',
        content: completion.content || '',
      });
      for (const call of completion.toolCalls.slice(0, 3)) {
        // Private tools are not in toolsExposedToLlm; still deny if a model hallucinates the name.
        const result = await executeTool(call.name, call.arguments, ctx);
        messages.push({
          role: 'tool',
          name: call.name,
          tool_call_id: call.id,
          content: JSON.stringify({ code: result.code, data: result.data }).slice(0, 2500),
        });
      }
      completion = await provider.complete({
        messages,
        json: true,
        temperature: 0.2,
        maxTokens: 400,
      });
    }

    return parseLlmJson(completion.content || '');
  }
}
