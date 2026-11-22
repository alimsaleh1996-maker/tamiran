import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatToman, tomanToRials } from '../frontend/src/app/tamiran/money.ts';

test('localized toman entry preserves exact integer rials at the API boundary', () => {
  for (const [entry, rials] of [
    ['۷۵۰٬۰۰۰', '7500000'], ['٦٥٠٠٠٠', '6500000'], [' 750,000 ', '7500000'],
    ['۰', '0'], ['۰٫۱', '1'], ['12.3', '123'], ['12.', '120'], ['', ''],
  ]) assert.equal(tomanToRials(entry), rials, entry);
  for (const entry of ['-1', '1.01', 'NaN', 'Infinity', '1e3', '1a', '9007199254740992'])
    assert.equal(tomanToRials(entry), null, entry);
  assert.equal(formatToman(7500000), '۷۵۰٬۰۰۰');
  assert.equal(formatToman(1), '۰٫۱');
  assert.equal(formatToman(''), '');
});
