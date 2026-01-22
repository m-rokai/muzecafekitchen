import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { categories, menuItems, modifierGroups, modifierOptions } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use DATABASE_PATH env var for production (Fly.io persistent volume)
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'muze_orders.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Initialize database
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema if database is new
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Migration: Add email column to orders table if it doesn't exist
try {
  const columns = db.prepare("PRAGMA table_info(orders)").all();
  const hasEmail = columns.some(col => col.name === 'email');
  if (!hasEmail) {
    db.exec('ALTER TABLE orders ADD COLUMN email TEXT');
    console.log('Migration: Added email column to orders table');
  }
} catch (err) {
  console.error('Migration error:', err);
}

// Seed database with initial menu data if empty
export function seedDatabase() {
  const itemCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get().count;

  if (itemCount === 0) {
    console.log('Seeding database with Muze Café menu...');

    // Insert categories
    const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name, description, sort_order) VALUES (?, ?, ?)');
    for (const cat of categories) {
      insertCategory.run(cat.name, cat.description || '', cat.sort_order);
    }

    // Get category IDs
    const categoryMap = new Map();
    for (const cat of getAllCategories()) {
      categoryMap.set(cat.name, cat.id);
    }

    // Insert menu items
    const insertItem = db.prepare(`
      INSERT INTO menu_items (name, description, price, category_id, available, sort_order)
      VALUES (?, ?, ?, ?, 1, ?)
    `);

    let sortOrder = 0;
    for (const item of menuItems) {
      // Find category by id from seed data
      const category = categories.find(c => c.id === item.category_id);
      const categoryId = category ? categoryMap.get(category.name) : null;
      insertItem.run(item.name, item.description || '', item.price, categoryId, sortOrder++);
    }

    // Insert modifier groups
    const insertGroup = db.prepare(`
      INSERT INTO modifier_groups (name, display_name, min_selections, max_selections, required, sort_order)
      VALUES (?, ?, 0, 10, 0, ?)
    `);

    const groupMap = new Map();
    for (const group of modifierGroups) {
      const result = insertGroup.run(group.name, group.display_name, group.sort_order);
      groupMap.set(group.id, result.lastInsertRowid);
    }

    // Insert modifier options
    const insertOption = db.prepare(`
      INSERT INTO modifier_options (group_id, name, display_name, price_adjustment, available, sort_order)
      VALUES (?, ?, ?, ?, 1, ?)
    `);

    let optionOrder = 0;
    for (const option of modifierOptions) {
      const groupId = groupMap.get(option.group_id);
      if (groupId) {
        insertOption.run(groupId, option.name, option.name, option.price, optionOrder++);
      }
    }

    // Link items to modifier groups based on category
    const allItems = getAllMenuItemsIncludingUnavailable();
    for (const item of allItems) {
      for (const group of modifierGroups) {
        const dbGroupId = groupMap.get(group.id);
        if (!dbGroupId) continue;

        // Link by category
        if (group.category_ids) {
          const itemCategory = categories.find(c => c.name === item.category_name);
          if (itemCategory && group.category_ids.includes(itemCategory.id)) {
            linkItemToModifierGroup(item.id, dbGroupId);
          }
        }

        // Link by specific item name
        if (group.item_names && group.item_names.includes(item.name)) {
          linkItemToModifierGroup(item.id, dbGroupId);
        }
      }
    }

    console.log('Database seeded successfully!');
  }
}

// Helper to get next pickup number (resets daily)
export function getNextPickupNumber() {
  const today = new Date().toISOString().split('T')[0];
  const counter = db.prepare('SELECT * FROM pickup_counter WHERE id = 1').get();

  if (counter.last_reset_date !== today) {
    db.prepare('UPDATE pickup_counter SET current_number = 1, last_reset_date = ? WHERE id = 1').run(today);
    return 1;
  } else {
    const newNumber = counter.current_number + 1;
    db.prepare('UPDATE pickup_counter SET current_number = ? WHERE id = 1').run(newNumber);
    return newNumber;
  }
}

// ============ Category CRUD ============
export function getAllCategories() {
  return db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
}

