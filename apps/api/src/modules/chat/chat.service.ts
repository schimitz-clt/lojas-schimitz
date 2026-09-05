import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import type { ChatProductHit, ChatReply } from './chat.dto';
import { HANDOFF_MESSAGE, storeWhatsAppUrl } from './chat.facts';
import {
  extractSearchTerms,
  faqReply,
  isConversationId,
  looksLikeProductQuery,
  needsHandoff,
  noLlmFallbackReply,
  parseLlmJson,
} from './chat.intent';
import { appendTurn, getConversation, type ChatTurn } from './chat.memory';
import { buildSystemPrompt } from './chat.prompt';

type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

@Injectable()
export class ChatService {
  private readonly log = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  llmConfig(): LlmConfig | null {
    const apiKey = (process.env.OPENAI_API_KEY || process.env.CHAT_API_KEY || '').trim();
    if (!apiKey) return null;
    const baseUrl = (process.env.CHAT_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = process.env.CHAT_MODEL || 'gpt-4o-mini';
    return { apiKey, baseUrl, model };
  }

  async reply(input: { message: string; conversationId?: string }): Promise<ChatReply> {
    const message = (input.message || '').trim();
    const conversationId = isConversationId(input.conversationId) ? input.conversationId : randomUUID();
    const history = getConversation(conversationId);
    const handoffNow = needsHandoff(message);
    const products = await this.searchCatalog(message);
    const waText = handoffNow
      ? `Olá, vim pelo chat da Lojas Schimitz.\n\nAssunto: ${message.slice(0, 240)}`
      : undefined;
    const whatsappUrl = storeWhatsAppUrl(waText);

    if (handoffNow) {
      const reply = `${HANDOFF_MESSAGE} WhatsApp: ${whatsappUrl}`;
      this.remember(conversationId, message, reply);
      return { conversationId, reply, handoff: true, whatsappUrl, llm: false, products };
    }

    const llm = this.llmConfig();
    if (llm) {
      try {
        const generated = await this.callLlm(llm, history, message, products);
        if (generated) {
          const handoff = generated.handoff || needsHandoff(generated.reply);
          const reply = handoff && !/wa\.me\//i.test(generated.reply)
            ? `${generated.reply}\n\nWhatsApp: ${whatsappUrl}`
            : generated.reply;
          this.remember(conversationId, message, reply);
          return {
            conversationId,
            reply,
            handoff,
            whatsappUrl,
            llm: true,
            products,
          };
        }
      } catch (err) {
        this.log.warn(`LLM falhou, usando fallback: ${err instanceof Error ? err.message : err}`);
      }
    }

    const faq = faqReply(message);
    const reply = noLlmFallbackReply({ faq, hasProducts: products.length > 0 });
    this.remember(conversationId, message, reply);
    return {
      conversationId,
      reply,
      handoff: false,
      whatsappUrl,
      llm: false,
      products,
    };
  }

  private remember(conversationId: string, user: string, assistant: string) {
    appendTurn(conversationId, { role: 'user', content: user });
    appendTurn(conversationId, { role: 'assistant', content: assistant });
  }

  async searchCatalog(message: string): Promise<ChatProductHit[]> {
    if (!looksLikeProductQuery(message)) return [];
    const terms = extractSearchTerms(message);
    const q = message.trim();
    const or: Prisma.ProductWhereInput[] = [];
    if (q.length >= 2 && q.length <= 80) {
      or.push({ name: { contains: q, mode: 'insensitive' } });
      or.push({ sku: { contains: q, mode: 'insensitive' } });
    }
    for (const t of terms) {
      or.push({ name: { contains: t, mode: 'insensitive' } });
      or.push({ sku: { contains: t, mode: 'insensitive' } });
    }
    if (!or.length) return [];

    try {
      const rows = await this.prisma.product.findMany({
        where: { active: true, OR: or },
        include: { inventory: true },
        take: 6,
        orderBy: { updatedAt: 'desc' },
      });
      return rows.map((p) => {
        const onHand = p.inventory?.qtyOnHand ?? 0;
        const reserved = p.inventory?.qtyReserved ?? 0;
        return {
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          compareAtPrice: p.compareAtPrice == null ? null : Number(p.compareAtPrice),
          badge: p.badge,
          inStock: onHand - reserved > 0,
          path: `/produto/${p.slug}`,
        };
      });
    } catch (err) {
      this.log.warn(`Catálogo indisponível para o chat: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private async callLlm(
    llm: LlmConfig,
    history: ChatTurn[],
    message: string,
    products: ChatProductHit[],
  ): Promise<{ reply: string; handoff: boolean } | null> {
    const body = {
      model: llm.model,
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(products) },
        ...history.slice(-10),
        { role: 'user', content: message },
      ],
    };

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15000);
    try {
      const res = await fetch(`${llm.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${llm.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        this.log.warn(`LLM HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return null;
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content || '';
      return parseLlmJson(content);
    } finally {
      clearTimeout(timer);
    }
  }
}
