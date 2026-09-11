import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSquareCatalogCsv } from './squareCatalog.js';

const headers = [
  'Token', 'Item Name', 'Customer-facing Name', 'Description', 'Categories', 'Price',
  'Archived', 'Square Online Item Visibility', 'Modifier Set - MILK',
  'Modifier Set - ADD INS', 'Modifier Set - SUBSTITUTES', 'Modifier Set - FOOD',
].join(',');

test('normalizes Square rows, excludes customization rows, and deduplicates products', () => {
  const csv = [
    headers,
    'one,Latte,,Rich coffee,DRINKS > ESPRESSO,8.88,N,visible,Y,N,N,N',
    'two,Latte,,Duplicate,DRINKS > ESPRESSO,8.88,N,visible,Y,N,N,N',
    'three,Oat Milk,,Option,DRINKS > CUSTOMIZE (DRINKS),1.01,N,visible,N,N,N,N',
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
    'one,Unknown,,Description,UNMAPPED,5.00,N,visible,N,N,N,N',
  ].join('\n');
  assert.throws(() => parseSquareCatalogCsv(csv), /Unsupported Square category path/);
});

test('creates tailored breakfast choices from the Square food modifier assignment', () => {
  const csv = [
    headers,
    'ECYTEP6QYR2FYD7CERBQXC2F,Breakfast Burrito,,Old copy,BREAKFAST,9.99,N,visible,N,N,N,Y',
    'ZJNM3GW4R5F2CZQNXYET7K74,Breakfast Sandwich,,Old copy,BREAKFAST,8.88,N,visible,N,N,N,Y',
    'Q7G5FZA437QTKFLJRU5BLIL6,Power Bowl,,Old copy,BREAKFAST,9.99,N,visible,N,N,N,N',
    'UTK5XEUFC3C7KJ5L4643I2UT,Taco Salad Bowl,,Old copy,LUNCH,12.12,N,visible,N,N,N,N',
  ].join('\n');
  const catalog = parseSquareCatalogCsv(csv);

  const protein = catalog.modifierSets.find(group => group.externalSourceId === 'MUZE_BREAKFAST_PROTEIN');
  const doubleProtein = catalog.modifierSets.find(
    group => group.externalSourceId === 'MUZE_BREAKFAST_DOUBLE_PROTEIN',
  );
  const addOns = catalog.modifierSets.find(group => group.externalSourceId === 'MUZE_BREAKFAST_ADD_ONS');
  assert.equal(protein.minSelections, 1);
  assert.equal(protein.maxSelections, 1);
  assert.deepEqual(protein.options, [
    { name: 'Turkey Bacon', priceCents: 0 },
    { name: 'Turkey Sausage', priceCents: 0 },
  ]);
  assert.deepEqual(doubleProtein.options, [
    { name: 'Double Protein', priceCents: 333 },
  ]);
  assert.deepEqual(addOns.options, [
    { name: 'Add Bacon', priceCents: 111 },
    { name: 'Add Sausage', priceCents: 111 },
    { name: 'Avocado', priceCents: 222 },
  ]);
  const burrito = catalog.items.find(item => item.externalSourceId === 'ECYTEP6QYR2FYD7CERBQXC2F');
  const sandwich = catalog.items.find(item => item.externalSourceId === 'ZJNM3GW4R5F2CZQNXYET7K74');
  const bowl = catalog.items.find(item => item.externalSourceId === 'Q7G5FZA437QTKFLJRU5BLIL6');
  const tacoSalad = catalog.items.find(item => item.externalSourceId === 'UTK5XEUFC3C7KJ5L4643I2UT');
  assert.equal(burrito.name, 'Breakfast Burrito');
  assert.deepEqual(burrito.modifierExternalSourceIds, [
    'MUZE_BREAKFAST_PROTEIN',
    'MUZE_BREAKFAST_DOUBLE_PROTEIN',
    'MUZE_BREAKFAST_ADD_ONS',
    'MUZE_BREAKFAST_BURRITO_BEANS',
  ]);
  assert.deepEqual(sandwich.modifierExternalSourceIds, [
    'MUZE_BREAKFAST_PROTEIN',
    'MUZE_BREAKFAST_DOUBLE_PROTEIN',
    'MUZE_BREAKFAST_ADD_ONS',
    'MUZE_BREAKFAST_SANDWICH_SUBSTITUTIONS',
  ]);
  assert.equal(bowl.name, 'Breakfast Bowl');
  assert.deepEqual(bowl.modifierExternalSourceIds, []);
  assert.equal(tacoSalad.name, 'Taco Salad');
  assert.doesNotMatch(tacoSalad.description, /rice/i);
});