export function getCategory(id) {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

export function getCategoryByName(name) {
  return db.prepare('SELECT * FROM categories WHERE name = ?').get(name);
}

export function createCategory(category) {
  const stmt = db.prepare('INSERT INTO categories (name, description, sort_order) VALUES (?, ?, ?)');
  const result = stmt.run(category.name, category.description || '', category.sort_order || 0);
  return result.lastInsertRowid;
}

export function updateCategory(id, updates) {
  const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE categories SET ${fields} WHERE id = @id`);
  return stmt.run({ ...updates, id });
}

export function deleteCategory(id) {
  // Move items to uncategorized (null) before deleting
  db.prepare('UPDATE menu_items SET category_id = NULL WHERE category_id = ?').run(id);
  return db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

// ============ Menu Item CRUD ============
export function getAllMenuItems() {
  return db.prepare(`
    SELECT mi.*, c.name as category_name
    FROM menu_items mi
    LEFT JOIN categories c ON mi.category_id = c.id
    WHERE mi.available = 1
    ORDER BY c.sort_order, mi.sort_order, mi.name
  `).all();
}

export function getAllMenuItemsIncludingUnavailable() {
  return db.prepare(`
    SELECT mi.*, c.name as category_name
    FROM menu_items mi
    LEFT JOIN categories c ON mi.category_id = c.id
    ORDER BY c.sort_order, mi.sort_order, mi.name
  `).all();
}

export function getMenuItemsByCategory(categoryId) {
  return db.prepare(`
    SELECT * FROM menu_items
    WHERE category_id = ? AND available = 1
    ORDER BY sort_order, name
  `).all(categoryId);
}

export function getMenuItem(id) {
  return db.prepare(`
    SELECT mi.*, c.name as category_name
    FROM menu_items mi
    LEFT JOIN categories c ON mi.category_id = c.id
    WHERE mi.id = ?
  `).get(id);
}

export function createMenuItem(item) {
  const stmt = db.prepare(`
    INSERT INTO menu_items (name, description, price, category_id, image_url, available, sort_order)
    VALUES (@name, @description, @price, @category_id, @image_url, @available, @sort_order)
  `);
  const result = stmt.run({
    name: item.name,
    description: item.description || '',
    price: item.price,
    category_id: item.category_id || null,
    image_url: item.image_url || null,
    available: item.available !== undefined ? item.available : 1,
    sort_order: item.sort_order || 0,
  });
  return result.lastInsertRowid;
}

export function updateMenuItem(id, updates) {
  const allowedFields = ['name', 'description', 'price', 'category_id', 'image_url', 'available', 'sort_order'];
  const filteredUpdates = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      filteredUpdates[key] = updates[key];
    }
  }

  if (Object.keys(filteredUpdates).length === 0) return null;

  const fields = Object.keys(filteredUpdates).map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE menu_items SET ${fields} WHERE id = @id`);
  return stmt.run({ ...filteredUpdates, id });
}

export function deleteMenuItem(id) {
  // Unlink from modifier groups first
  db.prepare('DELETE FROM item_modifier_groups WHERE item_id = ?').run(id);
  // Unlink from order_items
  db.prepare('UPDATE order_items SET menu_item_id = NULL WHERE menu_item_id = ?').run(id);
  return db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
}

export function deleteAllMenuItems() {
  db.prepare('UPDATE order_items SET menu_item_id = NULL').run();
  db.prepare('DELETE FROM item_modifier_groups').run();
  return db.prepare('DELETE FROM menu_items').run();
}

// ============ Modifier Group CRUD ============
export function getAllModifierGroups() {
  return db.prepare('SELECT * FROM modifier_groups ORDER BY sort_order').all();
}

export function getModifierGroup(id) {
  return db.prepare('SELECT * FROM modifier_groups WHERE id = ?').get(id);
}

export function getModifierGroupByName(name) {
  return db.prepare('SELECT * FROM modifier_groups WHERE name = ?').get(name);
}

export function getModifierGroupWithOptions(id) {
  const group = getModifierGroup(id);
  if (group) {
    group.options = getModifierOptions(id);
  }
  return group;
}

export function createModifierGroup(group) {
  const stmt = db.prepare(`
    INSERT INTO modifier_groups (name, display_name, min_selections, max_selections, required, sort_order)
    VALUES (@name, @display_name, @min_selections, @max_selections, @required, @sort_order)
  `);
  const result = stmt.run({
    name: group.name,
    display_name: group.display_name || group.name,
    min_selections: group.min_selections || 0,
    max_selections: group.max_selections || 10,
    required: group.required || 0,
    sort_order: group.sort_order || 0,
  });
  return result.lastInsertRowid;
}

