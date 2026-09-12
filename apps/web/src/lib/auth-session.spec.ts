import assert from 'assert';
import { refreshBodyFromStorage, shouldPersistRefreshInLocalStorage } from './auth-session';

assert.equal(shouldPersistRefreshInLocalStorage('localhost'), true);
assert.equal(shouldPersistRefreshInLocalStorage('127.0.0.1'), true);
assert.equal(shouldPersistRefreshInLocalStorage('LOCALHOST'), true);
assert.equal(shouldPersistRefreshInLocalStorage('lojasschimitz.com.br'), false);
assert.equal(shouldPersistRefreshInLocalStorage('www.lojasschimitz.com.br'), false);
assert.equal(shouldPersistRefreshInLocalStorage(''), false);

assert.deepEqual(refreshBodyFromStorage('rt-abc'), { refreshToken: 'rt-abc' });
assert.deepEqual(refreshBodyFromStorage('  rt-abc  '), { refreshToken: 'rt-abc' });
assert.deepEqual(refreshBodyFromStorage(null), {});
assert.deepEqual(refreshBodyFromStorage(undefined), {});
assert.deepEqual(refreshBodyFromStorage(''), {});
assert.deepEqual(refreshBodyFromStorage('   '), {});

console.log('auth-session unit tests ok');
