/** Conversas em memória (Phase 1 — sem tabela Prisma). */

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

type Conversation = {
  id: string;
  messages: ChatTurn[];
  updatedAt: number;
};

const TTL_MS = 30 * 60 * 1000;
const MAX_CONV = 400;
const MAX_TURNS = 16;

const store = new Map<string, Conversation>();

function sweep(now = Date.now()) {
  for (const [id, c] of store) {
    if (now - c.updatedAt > TTL_MS) store.delete(id);
  }
  if (store.size <= MAX_CONV) return;
  const oldest = [...store.values()].sort((a, b) => a.updatedAt - b.updatedAt);
  for (const c of oldest.slice(0, store.size - MAX_CONV)) store.delete(c.id);
}

export function getConversation(id: string): ChatTurn[] {
  sweep();
  const c = store.get(id);
  return c ? c.messages.slice() : [];
}

export function appendTurn(id: string, turn: ChatTurn): ChatTurn[] {
  sweep();
  const prev = store.get(id);
  const messages = [...(prev?.messages ?? []), turn].slice(-MAX_TURNS);
  store.set(id, { id, messages, updatedAt: Date.now() });
  return messages.slice();
}

export function memorySize() {
  return store.size;
}
