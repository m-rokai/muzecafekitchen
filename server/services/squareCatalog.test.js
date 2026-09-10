import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSquareCatalogCsv } from './squareCatalog.js';

const headers = [
  'Token', 'Item Name', 'Customer-facing Name', 'Description', 'Categories', 'Price',
  'Archived', 'Square Online Item Visibility', 'Modifier Set - MILK',
  'Modifier Set - ADD INS', 'Modifier Set - SUBSTITUTES',
].join(',');

test('normalizes Square rows, excludes customization rows, and deduplicates products', () => {
  const csv = [
    headers,
    'one,Latte,,Rich coffee,DRINKS > ESPRESSO,8.88,N,visible,Y,N,N',
    'two,Latte,,Duplicate,DRINKS > ESPRESSO,8.88,N,visible,Y,N,N',
    'three,Oat Milk,,Option,DRINKS > CUSTOMIZE (DRINKS),1.01,N,visible,N,N,N',
  ].join('\n');
  const catalog = parseSquareCatalogCsv(csv);

  assert.equal(catalog.sourceRows, 3);
  assert.equal(catalog.items.length, 1);
  assert.equal(catalog.items[0].priceCents, 888);
  assert.deepEqual(catalog.items[0].modifierExternalSourceIds, ['AUI5S5JTUMICINBLARPRS7FP']);
  assert.equal(catalog.excluded.length, 2);
  assert.match(catalog.warnings[0], /Duplicate Square item/);
});

test('rejects unsupported category paths instead of silently publishing them', () => {
  const csv = [
    headers,
    'one,Unknown,,Description,UNMAPPED,5.00,N,visible,N,N,N',
  ].join('\n');
  assert.throws(() => parseSquareCatalogCsv(csv), /Unsupported Square category path/);
});
