import * as XLSX from 'xlsx';
import * as db from '../db/database.js';

/**
 * Parse price string like "$6.00" to number
 */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const cleaned = String(priceStr).replace(/[$,]/g, '').trim();
  const price = parseFloat(cleaned);
  return isNaN(price) ? 0 : price;
}

/**
 * Import menu from Excel file (xlsx format)
 * Expected sheets:
 * - "Menu Items" with columns: Category, Item Name, Base Price, SKU, Item ID, Applicable Modifier Groups
 * - "Modifiers" with columns: Modifier Group, Modifier Name, Price, Item ID
 */
export async function importMenuFromExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Check for required sheets
  if (!workbook.SheetNames.includes('Menu Items')) {
    throw new Error('Excel file must have a "Menu Items" sheet');
  }

  const menuItemsSheet = workbook.Sheets['Menu Items'];
  const modifiersSheet = workbook.Sheets['Modifiers'];

  // Parse sheets to JSON
  const menuItems = XLSX.utils.sheet_to_json(menuItemsSheet);
  const modifiers = modifiersSheet ? XLSX.utils.sheet_to_json(modifiersSheet) : [];

  console.log(`Found ${menuItems.length} menu items and ${modifiers.length} modifiers`);

  // Track stats
  let itemCount = 0;
  let modifierCount = 0;
  const categorySet = new Set();
  const modifierGroupSet = new Set();

  // Track created categories and modifier groups
  const categoryMap = new Map(); // name -> id
  const modifierGroupMap = new Map(); // name -> id

  // First pass: Create categories from menu items
  for (const item of menuItems) {
    const categoryName = item['Category']?.trim();
    if (categoryName && !categoryMap.has(categoryName)) {
      // Check if category exists
      let category = db.getCategoryByName(categoryName);
      if (!category) {
        // Create new category
        const sortOrder = categoryMap.size + 1;
        db.default.prepare(
          'INSERT INTO categories (name, sort_order) VALUES (?, ?)'
        ).run(categoryName, sortOrder);
        category = db.getCategoryByName(categoryName);
      }
      categoryMap.set(categoryName, category.id);
      categorySet.add(categoryName);
    }
  }

  // Second pass: Create modifier groups from modifiers sheet
  for (const mod of modifiers) {
    const groupName = mod['Modifier Group']?.trim();
    if (groupName && !modifierGroupMap.has(groupName)) {
      // Check if group exists
      let group = db.getModifierGroupByName(groupName);
      if (!group) {
        // Create new modifier group
        const groupId = db.createModifierGroup({
          name: groupName,
          display_name: groupName,
          min_selections: 0,
          max_selections: 10,
          required: 0,
          sort_order: modifierGroupMap.size + 1,
        });
        group = { id: groupId, name: groupName };
      }
      modifierGroupMap.set(groupName, group.id);
      modifierGroupSet.add(groupName);
    }
  }

  console.log('Modifier groups created:', Array.from(modifierGroupMap.keys()));

  // Third pass: Create modifier options
  for (const mod of modifiers) {
    const groupName = mod['Modifier Group']?.trim();
    const modName = mod['Modifier Name']?.trim();
    const price = parsePrice(mod['Price']);
    const toastId = mod['Item ID'] ? String(mod['Item ID']) : null;

    if (!groupName || !modName) continue;

    const groupId = modifierGroupMap.get(groupName);
    if (!groupId) continue;

    // Clean up modifier name (remove $ prefix for display)
    const displayName = modName.startsWith('$') ? modName.substring(1) : modName;

    try {
      db.createModifierOption({
        toast_guid: null,
        toast_id: toastId,
        group_id: groupId,
        name: modName,
        display_name: displayName,
        price_adjustment: price,
        available: 1,
        sort_order: modifierCount,
      });
      modifierCount++;
    } catch (err) {
      // Skip duplicates
      if (!err.message.includes('UNIQUE constraint')) {
        console.error('Error creating modifier:', err.message);
      }
    }
  }

  // Fourth pass: Create menu items and link to modifier groups
  const seenItems = new Set(); // Track by name to skip duplicates

  for (const item of menuItems) {
    const itemName = item['Item Name']?.trim();
    const categoryName = item['Category']?.trim();
    const price = parsePrice(item['Base Price']);
    const sku = item['SKU'] ? String(item['SKU']).trim() : '';
    const toastId = item['Item ID'] ? String(item['Item ID']) : null;
    const modifierGroupsStr = item['Applicable Modifier Groups']?.trim() || '';

    if (!itemName) continue;

    // Skip duplicates (by name + category)
    const itemKey = `${categoryName}:${itemName.toLowerCase()}`;
    if (seenItems.has(itemKey)) {
      console.log(`Skipping duplicate: ${itemName}`);
      continue;
    }
    seenItems.add(itemKey);

    const categoryId = categoryMap.get(categoryName) || null;

    try {
      const itemId = db.createMenuItem({
        toast_guid: null,
        toast_id: toastId,
        name: itemName,
        description: null,
        price: price,
        category_id: categoryId,
        image_url: null,
        available: 1,
        sku: sku,
        sort_order: itemCount,
      });

      itemCount++;

      // Parse and link modifier groups
      if (modifierGroupsStr) {
        const groupNames = modifierGroupsStr.split(',').map(g => g.trim()).filter(Boolean);
        for (const groupName of groupNames) {
          const groupId = modifierGroupMap.get(groupName);
          if (groupId) {
            db.linkItemToModifierGroup(itemId, groupId);
            console.log(`Linked item "${itemName}" to modifier group "${groupName}"`);
          } else {
            console.log(`Warning: Modifier group "${groupName}" not found for item "${itemName}"`);
          }
        }
      }
    } catch (err) {
      if (!err.message.includes('UNIQUE constraint')) {
        console.error('Error creating item:', itemName, err.message);
      }
    }
  }

  return {
    items: itemCount,
    modifiers: modifierCount,
    categories: categorySet.size,
    modifierGroups: modifierGroupSet.size,
  };
}
