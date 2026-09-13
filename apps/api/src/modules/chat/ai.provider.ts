/**
 * Swappable OpenAI-compatible provider. Never logs the API key.
 * When no key is configured, callers must skip LLM (FAQ + tools still work).
 */

export type AiRole = 'system' | 'user' | 'assistant' | 'tool';

export type AiChatMessage = {
  role: AiRole;
  content: string;
  name?: string;
  tool_call_id?: string;
};

export type AiToolSpec = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

export type AiToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type AiCompletion = {
  content: string | null;
  toolCalls: AiToolCall[];
};

export type AiCompleteInput = {
  messages: AiChatMessage[];
  tools?: AiToolSpec[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
};

export interface AiProvider {
  readonly id: string;
  readonly model: string;
  complete(input: AiCompleteInput): Promise<AiCompletion>;
}

export type AiProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function readAiProviderConfig(env: NodeJS.ProcessEnv = process.env): AiProviderConfig | null {
  const apiKey = (env.OPENAI_API_KEY || env.CHAT_API_KEY || '').trim();
  if (!apiKey) return null;
  const baseUrl = (env.CHAT_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = (env.CHAT_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
  return { apiKey, baseUrl, model };
}

function parseToolArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore malformed tool args */
  }
  return {};
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly id = 'openai-compatible';
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(cfg: AiProviderConfig, timeoutMs = 15000) {
    this.apiKey = cfg.apiKey;
    this.baseUrl = cfg.baseUrl;
    this.model = cfg.model;
    this.timeoutMs = timeoutMs;
  }

  async complete(input: AiCompleteInput): Promise<AiCompletion> {
    const body: Record<string, unknown> = {
      model: this.model,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 400,
      messages: input.messages,
    };
    if (input.tools?.length) {
      body.tools = input.tools;
      body.tool_choice = 'auto';
    } else if (input.json) {
      // json_object + tools is not reliably supported; only force JSON on the final turn.
      body.response_format = { type: 'json_object' };
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 160)}`);
      }
      const json = (await res.json()) as {
        choices?: {
          message?: {
            content?: string | null;
            tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
          };
        }[];
      };
      const msg = json.choices?.[0]?.message;
      const toolCalls: AiToolCall[] = (msg?.tool_calls || [])
        .filter((c) => c.function?.name)
        .map((c, i) => ({
          id: c.id || `call_${i}`,
          name: String(c.function?.name),
          arguments: parseToolArgs(c.function?.arguments),
        }));
      const content = typeof msg?.content === 'string' ? msg.content : null;
      return { content, toolCalls };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createAiProvider(env: NodeJS.ProcessEnv = process.env): AiProvider | null {
  const cfg = readAiProviderConfig(env);
  if (!cfg) return null;
  return new OpenAiCompatibleProvider(cfg);
}
