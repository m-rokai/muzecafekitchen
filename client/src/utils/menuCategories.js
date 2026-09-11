export const MENU_GROUPS = [
  {
    id: 'food',
    label: 'Food',
    description: 'Breakfast and lunch',
  },
  {
    id: 'drinks',
    label: 'Drinks',
    description: 'Espresso, matcha, tea, lemonade, and smoothies',
  },
];

const DRINK_CATEGORY_PATTERN = /coffee|espresso|latte|matcha|tea|lemonade|smoothie|juice|drink|beverage|cold brew/i;

export function getMenuGroupId(category) {
  return DRINK_CATEGORY_PATTERN.test(category?.name || '') ? 'drinks' : 'food';
}

export function groupMenuCategories(categories = []) {
  return MENU_GROUPS.map(group => ({
    ...group,
    categories: categories.filter(category => getMenuGroupId(category) === group.id),
  })).filter(group => group.categories.length > 0);
}
