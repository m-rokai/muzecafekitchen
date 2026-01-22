import { parse } from 'csv-parse/sync';
import * as db from '../db/database.js';

// Auto-categorization rules based on item names
const categoryRules = [
  {
    name: 'Coffee & Espresso',
    patterns: ['latte', 'mocha', 'chai', 'cappuccino', 'espresso', 'blend', 'macchiato', 'americano', 'cold foam'],
  },
  {
    name: 'Frozen Drinks',
    patterns: ['frozen'],
  },
  {
    name: 'Smoothies',
    patterns: ['flow', 'hawaiian', 'jamaican', 'burn', 'sun burn', 'lava'],
  },
  {
    name: 'Tea & Lemonade',
    patterns: ['tea', 'lemonade'],
  },
  {
    name: 'Breakfast',
    patterns: ['breakfast', 'bagel', 'croissant', 'crossaint', 'french toast', 'casserole', 'sliders'],
  },
  {
    name: 'Sandwiches & Paninis',
    patterns: ['panini', 'club', 'wrap', 'pita', 'sandwich', 'dip', 'quesadilla', 'burrito', 'grill'],
  },
  {
    name: 'Salads',
    patterns: ['salad', 'caesar'],
  },
  {
    name: 'Desserts',
    patterns: ['parfait', 'shortcake', 'pudding', 'brownie', 'cookie', 'fried ice cream', 'wafer', 'nilla'],
  },
  {
    name: 'Snacks',
    patterns: ['chips', 'trail mix', 'doritos', 'cheetos', 'fritos', 'ruffles', 'lays', 'funyuns', 'peanuts', 'pistachio', 'bites'],
  },
  {
    name: 'Candy',
    patterns: ['skittles', 'm&m', 'snickers', 'starburst', 'musketeers', 'butterfingers', 'crunch', 'grand', 'bueno', 'nutella', 'hi chew', 'fruit snacks', 'honey bun', 'rice krisp', 'oreo'],
  },
  {
    name: 'Drinks',
    patterns: ['coke', 'sprite', 'fanta', 'water', 'pepsi', 'arizona', 'jarrito', 'celsius', 'waterloo', 'soda', 'dr. pepper', 'liquid death'],
  },
];

// Modifier group detection
const modifierGroups = {
  add_ons: {
    displayName: 'Add-ons',
    patterns: [/^\$/],  // Starts with $
  },
  removals: {
    displayName: 'Remove',
    patterns: [/^no\s/i],  // Starts with "No "
  },
  proteins: {
    displayName: 'Proteins',
    keywords: ['chicken', 'bacon', 'ham', 'sausage', 'egg', 'tuna'],
  },
  cheese: {
    displayName: 'Cheese Options',
    keywords: ['cheese', 'cheddar', 'swiss', 'feta', 'mozarella', 'mozzarella', 'parm', 'cotija', 'jack'],
  },
  dressings: {
    displayName: 'Dressings',
    keywords: ['dressing', 'ranch', 'caesar', 'italian', 'thai sauce', 'poppy seed', 'cilantro lime', 'mayo', 'mustard', 'pesto'],
  },
  extras: {
    displayName: 'Extras',
    keywords: ['avocado', 'jalapeno', 'peppers', 'tomato', 'onion', 'mushroom', 'cucumber', 'pickle', 'olive', 'corn', 'bean', 'walnut', 'crouton', 'tortilla', 'berries', 'fruit'],
  },
};

function detectCategory(name) {
  const lowerName = name.toLowerCase();

  for (const rule of categoryRules) {
    for (const pattern of rule.patterns) {
      if (lowerName.includes(pattern.toLowerCase())) {
        return rule.name;
      }
    }
  }

  return 'Other';
}

function detectModifierGroup(name, price) {
  const lowerName = name.toLowerCase();

  // Check pattern-based groups first
  if (/^\$/.test(name)) {
    return 'add_ons';
  }
  if (/^no\s/i.test(name)) {
    return 'removals';
  }

  // Check keyword-based groups
  for (const [groupName, group] of Object.entries(modifierGroups)) {
    if (group.keywords) {
      for (const keyword of group.keywords) {
        if (lowerName.includes(keyword.toLowerCase())) {
          return groupName;
        }
      }
    }
  }

  // Default based on price
  return price > 0 ? 'add_ons' : 'extras';
}

function cleanModifierName(name) {
  // Remove leading $ or "No " for display
  return name
    .replace(/^\$\s*/, '')
    .replace(/^no\s+/i, 'No ')
    .trim();
}

