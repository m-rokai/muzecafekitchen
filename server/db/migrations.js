import crypto from 'crypto';
import { menuItems } from './seed.js';

// Frozen baseline. Keep schema.sql as a readable reference for operators, but
// never let edits to that mutable file change what migration 1 applies.
const BASELINE_SCHEMA = String.raw`-- Muze Café Order System Database Schema

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0,
  category_id INTEGER,
  image_url TEXT,
  available INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

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

CREATE TABLE IF NOT EXISTS modifier_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER,
  name TEXT NOT NULL,
  display_name TEXT,
  price_adjustment REAL DEFAULT 0,
  price_adjustment_cents INTEGER NOT NULL DEFAULT 0,
  available INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS item_modifier_groups (
  item_id INTEGER,
  group_id INTEGER,
  PRIMARY KEY (item_id, group_id),
  FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  upstream_subject TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_by TEXT CHECK(cancelled_by IN ('customer', 'staff') OR cancelled_by IS NULL),
  pickup_reminder_sent INTEGER DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS pickup_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_number INTEGER DEFAULT 0,
  last_reset_date TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO pickup_counter (id, current_number, last_reset_date) VALUES (1, 0, date('now'));
INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_rate', '0.0825');

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_modifier_options_group ON modifier_options(group_id);`;

function hasColumn(db, tableName, columnName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all()
    .some(column => column.name === columnName);
}

