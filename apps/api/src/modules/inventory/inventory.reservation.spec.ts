/**
 * Reserva de estoque — simulação CAS (sem Postgres).
 * Cobre: oversell bloqueado, commit no pagamento, release no cancelamento,
 * available nunca negativo, qty inválida.
 */
import assert from 'assert';
import { availableQty } from './inventory.math';

type Inv = { onHand: number; reserved: number };

function available(inv: Inv) {
  return availableQty(inv.onHand, inv.reserved);
}

/** Espelha InventoryService.reserve predicado CAS. */
function reserve(inv: Inv, qty: number): boolean {
  if (qty < 1) return false;
  if (available(inv) < qty) return false;
  inv.reserved += qty;
  return true;
}

/** Espelha release (cancel / expiry) — falha se reserved insuficiente. */
function release(inv: Inv, qty: number): boolean {
  if (qty < 1) return false;
  if (inv.reserved < qty) return false;
  inv.reserved -= qty;
  return true;
}

/** Espelha commitSale (pagamento aprovado). */
function commitSale(inv: Inv, qty: number): boolean {
  if (qty < 1) return false;
  if (inv.reserved < qty || inv.onHand < qty) return false;
  inv.onHand -= qty;
  inv.reserved -= qty;
  return true;
}

/** Fluxo create → pay. */
function createOrderThenPay(inv: Inv, qty: number) {
  assert.equal(reserve(inv, qty), true, 'reserve on create');
  assert.equal(commitSale(inv, qty), true, 'commit on pay');
}

/** Fluxo create → cancel. */
function createOrderThenCancel(inv: Inv, qty: number) {
  assert.equal(reserve(inv, qty), true, 'reserve on create');
  assert.equal(release(inv, qty), true, 'release on cancel');
}

// 1) Oversell: 1 unidade, 2 reservas concorrentes → só 1 ganha
{
  const inv: Inv = { onHand: 1, reserved: 0 };
  const a = reserve(inv, 1);
  const b = reserve(inv, 1);
  assert.equal(a, true);
  assert.equal(b, false);
  assert.equal(inv.reserved, 1);
  assert.equal(available(inv), 0);
  console.log('stock: oversell bloqueado — PASSOU');
}

// 2) Pagamento confirma: onHand e reserved caem
{
  const inv: Inv = { onHand: 5, reserved: 0 };
  createOrderThenPay(inv, 2);
  assert.equal(inv.onHand, 3);
  assert.equal(inv.reserved, 0);
  assert.equal(available(inv), 3);
  console.log('stock: decrement no pagamento — PASSOU');
}

// 3) Cancelamento libera reserva sem baixar onHand
{
  const inv: Inv = { onHand: 4, reserved: 0 };
  createOrderThenCancel(inv, 3);
  assert.equal(inv.onHand, 4);
  assert.equal(inv.reserved, 0);
  assert.equal(available(inv), 4);
  console.log('stock: release no cancel — PASSOU');
}

// 4) Expiração = mesmo caminho do cancel
{
  const inv: Inv = { onHand: 2, reserved: 0 };
  assert.equal(reserve(inv, 2), true);
  assert.equal(release(inv, 2), true); // expireReservations → cancelled → release
  assert.equal(inv.onHand, 2);
  assert.equal(inv.reserved, 0);
  console.log('stock: release na expiração — PASSOU');
}

// 5) Não permite commit sem reserva prévia
{
  const inv: Inv = { onHand: 3, reserved: 0 };
  assert.equal(commitSale(inv, 1), false);
  assert.equal(inv.onHand, 3);
  console.log('stock: commit sem reserva falha — PASSOU');
}

// 6) Dois pedidos: 1 paga, 1 cancela — estoque coerente
{
  const inv: Inv = { onHand: 2, reserved: 0 };
  assert.equal(reserve(inv, 1), true); // order A
  assert.equal(reserve(inv, 1), true); // order B
  assert.equal(reserve(inv, 1), false); // oversell
  assert.equal(commitSale(inv, 1), true); // A paid
  assert.equal(release(inv, 1), true); // B cancelled
  assert.equal(inv.onHand, 1);
  assert.equal(inv.reserved, 0);
  assert.ok(available(inv) >= 0);
  console.log('stock: pay+cancel concorrentes — PASSOU');
}

// 7) qty inválida (<1) rejeitada em reserve/release/commit
{
  const inv: Inv = { onHand: 5, reserved: 0 };
  assert.equal(reserve(inv, 0), false);
  assert.equal(reserve(inv, -1), false);
  assert.equal(release(inv, 0), false);
  assert.equal(commitSale(inv, 0), false);
  assert.equal(inv.onHand, 5);
  assert.equal(inv.reserved, 0);
  console.log('stock: qty inválida rejeitada — PASSOU');
}

// 8) release sem reserva falha (não deixa reserved negativo)
{
  const inv: Inv = { onHand: 3, reserved: 1 };
  assert.equal(release(inv, 2), false);
  assert.equal(inv.reserved, 1);
  assert.equal(available(inv), 2);
  console.log('stock: release excessivo falha — PASSOU');
}

// 9) Após commit, available nunca negativo; onHand/reserved >= 0
{
  const inv: Inv = { onHand: 1, reserved: 0 };
  assert.equal(reserve(inv, 1), true);
  assert.equal(commitSale(inv, 1), true);
  assert.equal(inv.onHand, 0);
  assert.equal(inv.reserved, 0);
  assert.equal(available(inv), 0);
  assert.equal(commitSale(inv, 1), false);
  assert.equal(release(inv, 1), false);
  console.log('stock: pós-venda zerado sem negativo — PASSOU');
}

// 10) Interleaving: N reservas paralelas simuladas sobre 3 unidades
{
  const inv: Inv = { onHand: 3, reserved: 0 };
  const wins = [1, 1, 1, 1, 1].map((q) => reserve(inv, q));
  assert.equal(wins.filter(Boolean).length, 3);
  assert.equal(inv.reserved, 3);
  assert.equal(available(inv), 0);
  console.log('stock: 5 tentativas / 3 unidades — PASSOU');
}

console.log('inventory.reservation tests ok');
