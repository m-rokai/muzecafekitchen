import { parse } from 'csv-parse/sync';

export const SQUARE_SOURCE_PROVIDER = 'square';

export const SQUARE_MODIFIER_SETS = Object.freeze([
  {
    csvColumn: 'Modifier Set - MILK',
    externalSourceId: 'AUI5S5JTUMICINBLARPRS7FP',
    name: 'MILK',
    displayName: 'Milk',
    minSelections: 0,
    maxSelections: 1,
    options: [
      { name: 'Oat Milk', priceCents: 100 },
    ],
  },
  {
    csvColumn: 'Modifier Set - ADD INS',
    externalSourceId: 'QB3MYTIGULMYELMQZFMP77XX',
    name: 'ADD INS',
    displayName: 'Add ins',
    minSelections: 0,
    maxSelections: 3,
    options: [
      { name: 'Collagen Peptides', priceCents: 200 },
      { name: 'Olive Oil Shot', priceCents: 200 },
      { name: 'Vanilla Protein', priceCents: 200 },
    ],
  },
  {
    csvColumn: 'Modifier Set - SUBSTITUTES',
    externalSourceId: 'N4VIOXHOOLRJAWJIUB6UEDS4',
    name: 'SUBSTITUTES',
    displayName: 'Substitutes',
    minSelections: 0,
    maxSelections: 1,
    options: [
      { name: 'Mushroom Coffee', priceCents: 200 },
      { name: 'Mushroom Matcha', priceCents: 200 },
      { name: 'Mushroom Chai', priceCents: 200 },
    ],
  },
]);

const CATEGORY_ORDER = Object.freeze([
  'Breakfast',
  'Espresso',
  'Matcha',
  'Tea & Lemonade',
  'Smoothies',
  'Lunch',
]);

const REQUIRED_COLUMNS = Object.freeze([
  'Token',
  'Item Name',
  'Description',
  'Categories',
  'Price',
  'Archived',
  'Square Online Item Visibility',
  ...SQUARE_MODIFIER_SETS.map(group => group.csvColumn),
]);

function text(value) {
  return String(value ?? '').trim();
}

function categoryForSquarePath(value) {
  const path = text(value).toUpperCase();
  if (path.includes('CUSTOMIZE')) return null;
  if (path.includes('ESPRESSO')) return 'Espresso';
  if (path.includes('MATCHA')) return 'Matcha';
  if (path.includes('TEA')) return 'Tea & Lemonade';
  if (path.includes('SMOOTH')) return 'Smoothies';
  if (path.includes('BREAKFAST')) return 'Breakfast';
  if (path.includes('LUNCH') || path.includes('SANDWICH')) return 'Lunch';
  throw new Error(`Unsupported Square category path: ${value || '(blank)'}`);
}

function priceToCents(value, rowNumber) {
  const normalized = text(value).replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Row ${rowNumber} has an invalid price: ${value || '(blank)'}`);
  }
  return Math.round(Number(normalized) * 100);
}

function itemKey(item) {
  return `${item.category.toLocaleLowerCase('en-US')}\u0000${item.name.toLocaleLowerCase('en-US')}`;
}

export function parseSquareCatalogCsv(csvText) {
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: false,
    trim: false,
  });
  const headers = records.length ? Object.keys(records[0]) : [];
  const missingColumns = REQUIRED_COLUMNS.filter(column => !headers.includes(column));
  if (missingColumns.length) {
    throw new Error(`Square catalog export is missing columns: ${missingColumns.join(', ')}`);
  }

  const warnings = [];
  const excluded = [];
  const seenTokens = new Set();
  const seenItems = new Map();
  const items = [];

  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2;
    const externalSourceId = text(record.Token);
    const name = text(record['Customer-facing Name']) || text(record['Item Name']);
    if (!externalSourceId || !name) {
      throw new Error(`Row ${rowNumber} is missing a Square token or item name`);
    }
    if (seenTokens.has(externalSourceId)) {
      throw new Error(`Row ${rowNumber} repeats Square token ${externalSourceId}`);
    }
    seenTokens.add(externalSourceId);

    const category = categoryForSquarePath(record.Categories);
    const archived = text(record.Archived).toUpperCase() === 'Y';
    if (!category) {
      excluded.push({ externalSourceId, name, reason: archived ? 'archived customization' : 'customization' });
      continue;
    }

    const item = {
      externalSourceId,
      name,
      description: text(record.Description),
      priceCents: priceToCents(record.Price, rowNumber),
      category,
      sourceCategory: text(record.Categories),
      available: !archived && text(record['Square Online Item Visibility']).toLowerCase() !== 'hidden',
      modifierExternalSourceIds: SQUARE_MODIFIER_SETS
        .filter(group => text(record[group.csvColumn]).toUpperCase() === 'Y')
        .map(group => group.externalSourceId),
    };

    const duplicateKey = itemKey(item);
    const duplicate = seenItems.get(duplicateKey);
    if (duplicate) {
      warnings.push(
        `Duplicate Square item "${name}" (${externalSourceId}) was ignored; using ${duplicate.externalSourceId}.`,
      );
      excluded.push({ externalSourceId, name, reason: 'duplicate' });
      continue;
    }
    seenItems.set(duplicateKey, item);
    items.push(item);
  }

  const categories = CATEGORY_ORDER
    .filter(name => items.some(item => item.category === name))
    .map((name, sortOrder) => ({ name, sortOrder }));
  const categorySort = new Map(categories.map(category => [category.name, category.sortOrder]));
  items.sort((left, right) => (
    categorySort.get(left.category) - categorySort.get(right.category)
    || left.name.localeCompare(right.name, 'en-US')
  ));
  items.forEach((item, sortOrder) => { item.sortOrder = sortOrder; });

  return {
    sourceRows: records.length,
    categories,
    items,
    modifierSets: SQUARE_MODIFIER_SETS,
    excluded,
    warnings,
  };
}