export function parseToastCSV(csvContent) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const menuItems = [];
  const modifiers = [];

  for (const record of records) {
    // Skip archived items
    if (record.Archived === 'Yes') continue;

    const isModifier = record.Modifier === 'Yes';
    const name = record.Name || '';
    const price = parseFloat(record['Base Price']) || 0;
    const guid = record.GUID || '';
    const toastId = record['Item ID'] || '';
    const sku = record.SKU || '';

    if (isModifier) {
      modifiers.push({
        toast_guid: guid,
        toast_id: toastId,
        name: name,
        display_name: cleanModifierName(name),
        price_adjustment: price,
        group: detectModifierGroup(name, price),
        available: 1,
        sort_order: 0,
      });
    } else {
      // Skip items with $0 price that look like sides/options
      if (price === 0 && (
        name.toLowerCase().includes('fresh fruit') ||
        name.toLowerCase().includes('chips') ||
        name.toLowerCase().includes('pasta salad')
      )) {
        continue;
      }

      menuItems.push({
        toast_guid: guid,
        toast_id: toastId,
        name: name,
        description: null,
        price: price,
        category: detectCategory(name),
        image_url: null,
        available: 1,
        sku: sku,
        sort_order: 0,
      });
    }
  }

  return { menuItems, modifiers };
}

export async function importMenu(csvContent) {
  const { menuItems, modifiers } = parseToastCSV(csvContent);

  // Get categories map
  const categories = db.getAllCategories();
  const categoryMap = {};
  for (const cat of categories) {
    categoryMap[cat.name] = cat.id;
  }

  // Get modifier groups map
  const modifierGroupsList = db.getAllModifierGroups();
  const modifierGroupMap = {};
  for (const group of modifierGroupsList) {
    modifierGroupMap[group.name] = group.id;
  }

  // Clear existing data
  db.clearItemModifierLinks();
  db.deleteAllModifierOptions();
  db.deleteAllMenuItems();

  // Insert menu items
  const itemCount = { items: 0, modifiers: 0, categories: new Set() };

  for (const item of menuItems) {
    const categoryId = categoryMap[item.category] || categoryMap['Other'];
    itemCount.categories.add(item.category);

    db.createMenuItem({
      ...item,
      category_id: categoryId,
    });
    itemCount.items++;
  }

  // Insert modifiers
  for (const mod of modifiers) {
    const groupId = modifierGroupMap[mod.group] || modifierGroupMap['extras'];

    db.createModifierOption({
      toast_guid: mod.toast_guid,
      toast_id: mod.toast_id,
      group_id: groupId,
      name: mod.name,
      display_name: mod.display_name,
      price_adjustment: mod.price_adjustment,
      available: mod.available,
      sort_order: mod.sort_order,
    });
    itemCount.modifiers++;
  }

  // Auto-link modifier groups to menu items based on category
  const allItems = db.getAllMenuItems();
  const sandwichCategories = ['Sandwiches & Paninis', 'Breakfast'];
  const drinkCategories = ['Coffee & Espresso', 'Frozen Drinks', 'Smoothies', 'Tea & Lemonade'];
  const saladCategory = 'Salads';

  for (const item of allItems) {
    const categoryName = item.category_name;

    if (sandwichCategories.includes(categoryName)) {
      // Link sandwich modifiers
      db.linkItemToModifierGroup(item.id, modifierGroupMap['add_ons']);
      db.linkItemToModifierGroup(item.id, modifierGroupMap['removals']);
      db.linkItemToModifierGroup(item.id, modifierGroupMap['proteins']);
      db.linkItemToModifierGroup(item.id, modifierGroupMap['cheese']);
    } else if (categoryName === saladCategory) {
      // Link salad modifiers
      db.linkItemToModifierGroup(item.id, modifierGroupMap['add_ons']);
      db.linkItemToModifierGroup(item.id, modifierGroupMap['removals']);
      db.linkItemToModifierGroup(item.id, modifierGroupMap['dressings']);
      db.linkItemToModifierGroup(item.id, modifierGroupMap['proteins']);
    } else if (drinkCategories.includes(categoryName)) {
      // Link drink modifiers (extras like whey protein, flavors)
      db.linkItemToModifierGroup(item.id, modifierGroupMap['extras']);
    }
  }

  return {
    items: itemCount.items,
    modifiers: itemCount.modifiers,
    categories: itemCount.categories.size,
  };
}