export function updateModifierGroup(id, updates) {
  const allowedFields = ['name', 'display_name', 'min_selections', 'max_selections', 'required', 'sort_order'];
  const filteredUpdates = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      filteredUpdates[key] = updates[key];
    }
  }

  if (Object.keys(filteredUpdates).length === 0) return null;

  const fields = Object.keys(filteredUpdates).map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE modifier_groups SET ${fields} WHERE id = @id`);
  return stmt.run({ ...filteredUpdates, id });
}

export function deleteModifierGroup(id) {
  // Options will be deleted via CASCADE
  // Unlink from items
  db.prepare('DELETE FROM item_modifier_groups WHERE group_id = ?').run(id);
  return db.prepare('DELETE FROM modifier_groups WHERE id = ?').run(id);
}

export function deleteAllModifierGroups() {
  db.prepare('DELETE FROM item_modifier_groups').run();
  db.prepare('DELETE FROM modifier_options').run();
  return db.prepare('DELETE FROM modifier_groups').run();
}

// ============ Modifier Option CRUD ============
export function getModifierOptions(groupId) {
  return db.prepare(`
    SELECT * FROM modifier_options
    WHERE group_id = ? AND available = 1
    ORDER BY sort_order, name
  `).all(groupId);
}

export function getAllModifierOptions() {
  return db.prepare(`
    SELECT mo.*, mg.name as group_name, mg.display_name as group_display_name
    FROM modifier_options mo
    LEFT JOIN modifier_groups mg ON mo.group_id = mg.id
    WHERE mo.available = 1
    ORDER BY mg.sort_order, mo.sort_order, mo.name
  `).all();
}

export function getModifierOption(id) {
  return db.prepare('SELECT * FROM modifier_options WHERE id = ?').get(id);
}

// Look up modifier option by name or display_name for price verification
export function getModifierOptionByName(name) {
  return db.prepare(`
    SELECT * FROM modifier_options
    WHERE name = ? OR display_name = ?
    LIMIT 1
  `).get(name, name);
}

export function createModifierOption(option) {
  const stmt = db.prepare(`
    INSERT INTO modifier_options (group_id, name, display_name, price_adjustment, available, sort_order)
    VALUES (@group_id, @name, @display_name, @price_adjustment, @available, @sort_order)
  `);
  const result = stmt.run({
    group_id: option.group_id,
    name: option.name,
    display_name: option.display_name || option.name,
    price_adjustment: option.price_adjustment || 0,
    available: option.available !== undefined ? option.available : 1,
    sort_order: option.sort_order || 0,
  });
  return result.lastInsertRowid;
}

export function updateModifierOption(id, updates) {
  const allowedFields = ['name', 'display_name', 'price_adjustment', 'available', 'sort_order', 'group_id'];
  const filteredUpdates = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      filteredUpdates[key] = updates[key];
    }
  }

  if (Object.keys(filteredUpdates).length === 0) return null;

  const fields = Object.keys(filteredUpdates).map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE modifier_options SET ${fields} WHERE id = @id`);
  return stmt.run({ ...filteredUpdates, id });
}

export function deleteModifierOption(id) {
  return db.prepare('DELETE FROM modifier_options WHERE id = ?').run(id);
}

export function deleteAllModifierOptions() {
  return db.prepare('DELETE FROM modifier_options').run();
}

// ============ Item-Modifier Group Linking ============
export function getModifiersForItem(itemId) {
  const groups = db.prepare(`
    SELECT mg.*
    FROM item_modifier_groups img
    JOIN modifier_groups mg ON img.group_id = mg.id
    WHERE img.item_id = ?
    ORDER BY mg.sort_order
  `).all(itemId);

  // Get options for each group
  for (const group of groups) {
    group.options = getModifierOptions(group.id);
  }

  return groups;
}

export function getItemsForModifierGroup(groupId) {
  return db.prepare(`
    SELECT mi.*, c.name as category_name
    FROM item_modifier_groups img
    JOIN menu_items mi ON img.item_id = mi.id
    LEFT JOIN categories c ON mi.category_id = c.id
    WHERE img.group_id = ?
    ORDER BY c.sort_order, mi.sort_order, mi.name
  `).all(groupId);
}

