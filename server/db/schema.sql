-- Muze Café Order System Database Schema

-- Menu Categories
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  category_id INTEGER,
  image_url TEXT,
  available INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Modifier Groups (e.g., "Add-ons", "Milk Options")
CREATE TABLE IF NOT EXISTS modifier_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  display_name TEXT,
  min_selections INTEGER DEFAULT 0,
  max_selections INTEGER DEFAULT 10,
  required INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Modifier Options (e.g., "Extra Shot +$1.00", "Oat Milk +$0.75")
CREATE TABLE IF NOT EXISTS modifier_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER,
  name TEXT NOT NULL,
  display_name TEXT,
  price_adjustment REAL DEFAULT 0,
  available INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
);

-- Link menu items to modifier groups (many-to-many)
CREATE TABLE IF NOT EXISTS item_modifier_groups (
  item_id INTEGER,
  group_id INTEGER,
  PRIMARY KEY (item_id, group_id),
  FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pickup_number INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  subtotal REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  menu_item_id INTEGER,
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  special_instructions TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

-- Order Item Modifiers
CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id INTEGER NOT NULL,
  modifier_name TEXT NOT NULL,
  price_adjustment REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
);

-- Daily pickup number tracker
CREATE TABLE IF NOT EXISTS pickup_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_number INTEGER DEFAULT 0,
  last_reset_date TEXT
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize pickup counter
INSERT OR IGNORE INTO pickup_counter (id, current_number, last_reset_date) VALUES (1, 0, date('now'));

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_rate', '0.0825');
INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_pin', '7890');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_modifier_options_group ON modifier_options(group_id);
