import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRials, parseRials } from '../frontend/src/app/tamiran/money.ts';

test('localized input preserves the exact integer rial amount', () => {
  for (const [entry, rials] of [
    ['۷۵۰٬۰۰۰', '750000'], ['٦٥٠٠٠٠', '650000'], [' 750,000 ', '750000'],
    ['۰', '0'], ['۱', '1'], ['50,000,000', '50000000'], ['', ''],
  ]) assert.equal(parseRials(entry), rials, entry);
  for (const entry of ['-1', '0.1', '1.01', 'NaN', 'Infinity', '1e3', '1a', '9007199254740992'])
    assert.equal(parseRials(entry), null, entry);
  assert.equal(formatRials(7500000), '۷٬۵۰۰٬۰۰۰');
  assert.equal(formatRials(1), '۱');
  assert.equal(formatRials(''), '');
});