export function linkItemToModifierGroup(itemId, groupId) {
  const stmt = db.prepare('INSERT OR IGNORE INTO item_modifier_groups (item_id, group_id) VALUES (?, ?)');
  return stmt.run(itemId, groupId);
}

export function unlinkItemFromModifierGroup(itemId, groupId) {
  const stmt = db.prepare('DELETE FROM item_modifier_groups WHERE item_id = ? AND group_id = ?');
  return stmt.run(itemId, groupId);
}

export function setItemModifierGroups(itemId, groupIds) {
  // Remove all existing links
  db.prepare('DELETE FROM item_modifier_groups WHERE item_id = ?').run(itemId);

  // Add new links
  const insert = db.prepare('INSERT INTO item_modifier_groups (item_id, group_id) VALUES (?, ?)');
  for (const groupId of groupIds) {
    insert.run(itemId, groupId);
  }
}

export function clearItemModifierLinks() {
  return db.prepare('DELETE FROM item_modifier_groups').run();
}

// ============ Orders ============
export function createOrder(order) {
  const pickupNumber = getNextPickupNumber();
  const stmt = db.prepare(`
    INSERT INTO orders (pickup_number, customer_name, email, status, subtotal, tax, total, notes)
    VALUES (@pickup_number, @customer_name, @email, @status, @subtotal, @tax, @total, @notes)
  `);
  const result = stmt.run({
    ...order,
    pickup_number: pickupNumber,
    status: 'pending',
    email: order.email || null,
  });
  return { id: result.lastInsertRowid, pickup_number: pickupNumber };
}

export function getOrder(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;

  order.items = db.prepare(`
    SELECT oi.*,
      (SELECT GROUP_CONCAT(oim.modifier_name || CASE WHEN oim.price_adjustment > 0 THEN ' (+$' || printf('%.2f', oim.price_adjustment) || ')' ELSE '' END, ', ')
       FROM order_item_modifiers oim WHERE oim.order_item_id = oi.id) as modifiers
    FROM order_items oi
    WHERE oi.order_id = ?
  `).all(id);

  return order;
}

export function getActiveOrders() {
  const orders = db.prepare(`
    SELECT * FROM orders
    WHERE status IN ('pending', 'preparing', 'ready')
    ORDER BY
      CASE status
        WHEN 'pending' THEN 1
        WHEN 'preparing' THEN 2
        WHEN 'ready' THEN 3
      END,
      created_at ASC
  `).all();

  const getItems = db.prepare(`
    SELECT oi.*,
      (SELECT GROUP_CONCAT(oim.modifier_name || CASE WHEN oim.price_adjustment > 0 THEN ' (+$' || printf('%.2f', oim.price_adjustment) || ')' ELSE '' END, ', ')
       FROM order_item_modifiers oim WHERE oim.order_item_id = oi.id) as modifiers
    FROM order_items oi
    WHERE oi.order_id = ?
  `);

  for (const order of orders) {
    order.items = getItems.all(order.id);
  }

  return orders;
}

export function updateOrderStatus(id, status) {
  const stmt = db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  return stmt.run(status, id);
}

export function addOrderItem(orderItem) {
  const stmt = db.prepare(`
    INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, special_instructions)
    VALUES (@order_id, @menu_item_id, @item_name, @quantity, @unit_price, @total_price, @special_instructions)
  `);
  const result = stmt.run(orderItem);
  return result.lastInsertRowid;
}

export function addOrderItemModifier(modifier) {
  const stmt = db.prepare(`
    INSERT INTO order_item_modifiers (order_item_id, modifier_name, price_adjustment)
    VALUES (@order_item_id, @modifier_name, @price_adjustment)
  `);
  return stmt.run(modifier);
}

// ============ Stats ============
export function getTodayOrderCount() {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM orders
    WHERE date(created_at) = date('now')
  `).get();
  return result.count;
}

export function getTodayRevenue() {
  const result = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total FROM orders
    WHERE date(created_at) = date('now') AND status != 'cancelled'
  `).get();
  return result.total;
}

// ============ Settings ============
export function getSetting(key) {
  const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return result ? result.value : null;
}

export function setSetting(key, value) {
  return db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
  `).run(key, value, value);
}

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

// Seed the database on first run
seedDatabase();

export default db;
