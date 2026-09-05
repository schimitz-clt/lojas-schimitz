import assert from 'assert';
import { BadRequestException } from '@nestjs/common';
import { assertCanDeactivateAdmin } from './admin-users.service';

function expectBadRequest(fn: () => void, msgPart: string) {
  try {
    fn();
    assert.fail('expected BadRequestException');
  } catch (e) {
    assert.ok(e instanceof BadRequestException, 'should be BadRequestException');
    const res = (e as BadRequestException).getResponse() as string | { message?: string | string[] };
    const msg = typeof res === 'string' ? res : Array.isArray(res.message) ? res.message.join(' ') : res.message || '';
    assert.ok(String(msg).includes(msgPart), `message should include "${msgPart}", got: ${msg}`);
  }
}

expectBadRequest(
  () => assertCanDeactivateAdmin({ actorId: 'a1', targetId: 'a1', activeAdminCount: 3 }),
  'si mesmo',
);

expectBadRequest(
  () => assertCanDeactivateAdmin({ actorId: 'a1', targetId: 'a2', activeAdminCount: 1 }),
  'último administrador',
);

// allowed: deactivating another when more than one active
assertCanDeactivateAdmin({ actorId: 'a1', targetId: 'a2', activeAdminCount: 2 });

console.log('admin-users guard tests ok');
