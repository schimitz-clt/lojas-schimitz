import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SEARCH_HISTORY_MAX,
  SEARCH_HISTORY_STORAGE_KEY,
  clearSearchHistory,
  normalizeHistoryTerm,
  parseSearchHistory,
  rememberSearchTerm,
  searchHistoryClearLabel,
  searchHistoryHeading,
  shouldShowSearchHistory,
} from './search-history';

assert.equal(SEARCH_HISTORY_MAX, 8);
assert.equal(SEARCH_HISTORY_STORAGE_KEY, 'sch_search_q_v1');
assert.equal(searchHistoryHeading(), 'Você buscou');
assert.equal(searchHistoryClearLabel(), 'Limpar');

assert.equal(normalizeHistoryTerm('  TV   50  '), 'TV 50');
assert.equal(normalizeHistoryTerm('t'), '');
assert.equal(normalizeHistoryTerm('  '), '');
assert.equal(normalizeHistoryTerm('tv'), 'tv');

assert.deepEqual(parseSearchHistory(['tv', '  TV  ', 'x', '', 'geladeira', 1, null]), [
  'tv',
  'geladeira',
]);
assert.deepEqual(parseSearchHistory(null), []);
assert.deepEqual(parseSearchHistory('nope'), []);

const remembered = rememberSearchTerm(['geladeira', 'iphone'], '  TV 50 ');
assert.deepEqual(remembered, ['TV 50', 'geladeira', 'iphone']);
assert.deepEqual(rememberSearchTerm(remembered, 'tv 50'), ['tv 50', 'geladeira', 'iphone']);
assert.deepEqual(rememberSearchTerm(['tv'], 't'), ['tv']);
assert.deepEqual(rememberSearchTerm([], '  Têvê  '), ['Têvê']);

const many = Array.from({ length: 12 }, (_, i) => `termo ${i + 1}`);
let list: string[] = [];
for (const t of many) list = rememberSearchTerm(list, t);
assert.equal(list.length, SEARCH_HISTORY_MAX);
assert.equal(list[0], 'termo 12');
assert.ok(!list.includes('termo 1'));

assert.equal(shouldShowSearchHistory('', 3), true);
assert.equal(shouldShowSearchHistory('   ', 3), true);
assert.equal(shouldShowSearchHistory('tv', 3), false);
assert.equal(shouldShowSearchHistory('', 0), false);

assert.equal(clearSearchHistory().length, 0);

const box = readFileSync(join(__dirname, '../components/SearchBox.tsx'), 'utf8');
assert.ok(box.includes('searchHistoryHeading'), 'dropdown uses Você buscou helper');
assert.ok(box.includes('readSearchHistory'), 'history is localStorage-backed');
assert.ok(box.includes('persistSearchTerm'), 'submit remembers the term');
assert.ok(box.includes('clearSearchHistory'), 'history is clearable');
assert.ok(!/fake product|mock product|lorem/i.test(box), 'no invented catalog rows');

console.log('search-history unit tests ok');
