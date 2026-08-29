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
  -- Canonical money representation. `price` is retained as a read-compatible
  -- decimal projection for the existing admin/client surface.
  price_cents INTEGER NOT NULL DEFAULT 0,
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
  -- Canonical money representation. See menu_items.price_cents.
  price_adjustment_cents INTEGER NOT NULL DEFAULT 0,
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

-- Verified customer identities are keyed by the subject issued by the
-- configured upstream identity provider. The server never accepts a name,
-- email, or arbitrary client value as an identity.
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  upstream_subject TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Internal numeric id is never used as a public API identifier.
  public_id TEXT UNIQUE,
  customer_id TEXT,
  idempotency_key TEXT,
  request_hash TEXT,
  pickup_number INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  subtotal REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL DEFAULT 0,
  -- Canonical integer-cent totals used for all pricing and payment decisions.
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_by TEXT CHECK(cancelled_by IN ('customer', 'staff') OR cancelled_by IS NULL),
  pickup_reminder_sent INTEGER DEFAULT 0,
  -- `cash` is the explicit legacy checkout path. Unpaid/awaiting provider
  -- states cannot enter fulfillment until a future payment adapter authorizes.
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK(payment_status IN ('unpaid', 'pending', 'authorized', 'paid', 'failed', 'refunded')),
  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK(payment_method IN ('cash', 'square', 'stripe')),
  payment_provider TEXT CHECK(payment_provider IN ('square', 'stripe') OR payment_provider IS NULL),
  payment_reference TEXT,
  payment_updated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, idempotency_key),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
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
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  total_price_cents INTEGER NOT NULL DEFAULT 0,
  special_instructions TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

-- Order Item Modifiers
CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id INTEGER NOT NULL,
  modifier_option_id INTEGER,
  modifier_name TEXT NOT NULL,
  price_adjustment REAL DEFAULT 0,
  price_adjustment_cents INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
);

-- Lifecycle audit trail and payment-provider boundary. These tables are
-- intentionally provider-neutral; adapters can be enabled later without
-- making external calls as part of this revival slice.
CREATE TABLE IF NOT EXISTS order_lifecycle_events (
  id TEXT PRIMARY KEY,
  order_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('customer', 'staff', 'system')),
  actor_subject TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('square', 'stripe')),
  status TEXT NOT NULL CHECK(status IN ('unpaid', 'pending', 'authorized', 'paid', 'failed', 'refunded')),
  amount_cents INTEGER NOT NULL,
  external_reference TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_modifier_options_group ON modifier_options(group_id);
