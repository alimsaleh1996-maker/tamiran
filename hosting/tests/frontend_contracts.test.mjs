import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildCaseMutationRequest } from '../frontend/src/app/software/case-mutations.ts';
import { matchesQueueSearch, normalizeQueueSearch, queueTimestamp } from '../frontend/src/app/tamiran/queue-search.ts';

test('standalone npm installation never relies on a previous Worker installation', () => {
  const lock = JSON.parse(readFileSync(new URL('../frontend/package-lock.json', import.meta.url)));
  for (const [name, entry] of Object.entries(lock.packages)) {
    assert.ok(!name.startsWith('..'), name);
    assert.ok(!entry.link, name);
    if (entry.resolved) {
      assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/'), name);
      assert.match(entry.integrity, /^sha512-/, name);
    }
  }
});

test('mutation refactoring preserves exact rials, zero versions, null assignment and input immutability', () => {
  for (const assignedToUserId of [undefined, null, 1, Number.MAX_SAFE_INTEGER]) {
    const input = Object.freeze({ id: 1, expectedVersion: 0, assignedToUserId, deliveryAmount: Number.MAX_SAFE_INTEGER, reason: 'دلیل', operationReport: 'گزارش' });
    const result = buildCaseMutationRequest(input);
    assert.deepEqual(result, input);
    assert.notEqual(result, input);
  }
});

test('all unsafe mutation numbers remain rejected with the existing field error', () => {
  const fields = { id: 'شناسه پرونده', expectedVersion: 'نسخه پرونده', deliveryAmount: 'مبلغ تحویل', assignedToUserId: 'مسئول پرونده' };
  for (const [field, label] of Object.entries(fields)) {
    const invalid = [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '1', false];
    if (field === 'id' || field === 'assignedToUserId') invalid.push(0);
    if (field === 'id' || field === 'expectedVersion') invalid.push(null, undefined);
    for (const value of invalid) {
      assert.throws(() => buildCaseMutationRequest({ id: 1, expectedVersion: 0, [field]: value }), { message: `${label} معتبر نیست.` });
    }
  }
});

test('queue matching handles Persian/Arabic digits and names without changing stored values', () => {
  assert.equal(normalizeQueueSearch('  كيان ۱۲٣  '), 'کیان 123');
  assert.ok(matchesQueueSearch('۰۹۱۲۳۴۵۶۷۸۹', ['09123456789']));
  assert.ok(matchesQueueSearch('كيان', ['کیان']));
  assert.ok(matchesQueueSearch('test-۰۰۱', ['TEST-001']));
  assert.ok(matchesQueueSearch('', ['anything']));
  assert.ok(!matchesQueueSearch('missing', ['کیان', 'TEST-001']));
});

test('SQL UTC timestamps and zoned ISO timestamps identify the same instant in any browser zone', () => {
  assert.equal(queueTimestamp('2026-11-10 12:00:00').toISOString(), '2026-11-10T12:00:00.000Z');
  assert.equal(queueTimestamp('2026-11-10T15:30:00+03:30').toISOString(), '2026-11-10T12:00:00.000Z');
});
