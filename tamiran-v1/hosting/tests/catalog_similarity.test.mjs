import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {catalogMatch} from '../frontend/src/app/tamiran/catalog-similarity.ts';
const vectors=JSON.parse(readFileSync(new URL('./fixtures/catalog-similarity.json',import.meta.url)));
for(const [i,v] of vectors.entries())test(`catalog similarity ${i+1}: ${v.a.model} / ${v.b.model}`,()=>{assert.equal(catalogMatch(v.a,v.b),v.expected);assert.equal(catalogMatch(v.b,v.a),v.expected);});
