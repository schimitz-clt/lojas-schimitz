import assert from 'assert';
import {
  hasRefusedAttemptOnly,
  isCartFixableOrderError,
  pendingOrderToResume,
  reservationNotice,
} from './journey-copy';

// erro que se resolve na sacola
assert.equal(isCartFixableOrderError('INSUFFICIENT_STOCK', 'x'), true);
assert.equal(isCartFixableOrderError(undefined, 'Estoque insuficiente para "Drone"'), true);
assert.equal(isCartFixableOrderError(undefined, 'Produto "X" indisponível'), true);
assert.equal(isCartFixableOrderError('ADDRESS_NOT_FOUND', 'Endereço não encontrado'), false);
assert.equal(isCartFixableOrderError(undefined, 'Falha de rede'), false);

// pedido pendente a retomar: o mais recente aguardando pagamento
assert.equal(pendingOrderToResume([]), null);
assert.equal(pendingOrderToResume(null), null);
assert.equal(pendingOrderToResume([{ publicId: 'A', status: 'paid' }]), null);
assert.equal(
  pendingOrderToResume([
    { publicId: 'OLD', status: 'awaiting_payment', createdAt: '2026-10-01T10:00:00Z' },
    { publicId: 'NEW', status: 'awaiting_payment', createdAt: '2026-10-02T10:00:00Z' },
    { publicId: 'PAID', status: 'paid', createdAt: '2026-10-03T10:00:00Z' },
  ])?.publicId,
  'NEW',
);

// prazo da reserva: 12:00 UTC = 09:00 em Brasília
const now = new Date('2026-10-12T11:30:00Z');
const live = reservationNotice('2026-10-12T12:00:00Z', now)!;
assert.equal(live.expired, false);
assert.match(live.text, /até 09:00/);
assert.match(live.text, /Brasília/);
const gone = reservationNotice('2026-10-12T11:00:00Z', now)!;
assert.equal(gone.expired, true);
assert.match(gone.text, /terminou/);
assert.equal(reservationNotice(null, now), null);
assert.equal(reservationNotice('lixo', now), null);

// pagamento recusado: só destrava nova tentativa se não houver pendente/aprovado
assert.equal(hasRefusedAttemptOnly([{ status: 'refused' }]), true);
assert.equal(hasRefusedAttemptOnly([{ status: 'refused' }, { status: 'pending' }]), false);
assert.equal(hasRefusedAttemptOnly([{ status: 'refused' }, { status: 'approved' }]), false);
assert.equal(hasRefusedAttemptOnly([{ status: 'cancelled' }]), false);
assert.equal(hasRefusedAttemptOnly([]), false);
assert.equal(hasRefusedAttemptOnly(undefined), false);

console.log('journey-copy tests ok');
