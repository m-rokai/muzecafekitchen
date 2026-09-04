import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getSql, closeDatabase } from '../db/postgres.js';
import { getSupabaseAdminClient } from '../lib/supabase.js';

const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!sourcePath || !fs.existsSync(sourcePath)) {
  throw new Error('Usage: npm run migrate:sqlite -- /absolute/path/to/muze_orders.db');
}

const source = new DatabaseSync(sourcePath, { readOnly: true });
const sql = getSql();

function tableExists(name) {
  return Boolean(source.prepare(
    "select 1 from sqlite_master where type = 'table' and name = ?",
  ).get(name));
}

function rows(name) {
  return tableExists(name) ? source.prepare(`select * from ${name}`).all() : [];
}

function cents(row, centsKey, decimalKey) {
  const canonical = Number(row[centsKey]);
  return Number.isInteger(canonical) && canonical >= 0
    ? canonical
    : Math.max(0, Math.round((Number(row[decimalKey]) || 0) * 100));
}

function timestamp(value) {
  if (!value) return new Date().toISOString();
  const normalized = String(value).includes('T') ? String(value) : `${value}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? new Date().toISOString() : date.toISOString();
}

function json(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return { legacy_value: String(value) }; }
}

async function migrateImageUrl(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) return imageUrl || null;
  const filename = path.basename(imageUrl);
  const candidates = [
    process.env.LEGACY_UPLOADS_DIR,
    path.join(path.dirname(sourcePath), 'uploads'),
    path.resolve('uploads'),
  ].filter(Boolean);
  const sourceFile = candidates.map(directory => path.join(directory, filename)).find(fs.existsSync);
  if (!sourceFile) {
    console.warn(`Image not found for ${filename}; leaving the legacy URL for manual repair.`);
    return imageUrl;
  }
  const contentType = filename.endsWith('.png') ? 'image/png'
    : filename.match(/\.jpe?g$/i) ? 'image/jpeg'
      : 'image/webp';
  const storage = getSupabaseAdminClient().storage.from('menu-images');
  const { error } = await storage.upload(filename, fs.readFileSync(sourceFile), {
    contentType,
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) throw error;
  return storage.getPublicUrl(filename).data.publicUrl;
}

async function createArchiveIdentity(orderCount) {
  if (orderCount === 0) return null;
  const email = `legacy-orders-${Date.now()}@invalid.local`;
  const { data, error } = await getSupabaseAdminClient().auth.admin.createUser({
    email,
    password: crypto.randomBytes(48).toString('base64url'),
    email_confirm: true,
    app_metadata: { role: 'legacy_archive' },
    user_metadata: { purpose: 'SQLite migration archive; interactive login disabled' },
  });
  if (error) throw error;
  return data.user.id;
}

async function migrate() {
  const [target] = await sql`
    select
      (select count(*) from public.categories)::integer as categories,
      (select count(*) from public.orders)::integer as orders
  `;
  if (target.categories || target.orders) {
    throw new Error('Migration refused because the target already contains menu or order data.');
  }

  const sourceOrders = rows('orders');
  const archiveUserId = await createArchiveIdentity(sourceOrders.length);
  const sourceMenuItems = rows('menu_items');
  const migratedImageUrls = new Map();
  for (const row of sourceMenuItems) {
    migratedImageUrls.set(row.id, await migrateImageUrl(row.image_url));
  }

  await sql.begin(async tx => {
    // Historical backfills should not emit hundreds of kitchen events. These
    // DDL changes are transactional: a failed import rolls them back, and a
    // successful import re-enables both triggers before commit.
    await tx`alter table public.orders disable trigger orders_broadcast_kitchen_change`;
    await tx`alter table public.settings disable trigger settings_broadcast_kitchen_change`;

    for (const row of rows('categories')) {
      await tx`
        insert into public.categories (id, name, description, sort_order, created_at)
        values (${row.id}, ${row.name}, ${row.description}, ${row.sort_order || 0}, ${timestamp(row.created_at)})
      `;
    }
    for (const row of sourceMenuItems) {
      await tx`
        insert into public.menu_items
          (id, name, description, price_cents, category_id, image_url, available, sort_order, created_at)
        values (
          ${row.id}, ${row.name}, ${row.description}, ${cents(row, 'price_cents', 'price')},
          ${row.category_id}, ${migratedImageUrls.get(row.id)}, ${Boolean(row.available)}, ${row.sort_order || 0},
          ${timestamp(row.created_at)}
        )
      `;
    }
    for (const row of rows('modifier_groups')) {
      await tx`
        insert into public.modifier_groups
          (id, name, display_name, min_selections, max_selections, required, sort_order, created_at)
        values (
          ${row.id}, ${row.name}, ${row.display_name}, ${row.min_selections || 0},
          ${row.max_selections || 10}, ${Boolean(row.required)}, ${row.sort_order || 0},
          ${timestamp(row.created_at)}
        )
      `;
    }
    for (const row of rows('modifier_options')) {
      await tx`
        insert into public.modifier_options
          (id, group_id, name, display_name, price_adjustment_cents, available, sort_order, created_at)
        values (
          ${row.id}, ${row.group_id}, ${row.name}, ${row.display_name},
          ${cents(row, 'price_adjustment_cents', 'price_adjustment')}, ${Boolean(row.available)},
          ${row.sort_order || 0}, ${timestamp(row.created_at)}
        )
      `;
    }
    for (const row of rows('item_modifier_groups')) {
      await tx`
        insert into public.item_modifier_groups (item_id, group_id)
        values (${row.item_id}, ${row.group_id})
      `;
    }

    for (const row of sourceOrders) {
      const publicId = /^[0-9a-f-]{36}$/i.test(row.public_id || '')
        ? row.public_id
        : crypto.randomUUID();
      const idempotencyKey = row.idempotency_key?.length >= 16
        ? row.idempotency_key
        : `legacy:${publicId}`;
      const requestHash = /^[0-9a-f]{64}$/i.test(row.request_hash || '')
        ? row.request_hash
        : crypto.createHash('sha256').update(`legacy:${row.id}`).digest('hex');
      await tx`
        insert into public.orders (
          id, public_id, customer_id, idempotency_key, request_hash, pickup_number,
          customer_name, email, status, subtotal_cents, tax_cents, total_cents, notes,
          cancellation_reason, cancelled_by, pickup_reminder_sent,
          payment_status, payment_method, payment_provider, payment_reference,
          payment_updated_at, created_at, updated_at
        ) values (
          ${row.id}, ${publicId}, ${archiveUserId}, ${idempotencyKey}, ${requestHash}, ${row.pickup_number},
          ${row.customer_name}, ${row.email || `legacy-order-${publicId}@invalid.local`}, ${row.status || 'completed'},
          ${cents(row, 'subtotal_cents', 'subtotal')}, ${cents(row, 'tax_cents', 'tax')},
          ${cents(row, 'total_cents', 'total')}, ${row.notes}, ${row.cancellation_reason},
          ${row.cancelled_by}, ${Boolean(row.pickup_reminder_sent)}, ${row.payment_status || 'unpaid'},
          ${row.payment_method || 'cash'}, ${row.payment_provider}, ${row.payment_reference},
          ${row.payment_updated_at ? timestamp(row.payment_updated_at) : null},
          ${timestamp(row.created_at)}, ${timestamp(row.updated_at)}
        )
      `;
    }
    for (const row of rows('order_items')) {
      await tx`
        insert into public.order_items (
          id, order_id, menu_item_id, item_name, quantity, unit_price_cents,
          total_price_cents, special_instructions, created_at
        ) values (
          ${row.id}, ${row.order_id}, ${row.menu_item_id}, ${row.item_name}, ${row.quantity || 1},
          ${cents(row, 'unit_price_cents', 'unit_price')}, ${cents(row, 'total_price_cents', 'total_price')},
          ${row.special_instructions}, ${timestamp(row.created_at)}
        )
      `;
    }
    for (const row of rows('order_item_modifiers')) {
      await tx`
        insert into public.order_item_modifiers (
          id, order_item_id, modifier_option_id, modifier_name, price_adjustment_cents, created_at
        ) values (
          ${row.id}, ${row.order_item_id}, ${row.modifier_option_id}, ${row.modifier_name},
          ${cents(row, 'price_adjustment_cents', 'price_adjustment')}, ${timestamp(row.created_at)}
        )
      `;
    }
    for (const row of rows('order_lifecycle_events')) {
      await tx`
        insert into public.order_lifecycle_events
          (id, order_id, from_status, to_status, actor_type, actor_subject, metadata, created_at)
        values (
          ${row.id}, ${row.order_id}, ${row.from_status}, ${row.to_status}, ${row.actor_type},
          ${row.actor_subject}, ${tx.json(json(row.metadata))}, ${timestamp(row.created_at)}
        )
      `;
    }
    for (const row of rows('payments')) {
      await tx`
        insert into public.payments
          (id, order_id, provider, status, amount_cents, external_reference,
           idempotency_key, metadata, created_at, updated_at)
        values (
          ${row.id}, ${row.order_id}, ${row.provider}, ${row.status}, ${row.amount_cents},
          ${row.external_reference}, ${row.idempotency_key || `legacy-payment:${row.id}`},
          ${tx.json(json(row.metadata))},
          ${timestamp(row.created_at)}, ${timestamp(row.updated_at)}
        )
      `;
    }
    for (const row of rows('settings')) {
      // Legacy PIN authentication was replaced by Supabase Auth roles. Never
      // carry the plaintext credential into the hosted settings table.
      if (row.key === 'admin_pin') continue;
      await tx`
        insert into public.settings (key, value, updated_at)
        values (${row.key}, ${row.value}, ${timestamp(row.updated_at)})
        on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at
      `;
    }
    const [counter] = rows('pickup_counter');
    if (counter?.last_reset_date) {
      await tx`
        insert into private.pickup_counters (service_date, current_number)
        values (${counter.last_reset_date}, ${Math.max(Number(counter.current_number) || 1, 1)})
        on conflict (service_date) do update set current_number = excluded.current_number
      `;
    }

    for (const table of ['categories', 'menu_items', 'modifier_groups', 'modifier_options', 'orders', 'order_items', 'order_item_modifiers']) {
      await tx.unsafe(`select setval(pg_get_serial_sequence('public.${table}', 'id'), coalesce((select max(id) from public.${table}), 1), true)`);
    }

    await tx`alter table public.orders enable trigger orders_broadcast_kitchen_change`;
    await tx`alter table public.settings enable trigger settings_broadcast_kitchen_change`;
  });

  console.log(`Migrated ${sourceOrders.length} historical orders. Legacy orders are owned by archive user ${archiveUserId || 'none'}.`);
  console.log('Legacy /uploads menu images found beside the database were copied to Supabase Storage.');
}

try {
  await migrate();
} finally {
  source.close();
  await closeDatabase();
}
