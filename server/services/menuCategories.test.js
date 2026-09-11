import assert from 'node:assert/strict';
import test from 'node:test';
import { groupMenuCategories } from '../../client/src/utils/menuCategories.js';

test('separates the Square catalog into food and drink subcategories', () => {
  const groups = groupMenuCategories([
    { id: 1, name: 'Breakfast' },
    { id: 2, name: 'Espresso' },
    { id: 3, name: 'Matcha' },
    { id: 4, name: 'Tea & Lemonade' },
    { id: 5, name: 'Smoothies' },
    { id: 6, name: 'Lunch' },
  ]);

  assert.deepEqual(
    groups.map(group => [group.label, group.categories.map(category => category.name)]),
    [
      ['Food', ['Breakfast', 'Lunch']],
      ['Drinks', ['Espresso', 'Matcha', 'Tea & Lemonade', 'Smoothies']],
    ],
  );
});

test('defaults unfamiliar Square categories to food instead of hiding them', () => {
  const groups = groupMenuCategories([{ id: 7, name: 'Pastries' }]);
  assert.equal(groups[0].id, 'food');
  assert.equal(groups[0].categories[0].name, 'Pastries');
});