function addColumn(db, tableName, columnName, definition) {
  if (!hasColumn(db, tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function centsFromLegacy(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function legacyRequestHash(orderId) {
  return crypto.createHash('sha256')
    .update(JSON.stringify({ legacyOrderId: orderId }))
    .digest('hex');
}

const PUBLIC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function backfillUniquePublicIds(db) {
  const orders = db.prepare('SELECT id, public_id FROM orders ORDER BY id').all();
  const seen = new Set();
  const update = db.prepare('UPDATE orders SET public_id = ? WHERE id = ?');
  for (const order of orders) {
    let publicId = order.public_id;
    if (!PUBLIC_ID_PATTERN.test(publicId || '') || seen.has(publicId)) {
      publicId = crypto.randomUUID();
      update.run(publicId, order.id);
    }
    seen.add(publicId);
  }
}

/**
 * Every schema change is applied exactly once and recorded in
 * schema_migrations. Keeping migrations as code makes a new checkout
 * deterministic while still allowing an existing Fly volume to be upgraded
 * in place. Migrations are intentionally synchronous because better-sqlite3
 * transactions are synchronous.
 */
export const MIGRATIONS = [
  {
    version: 1,
    name: 'baseline-schema',
    up(db) {
      db.exec(BASELINE_SCHEMA);
    },
  },
  {
    version: 2,
    name: 'revival-customer-order-domain',
    up(db) {
      // These additions cover databases created before the versioned runner
      // existed. CREATE TABLE IF NOT EXISTS in the baseline handles fresh
      // databases; ALTER TABLE handles the legacy Fly volume.
      db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          upstream_subject TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS order_lifecycle_events (
          id TEXT PRIMARY KEY,
          order_id INTEGER NOT NULL,
          from_status TEXT,
          to_status TEXT NOT NULL,
          actor_type TEXT NOT NULL,
          actor_subject TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          order_id INTEGER NOT NULL,
          provider TEXT NOT NULL,
          status TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          external_reference TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        );
      `);

      addColumn(db, 'menu_items', 'price_cents', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'modifier_options', 'price_adjustment_cents', 'INTEGER NOT NULL DEFAULT 0');

      addColumn(db, 'orders', 'public_id', 'TEXT');
      addColumn(db, 'orders', 'customer_id', 'TEXT');
      addColumn(db, 'orders', 'idempotency_key', 'TEXT');
      addColumn(db, 'orders', 'request_hash', 'TEXT');
      addColumn(db, 'orders', 'subtotal_cents', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'orders', 'tax_cents', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'orders', 'total_cents', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'orders', 'payment_status', "TEXT NOT NULL DEFAULT 'unpaid'");
      addColumn(db, 'orders', 'payment_method', "TEXT NOT NULL DEFAULT 'cash'");
      addColumn(db, 'orders', 'payment_provider', 'TEXT');
      addColumn(db, 'orders', 'payment_reference', 'TEXT');
      addColumn(db, 'orders', 'payment_updated_at', 'DATETIME');

      // Columns from the most recent pre-revival releases are also migrated
      // here, so no untracked one-off ALTER TABLE statements remain.
      addColumn(db, 'orders', 'email', 'TEXT');
      addColumn(db, 'orders', 'cancellation_reason', 'TEXT');
      addColumn(db, 'orders', 'cancelled_by', 'TEXT');
      addColumn(db, 'orders', 'pickup_reminder_sent', 'INTEGER DEFAULT 0');

      addColumn(db, 'order_items', 'unit_price_cents', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'order_items', 'total_price_cents', 'INTEGER NOT NULL DEFAULT 0');
      addColumn(db, 'order_item_modifiers', 'modifier_option_id', 'INTEGER');
      addColumn(db, 'order_item_modifiers', 'price_adjustment_cents', 'INTEGER NOT NULL DEFAULT 0');

      // Convert legacy decimal storage once. All new writes use the *_cents
      // columns; the decimal columns remain as compatibility projections for
      // the existing admin/email/client code until those surfaces migrate.
      db.exec(`
        UPDATE menu_items
        SET price_cents = CAST(ROUND(COALESCE(price, 0) * 100) AS INTEGER)
        WHERE price_cents = 0 AND COALESCE(price, 0) != 0;
        UPDATE modifier_options
        SET price_adjustment_cents = CAST(ROUND(COALESCE(price_adjustment, 0) * 100) AS INTEGER)
        WHERE price_adjustment_cents = 0 AND COALESCE(price_adjustment, 0) != 0;
        UPDATE orders
        SET subtotal_cents = CAST(ROUND(COALESCE(subtotal, 0) * 100) AS INTEGER),
            tax_cents = CAST(ROUND(COALESCE(tax, 0) * 100) AS INTEGER),
            total_cents = CAST(ROUND(COALESCE(total, 0) * 100) AS INTEGER)
        WHERE subtotal_cents = 0 AND tax_cents = 0 AND total_cents = 0
          AND (COALESCE(subtotal, 0) != 0 OR COALESCE(tax, 0) != 0 OR COALESCE(total, 0) != 0);
        UPDATE order_items
        SET unit_price_cents = CAST(ROUND(COALESCE(unit_price, 0) * 100) AS INTEGER),
            total_price_cents = CAST(ROUND(COALESCE(total_price, 0) * 100) AS INTEGER)
        WHERE unit_price_cents = 0 AND total_price_cents = 0
          AND (COALESCE(unit_price, 0) != 0 OR COALESCE(total_price, 0) != 0);
        UPDATE order_item_modifiers
        SET price_adjustment_cents = CAST(ROUND(COALESCE(price_adjustment, 0) * 100) AS INTEGER)
        WHERE price_adjustment_cents = 0 AND COALESCE(price_adjustment, 0) != 0;
      `);

      // Existing orders had no customer identity or public id. Give each
      // legacy row a private synthetic subject and a random public UUID so
      // numeric ids cannot leak through the public API after the upgrade.
      const legacyOrders = db.prepare(`
        SELECT id, status, customer_name
        FROM orders
        WHERE public_id IS NULL OR customer_id IS NULL OR idempotency_key IS NULL
      `).all();
      const findCustomer = db.prepare('SELECT id FROM customers WHERE upstream_subject = ?');
      const insertCustomer = db.prepare(`
        INSERT INTO customers (id, upstream_subject) VALUES (?, ?)
      `);
      const updateOrderIdentity = db.prepare(`
        UPDATE orders
        SET public_id = COALESCE(public_id, ?),
            customer_id = COALESCE(customer_id, ?),
            idempotency_key = COALESCE(idempotency_key, ?),
            request_hash = COALESCE(request_hash, ?)
        WHERE id = ?
      `);

      for (const order of legacyOrders) {
        const subject = `legacy-order-${order.id}`;
        let customer = findCustomer.get(subject);
        if (!customer) {
          customer = { id: crypto.randomUUID() };
          insertCustomer.run(customer.id, subject);
        }
        updateOrderIdentity.run(
          crypto.randomUUID(),
          customer.id,
          `legacy-${order.id}`,
          legacyRequestHash(order.id),
          order.id,
        );
      }

      // A database created by the baseline with zero orders still needs the
      // indexes; a legacy database now has non-null identity values above.
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_menu_items_price_cents ON menu_items(price_cents);
        CREATE INDEX IF NOT EXISTS idx_orders_public_id ON orders(public_id);
        CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_customer_idempotency
          ON orders(customer_id, idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_order_events_order
          ON order_lifecycle_events(order_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_payments_order
          ON payments(order_id, created_at);
      `);

      // Preserve the settings that were previously installed by ad-hoc
      // startup migrations, now as part of the versioned schema.
      db.exec(`
        INSERT OR IGNORE INTO settings (key, value) VALUES ('announcement_text', '');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('announcement_enabled', 'false');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('kitchen_open', 'true');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('kitchen_closed_message', '');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('popular_item_ids', '16,17,29,30,21');
      `);

      // Give upgraded rows the same initial lifecycle record that new orders
      // receive. The event id is random and therefore safe to retry.
      const existingOrderIds = db.prepare('SELECT id, status FROM orders').all();
      const hasInitialEvent = db.prepare(`
        SELECT 1 FROM order_lifecycle_events
        WHERE order_id = ? AND from_status IS NULL AND to_status = ?
        LIMIT 1
      `);
      const insertEvent = db.prepare(`
        INSERT INTO order_lifecycle_events
          (id, order_id, from_status, to_status, actor_type, actor_subject, metadata)
        VALUES (?, ?, NULL, ?, 'system', NULL, ?)
      `);
      for (const order of existingOrderIds) {
        if (!hasInitialEvent.get(order.id, order.status || 'pending')) {
          insertEvent.run(
            crypto.randomUUID(),
            order.id,
            order.status || 'pending',
            JSON.stringify({ migrated: true }),
          );
        }
      }
    },
  },
  {
    version: 3,
    name: 'seed-generated-menu-image-urls',
    up(db) {
      const generatedNames = new Set([
        ...menuItems.map(item => item.name),
        'Just Peachy',
        'Iced Cold Foam Vanilla Latte',
        'Breakfast Panini',
        'Breakfast Quesadilla',
        'Breakfast Sliders',
        'French Toast Casserole',
        'Smothered Green Burrito',
        'Tamale Breakfast',
        'California Turkey',
        'Italian Panini',
        'Roast Beef Panini with Au Jus',
        'Southwest Quesadilla',
        'Jalapeno Tuna Melt',
        'Fresh Fruit',
        'Hash Brown Patties',
        'Passion Fruit Boba',
        'Pasta Salad',
        'Potato Salad',
      ]);
      const slugFor = name => name
        .toLowerCase()
        .replace(/["']/g, '')
        .replace(/&/g, ' ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const items = db.prepare(`
        SELECT id, name FROM menu_items
        WHERE image_url IS NULL OR image_url = ''
      `).all();
      const update = db.prepare('UPDATE menu_items SET image_url = ? WHERE id = ?');
      for (const item of items) {
        if (generatedNames.has(item.name)) {
          update.run(`/uploads/menu-${slugFor(item.name)}.webp`, item.id);
        }
      }
    },
  },
  {
    version: 4,
    name: 'security-and-payment-hardening',
    up(db) {
      addColumn(db, 'orders', 'payment_method', "TEXT NOT NULL DEFAULT 'cash'");
      db.exec(`
        UPDATE orders
        SET payment_method = 'cash'
        WHERE payment_method IS NULL OR payment_method = '';
        DELETE FROM settings WHERE key = 'admin_pin' AND value = '7890';
      `);
      backfillUniquePublicIds(db);
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_public_id_unique
          ON orders(public_id);
      `);
    },
  },
];

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations ORDER BY version').all()
      .map(row => row.version),
  );
  const knownVersions = new Set(MIGRATIONS.map(migration => migration.version));
  const unknown = [...applied].filter(version => !knownVersions.has(version));
  if (unknown.length > 0) {
    throw new Error(`Database has unknown migration version(s): ${unknown.join(', ')}`);
  }

  const apply = db.transaction(() => {
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      migration.up(db);
      db.prepare(`
        INSERT INTO schema_migrations (version, name) VALUES (?, ?)
      `).run(migration.version, migration.name);
    }
  });
  apply();

  return db.prepare(
    'SELECT version, name, applied_at FROM schema_migrations ORDER BY version',
  ).all();
}
