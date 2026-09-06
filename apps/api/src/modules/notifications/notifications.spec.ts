/**
 * Centro de notificações — create / list / mark-read (store em memória).
 * Espelha o contrato de NotificationsService sem Postgres.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

type Notif = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  orderId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

class MemoryNotifications {
  private items: Notif[] = [];

  create(input: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    linkUrl?: string | null;
    orderId?: string | null;
  }) {
    const n: Notif = {
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body || '',
      linkUrl: input.linkUrl ?? null,
      orderId: input.orderId ?? null,
      readAt: null,
      createdAt: new Date(),
    };
    this.items.push(n);
    return n;
  }

  listForUser(userId: string, opts?: { unreadOnly?: boolean; limit?: number }) {
    let list = this.items.filter((n) => n.userId === userId);
    if (opts?.unreadOnly) list = list.filter((n) => !n.readAt);
    list = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const take = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const items = list.slice(0, take);
    const unreadCount = this.items.filter((n) => n.userId === userId && !n.readAt).length;
    return { items, unreadCount };
  }

  markRead(userId: string, id: string) {
    const n = this.items.find((x) => x.id === id && x.userId === userId);
    if (!n) throw new Error('NOT_FOUND');
    if (!n.readAt) n.readAt = new Date();
    return n;
  }

  markAllRead(userId: string) {
    let updated = 0;
    for (const n of this.items) {
      if (n.userId === userId && !n.readAt) {
        n.readAt = new Date();
        updated += 1;
      }
    }
    return { updated };
  }
}

const store = new MemoryNotifications();
const userA = 'user-a';
const userB = 'user-b';

const paid = store.create({
  userId: userA,
  type: 'order_paid',
  title: 'Pedido pago',
  body: 'Recebemos o pagamento do pedido SCH-1.',
  linkUrl: '/pedidos/SCH-1',
  orderId: 'ord-1',
});
const status = store.create({
  userId: userA,
  type: 'order_status',
  title: 'Pedido: Em trânsito',
  body: 'Seu pedido SCH-1 agora está: Em trânsito.',
  linkUrl: '/pedidos/SCH-1',
  orderId: 'ord-1',
});
store.create({
  userId: userB,
  type: 'order_paid',
  title: 'Pedido pago',
  body: 'outro usuário',
});

{
  const list = store.listForUser(userA);
  assert.equal(list.items.length, 2);
  assert.equal(list.unreadCount, 2);
  assert.equal(list.items[0].id, status.id); // mais recente primeiro
  assert.equal(list.items[1].id, paid.id);
  console.log('notifications: list ordenado + unread — PASSOU');
}

{
  const onlyA = store.listForUser(userA);
  assert.ok(onlyA.items.every((n) => n.userId === userA));
  const onlyB = store.listForUser(userB);
  assert.equal(onlyB.items.length, 1);
  console.log('notifications: isolamento por usuário — PASSOU');
}

{
  store.markRead(userA, paid.id);
  const list = store.listForUser(userA);
  assert.equal(list.unreadCount, 1);
  const unreadOnly = store.listForUser(userA, { unreadOnly: true });
  assert.equal(unreadOnly.items.length, 1);
  assert.equal(unreadOnly.items[0].id, status.id);
  console.log('notifications: mark-read — PASSOU');
}

{
  const r = store.markAllRead(userA);
  assert.equal(r.updated, 1);
  const list = store.listForUser(userA);
  assert.equal(list.unreadCount, 0);
  assert.ok(list.items.every((n) => n.readAt));
  console.log('notifications: mark-all-read — PASSOU');
}

{
  let err = '';
  try {
    store.markRead(userA, 'missing');
  } catch (e: any) {
    err = e.message;
  }
  assert.equal(err, 'NOT_FOUND');
  // userB não marca notificação de A
  let cross = '';
  try {
    store.markRead(userB, paid.id);
  } catch (e: any) {
    cross = e.message;
  }
  assert.equal(cross, 'NOT_FOUND');
  console.log('notifications: mark-read proteção — PASSOU');
}

console.log('notifications tests ok');
