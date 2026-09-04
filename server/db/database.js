import { getSql } from './postgres.js';

export function dollarsToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

export function centsToDollars(cents) {
  const amount = Number.isInteger(cents) ? cents : Number(cents) || 0;
  return amount / 100;
}

export const FULFILLMENT_PAYMENT_STATUSES = Object.freeze(['authorized', 'paid']);
export const LEGACY_CASH_PAYMENT_METHOD = 'cash';
export const LEGAL_STATUS_TRANSITIONS = Object.freeze({
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
});

export function isPaymentFulfillmentEligible(order) {
  const status = String(order?.payment_status || '').toLowerCase();
  return FULFILLMENT_PAYMENT_STATUSES.includes(status)
    || (status === 'unpaid' && order?.payment_method === LEGACY_CASH_PAYMENT_METHOD);
}

function idNumber(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : value;
}

function normalizeRow(row) {
  if (!row) return null;
  const result = { ...row };
  for (const key of ['id', 'category_id', 'group_id', 'item_id', 'order_id', 'order_item_id', 'menu_item_id', 'modifier_option_id']) {
    if (result[key] != null) result[key] = idNumber(result[key]);
  }
  for (const key of ['price', 'price_adjustment', 'subtotal', 'tax', 'total', 'unit_price', 'total_price', 'total_revenue']) {
    if (result[key] != null) result[key] = Number(result[key]);
  }
  return result;
}

function normalizeRows(rows) {
  return rows.map(normalizeRow);
}

function allowedUpdates(updates, fields) {
  const result = {};
  for (const field of fields) {
    if (updates[field] !== undefined) result[field] = updates[field];
  }
  return result;
}

export async function checkDatabaseIntegrity() {
  const sql = getSql();
  const [result] = await sql`select true as healthy`;
  return result?.healthy ? 'ok' : null;
}

// ============ Category CRUD ============
export async function getAllCategories(channel = null) {
  const sql = getSql();
  const rows = channel
    ? await sql`select * from public.categories where channel = ${channel} order by sort_order, name`
    : await sql`select * from public.categories order by channel, sort_order, name`;
  return normalizeRows(rows);
}

export async function getCategory(id) {
  const [row] = await getSql()`select * from public.categories where id = ${id}`;
  return normalizeRow(row);
}

export async function getCategoryByName(name) {
  const [row] = await getSql()`select * from public.categories where name = ${name}`;
  return normalizeRow(row);
}

export async function createCategory(category) {
  const [row] = await getSql()`
    insert into public.categories (name, description, sort_order)
    values (${category.name}, ${category.description || ''}, ${category.sort_order || 0})
    returning id
  `;
  return idNumber(row.id);
}

export async function updateCategory(id, updates) {
  const sql = getSql();
  const values = allowedUpdates(updates, ['name', 'description', 'sort_order']);
  if (Object.keys(values).length === 0) return null;
  return sql`update public.categories set ${sql(values)} where id = ${id}`;
}

export async function deleteCategory(id) {
  return getSql()`delete from public.categories where id = ${id}`;
}

// ============ Menu Item CRUD ============
export async function getAllMenuItems(channel = 'cafe') {
  return normalizeRows(await getSql()`
    select mi.*, c.name as category_name,
      exists(select 1 from public.item_modifier_groups img where img.item_id = mi.id) as has_modifiers
    from public.menu_items mi
    left join public.categories c on c.id = mi.category_id
    where mi.available = true and mi.channel = ${channel}
    order by c.sort_order, mi.sort_order, mi.name
  `);
}

export async function getAllMenuItemsIncludingUnavailable() {
  return normalizeRows(await getSql()`
    select mi.*, c.name as category_name,
      exists(select 1 from public.item_modifier_groups img where img.item_id = mi.id) as has_modifiers
    from public.menu_items mi
    left join public.categories c on c.id = mi.category_id
    order by c.sort_order, mi.sort_order, mi.name
  `);
}

export async function getMenuItemsByCategory(categoryId, channel = 'cafe') {
  return normalizeRows(await getSql()`
    select * from public.menu_items
    where category_id = ${categoryId} and available = true and channel = ${channel}
    order by sort_order, name
  `);
}

export async function getMenuItem(id) {
  const [row] = await getSql()`
    select mi.*, c.name as category_name
    from public.menu_items mi
    left join public.categories c on c.id = mi.category_id
    where mi.id = ${id}
  `;
  return normalizeRow(row);
}

export async function createMenuItem(item) {
  const [row] = await getSql()`
    insert into public.menu_items
      (name, description, price_cents, category_id, image_url, available, sort_order)
    values (
      ${item.name}, ${item.description || ''}, ${dollarsToCents(item.price)},
      ${item.category_id || null}, ${item.image_url || null},
      ${item.available === undefined ? true : Boolean(item.available)}, ${item.sort_order || 0}
    )
    returning id
  `;
  return idNumber(row.id);
}

export async function updateMenuItem(id, updates) {
  const sql = getSql();
  const values = allowedUpdates(updates, ['name', 'description', 'category_id', 'image_url', 'available', 'sort_order']);
  if (updates.price !== undefined) values.price_cents = dollarsToCents(updates.price);
  if (values.available !== undefined) values.available = Boolean(values.available);
  if (Object.keys(values).length === 0) return null;
  return sql`update public.menu_items set ${sql(values)} where id = ${id}`;
}

export async function deleteMenuItem(id) {
  return getSql()`delete from public.menu_items where id = ${id}`;
}

export async function deleteAllMenuItems() {
  return getSql()`delete from public.menu_items`;
}

// ============ Modifier Group CRUD ============
export async function getAllModifierGroups() {
  return normalizeRows(await getSql()`select * from public.modifier_groups order by sort_order, name`);
}

export async function getModifierGroup(id) {
  const [row] = await getSql()`select * from public.modifier_groups where id = ${id}`;
  return normalizeRow(row);
}

export async function getModifierGroupByName(name) {
  const [row] = await getSql()`select * from public.modifier_groups where name = ${name}`;
  return normalizeRow(row);
}

export async function getModifierGroupWithOptions(id) {
  const group = await getModifierGroup(id);
  if (group) group.options = await getModifierOptions(id);
  return group;
}

export async function createModifierGroup(group) {
  const [row] = await getSql()`
    insert into public.modifier_groups
      (name, display_name, min_selections, max_selections, required, sort_order)
    values (
      ${group.name}, ${group.display_name || group.name}, ${group.min_selections || 0},
      ${group.max_selections || 10}, ${Boolean(group.required)}, ${group.sort_order || 0}
    )
    returning id
  `;
  return idNumber(row.id);
}

export async function updateModifierGroup(id, updates) {
  const sql = getSql();
  const values = allowedUpdates(updates, ['name', 'display_name', 'min_selections', 'max_selections', 'required', 'sort_order']);
  if (values.required !== undefined) values.required = Boolean(values.required);
  if (Object.keys(values).length === 0) return null;
  return sql`update public.modifier_groups set ${sql(values)} where id = ${id}`;
}

export async function deleteModifierGroup(id) {
  return getSql()`delete from public.modifier_groups where id = ${id}`;
}

export async function deleteAllModifierGroups() {
  return getSql()`delete from public.modifier_groups`;
}

// ============ Modifier Option CRUD ============
export async function getModifierOptions(groupId, includeUnavailable = false) {
  return normalizeRows(await getSql()`
    select * from public.modifier_options
    where group_id = ${groupId} and (${includeUnavailable} or available = true)
    order by sort_order, name
  `);
}

export async function getAllModifierOptions(includeUnavailable = false) {
  return normalizeRows(await getSql()`
    select mo.*, mg.name as group_name, mg.display_name as group_display_name
    from public.modifier_options mo
    left join public.modifier_groups mg on mg.id = mo.group_id
    where ${includeUnavailable} or mo.available = true
    order by mg.sort_order, mo.sort_order, mo.name
  `);
}

export async function getModifierOption(id) {
  const [row] = await getSql()`select * from public.modifier_options where id = ${id}`;
  return normalizeRow(row);
}

export async function getModifierOptionByName(name) {
  const [row] = await getSql()`
    select * from public.modifier_options
    where name = ${name} or display_name = ${name}
    order by id limit 1
  `;
  return normalizeRow(row);
}

export async function createModifierOption(option) {
  const [row] = await getSql()`
    insert into public.modifier_options
      (group_id, name, display_name, price_adjustment_cents, available, sort_order)
    values (
      ${option.group_id}, ${option.name}, ${option.display_name || option.name},
      ${dollarsToCents(option.price_adjustment)},
      ${option.available === undefined ? true : Boolean(option.available)}, ${option.sort_order || 0}
    )
    returning id
  `;
  return idNumber(row.id);
}

export async function updateModifierOption(id, updates) {
  const sql = getSql();
  const values = allowedUpdates(updates, ['name', 'display_name', 'available', 'sort_order', 'group_id']);
  if (updates.price_adjustment !== undefined) {
    values.price_adjustment_cents = dollarsToCents(updates.price_adjustment);
  }
  if (values.available !== undefined) values.available = Boolean(values.available);
  if (Object.keys(values).length === 0) return null;
  return sql`update public.modifier_options set ${sql(values)} where id = ${id}`;
}

export async function deleteModifierOption(id) {
  return getSql()`delete from public.modifier_options where id = ${id}`;
}

export async function deleteAllModifierOptions() {
  return getSql()`delete from public.modifier_options`;
}

// ============ Item-Modifier Group Linking ============
export async function getModifiersForItem(itemId) {
  const groups = normalizeRows(await getSql()`
    select mg.*
    from public.item_modifier_groups img
    join public.modifier_groups mg on mg.id = img.group_id
    where img.item_id = ${itemId}
    order by mg.sort_order, mg.name
  `);
  await Promise.all(groups.map(async group => {
    group.options = await getModifierOptions(group.id);
  }));
  return groups;
}

export async function getItemsForModifierGroup(groupId) {
  return normalizeRows(await getSql()`
    select mi.*, c.name as category_name
    from public.item_modifier_groups img
    join public.menu_items mi on mi.id = img.item_id
    left join public.categories c on c.id = mi.category_id
    where img.group_id = ${groupId}
    order by c.sort_order, mi.sort_order, mi.name
  `);
}

export async function linkItemToModifierGroup(itemId, groupId) {
  return getSql()`
    insert into public.item_modifier_groups (item_id, group_id)
    values (${itemId}, ${groupId}) on conflict do nothing
  `;
}

export async function setItemModifierGroups(itemId, groupIds) {
  const sql = getSql();
  return sql.begin(async tx => {
    await tx`delete from public.item_modifier_groups where item_id = ${itemId}`;
    for (const groupId of groupIds) {
      await tx`
        insert into public.item_modifier_groups (item_id, group_id)
        values (${itemId}, ${groupId})
      `;
    }
  });
}

export async function clearItemModifierLinks() {
  return getSql()`delete from public.item_modifier_groups`;
}

function itemModifierTextSql(sql) {
  return sql`
    coalesce(
      string_agg(
        oim.modifier_name || case
          when oim.price_adjustment_cents > 0
            then ' (+$' || to_char(oim.price_adjustment_cents / 100.0, 'FM999999990.00') || ')'
          else ''
        end,
        ', ' order by oim.id
      ) filter (where oim.id is not null),
      ''
    ) as modifiers
  `;
}

async function loadOrderItems(tx, orderIds) {
  if (orderIds.length === 0) return [];
  const rows = await tx`
    select oi.*, ${itemModifierTextSql(tx)}
    from public.order_items oi
    left join public.order_item_modifiers oim on oim.order_item_id = oi.id
    where oi.order_id in ${tx(orderIds)}
    group by oi.id
    order by oi.id
  `;
  return normalizeRows(rows);
}

async function hydrateOrders(tx, rows) {
  const orders = normalizeRows(rows);
  const items = await loadOrderItems(tx, orders.map(order => order.id));
  const byOrder = new Map();
  for (const item of items) {
    const bucket = byOrder.get(item.order_id) || [];
    bucket.push(item);
    byOrder.set(item.order_id, bucket);
  }
  for (const order of orders) order.items = byOrder.get(order.id) || [];
  return orders;
}

async function loadOrderByInternalId(id, tx = getSql()) {
  const rows = await tx`select * from public.orders where id = ${id}`;
  const [order] = await hydrateOrders(tx, rows);
  return order || null;
}

export async function getOrder(id) {
  return loadOrderByInternalId(id);
}

export async function getActiveOrders(channel = 'cafe') {
  const sql = getSql();
  const rows = await sql`
    select * from public.orders
    where status in ('pending', 'preparing', 'ready')
      and channel = ${channel}
      and (payment_status in ('authorized', 'paid')
        or (payment_status = 'unpaid' and payment_method = 'cash'))
    order by case status
      when 'pending' then 1 when 'preparing' then 2 when 'ready' then 3 end,
      created_at asc
  `;
  return hydrateOrders(sql, rows);
}

export async function getOrderByPublicId(publicId) {
  const [row] = await getSql()`select id from public.orders where public_id = ${publicId}`;
  return row ? loadOrderByInternalId(row.id) : null;
}

export async function getOrderForCustomer(publicId, customerId) {
  const [row] = await getSql()`
    select id from public.orders where public_id = ${publicId} and customer_id = ${customerId}
  `;
  return row ? loadOrderByInternalId(row.id) : null;
}

export async function getOrderByIdempotency(customerId, idempotencyKey) {
  const [row] = await getSql()`
    select id from public.orders
    where customer_id = ${customerId} and idempotency_key = ${idempotencyKey}
  `;
  return row ? loadOrderByInternalId(row.id) : null;
}

export async function getCustomerBySubject(subject) {
  return subject ? { id: subject, upstream_subject: subject } : null;
}

export async function getOrCreateCustomer(subject) {
  if (!subject || typeof subject !== 'string') {
    throw new Error('A verified customer subject is required');
  }
  return { id: subject, upstream_subject: subject };
}

export async function createOrderWithItems({
  customerId,
  idempotencyKey,
  requestHash,
  customerName,
  email = null,
  notes = null,
  subtotalCents,
  taxCents,
  totalCents,
  items,
  actorSubject = null,
  channel = 'cafe',
  partnerId = null,
  preorderDeadline = null,
  preorderDeliveryDate = null,
  pickupWindowStart = null,
  pickupWindowEnd = null,
  paymentStatus = 'pending',
  paymentMethod = channel === 'cafe' ? 'square' : 'stripe',
  paymentProvider = channel === 'cafe' ? 'square' : 'stripe',
}) {
  const sql = getSql();
  return sql.begin(async tx => {
    const [counter] = await tx`
      insert into private.pickup_counters (service_date, current_number)
      values (current_date, 1)
      on conflict (service_date) do update
        set current_number = private.pickup_counters.current_number + 1
      returning current_number
    `;
    const [created] = await tx`
      insert into public.orders (
        customer_id, idempotency_key, request_hash, pickup_number,
        customer_name, email, subtotal_cents, tax_cents, total_cents,
        notes, channel, partner_id, preorder_deadline, preorder_delivery_date,
        pickup_window_start, pickup_window_end,
        payment_status, payment_method, payment_provider
      ) values (
        ${customerId}, ${idempotencyKey}, ${requestHash}, ${counter.current_number},
        ${customerName}, ${email}, ${subtotalCents}, ${taxCents}, ${totalCents},
        ${notes}, ${channel}, ${partnerId}, ${preorderDeadline}, ${preorderDeliveryDate},
        ${pickupWindowStart}, ${pickupWindowEnd},
        ${paymentStatus}, ${paymentMethod}, ${paymentProvider}
      )
      returning id, public_id, pickup_number
    `;

    for (const item of items) {
      const [orderItem] = await tx`
        insert into public.order_items (
          order_id, menu_item_id, item_name, quantity,
          unit_price_cents, total_price_cents, special_instructions
        ) values (
          ${created.id}, ${item.menuItemId}, ${item.itemName}, ${item.quantity},
          ${item.unitPriceCents}, ${item.totalPriceCents}, ${item.specialInstructions || null}
        ) returning id
      `;
      for (const modifier of item.modifiers) {
        await tx`
          insert into public.order_item_modifiers (
            order_item_id, modifier_option_id, modifier_name, price_adjustment_cents
          ) values (
            ${orderItem.id}, ${modifier.modifierOptionId}, ${modifier.name},
            ${modifier.priceAdjustmentCents}
          )
        `;
      }
    }

    await tx`
      insert into public.order_lifecycle_events
        (order_id, to_status, actor_type, actor_subject, metadata)
      values (
        ${created.id}, 'pending', 'customer', ${actorSubject},
        ${tx.json({
          channel,
          payment_status: paymentStatus,
          payment_method: paymentMethod,
          payment_provider: paymentProvider,
          preorder_deadline: preorderDeadline,
          preorder_delivery_date: preorderDeliveryDate,
        })}
      )
    `;
    return {
      id: idNumber(created.id),
      public_id: created.public_id,
      pickup_number: created.pickup_number,
      order: await loadOrderByInternalId(created.id, tx),
    };
  });
}

export async function createPaymentAttempt({
  orderId,
  provider,
  idempotencyKey,
  amountCents,
  metadata = {},
}) {
  const [row] = await getSql()`
    insert into public.payments
      (order_id, provider, status, amount_cents, idempotency_key, metadata)
    values (
      ${orderId}, ${provider}, 'pending', ${amountCents},
      ${idempotencyKey}, ${getSql().json(metadata)}
    )
    on conflict (provider, idempotency_key) do update
      set updated_at = now()
    returning *
  `;
  return normalizeRow(row);
}

export async function updatePaymentAttempt(id, {
  status,
  externalReference = null,
  providerEventId = null,
  metadata = {},
}) {
  const sql = getSql();
  const [row] = await sql`
    update public.payments set
      status = case
        when status in ('paid', 'refunded') and ${status} <> 'refunded' then status
        when status = 'authorized' and ${status} in ('pending', 'failed') then status
        else ${status}
      end,
      external_reference = coalesce(${externalReference}, external_reference),
      provider_event_id = coalesce(${providerEventId}, provider_event_id),
      metadata = coalesce(metadata, '{}'::jsonb) || ${sql.json(metadata)}::jsonb
    where id = ${id}
    returning *
  `;
  return normalizeRow(row);
}

export async function setOrderPaymentState(orderId, {
  provider,
  status,
  externalReference = null,
  providerEventId = null,
  paymentId = null,
  metadata = {},
}) {
  const sql = getSql();
  return sql.begin(async tx => {
    const [order] = await tx`select * from public.orders where id = ${orderId} for update`;
    if (!order) return null;
    const priorPaymentStatus = order.payment_status;
    const [updatedOrder] = await tx`
      update public.orders set
        payment_status = case
          when payment_status in ('paid', 'refunded') and ${status} <> 'refunded' then payment_status
          when payment_status = 'authorized' and ${status} in ('pending', 'failed') then payment_status
          else ${status}
        end,
        payment_provider = ${provider},
        payment_method = ${provider},
        payment_reference = coalesce(${externalReference}, payment_reference),
        payment_updated_at = now()
      where id = ${orderId}
      returning payment_status
    `;
    await tx`
      update public.payments set
        status = case
          when status in ('paid', 'refunded') and ${status} <> 'refunded' then status
          when status = 'authorized' and ${status} in ('pending', 'failed') then status
          else ${status}
        end,
        external_reference = coalesce(${externalReference}, external_reference),
        provider_event_id = coalesce(${providerEventId}, provider_event_id),
        metadata = coalesce(metadata, '{}'::jsonb) || ${tx.json(metadata)}::jsonb
      where order_id = ${orderId} and provider = ${provider}
        and (
          (${paymentId}::uuid is not null and id = ${paymentId})
          or (${paymentId}::uuid is null and external_reference = ${externalReference})
        )
    `;
    const hydrated = await loadOrderByInternalId(orderId, tx);
    hydrated.payment_transitioned_to_paid = priorPaymentStatus !== 'paid'
      && updatedOrder.payment_status === 'paid';
    return hydrated;
  });
}

export async function getOrderByPaymentReference(provider, reference) {
  const [row] = await getSql()`
    select id from public.orders
    where payment_provider = ${provider} and payment_reference = ${reference}
  `;
  return row ? loadOrderByInternalId(row.id) : null;
}

export async function claimPaymentWebhookEvent({
  provider,
  providerEventId,
  eventType,
  payloadSha256,
}) {
  const sql = getSql();
  return sql.begin(async tx => {
    const inserted = await tx`
      insert into public.payment_webhook_events
        (provider, provider_event_id, event_type, payload_sha256)
      values (${provider}, ${providerEventId}, ${eventType}, ${payloadSha256})
      on conflict (provider, provider_event_id) do nothing
      returning *
    `;
    if (inserted[0]) return { claimed: true, event: normalizeRow(inserted[0]) };
    const [existing] = await tx`
      select *, (
        processing_status = 'failed'
        or (
          processing_status = 'processing'
          and last_attempt_at <= now() - interval '5 minutes'
        )
      ) as retryable
      from public.payment_webhook_events
      where provider = ${provider} and provider_event_id = ${providerEventId}
      for update
    `;
    if (!existing.retryable) {
      return { claimed: false, event: normalizeRow(existing) };
    }
    const [retried] = await tx`
      update public.payment_webhook_events set
        processing_status = 'processing',
        attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        last_error = null,
        payload_sha256 = ${payloadSha256}
      where id = ${existing.id}
      returning *
    `;
    return { claimed: true, event: normalizeRow(retried) };
  });
}

export async function completePaymentWebhookEvent(id, error = null) {
  return getSql()`
    update public.payment_webhook_events set
      processing_status = ${error ? 'failed' : 'processed'},
      processed_at = ${error ? null : new Date()},
      last_error = ${error ? String(error).slice(0, 1000) : null}
    where id = ${id}
  `;
}

export async function enqueuePartnerHandoff(order) {
  if (!order?.partner_id) return null;
  const sql = getSql();
  const [row] = await sql`
    insert into public.partner_order_handoffs
      (order_id, partner_id, payload)
    values (
      ${order.id}, ${order.partner_id},
      ${sql.json({
        order_public_id: order.public_id,
        pickup_number: order.pickup_number,
        customer_name: order.customer_name,
        email: order.email,
        pickup_window_start: order.pickup_window_start,
        pickup_window_end: order.pickup_window_end,
        preorder_deadline: order.preorder_deadline,
        preorder_delivery_date: order.preorder_delivery_date,
        items: order.items,
      })}
    )
    on conflict (order_id) do update set updated_at = now()
    returning *
  `;
  return normalizeRow(row);
}

export async function upsertPartner({ slug, name, sourceUrl }) {
  const [row] = await getSql()`
    insert into public.partners (slug, name, source_url)
    values (${slug}, ${name}, ${sourceUrl})
    on conflict (slug) do update set
      name = excluded.name,
      source_url = excluded.source_url,
      active = true
    returning *
  `;
  return normalizeRow(row);
}

export async function createPartnerMenuImportRun({ partnerId, sourceUrl }) {
  const [row] = await getSql()`
    insert into public.partner_menu_import_runs (partner_id, source_url)
    values (${partnerId}, ${sourceUrl})
    returning *
  `;
  return normalizeRow(row);
}

export async function stagePartnerMenuImport(runId, { sourceSha256, candidates }) {
  const sql = getSql();
  return sql.begin(async tx => {
    for (const candidate of candidates) {
      await tx`
        insert into public.partner_menu_import_candidates (
          import_run_id, external_source_id, name, description,
          price_cents, image_url, source_url, source_payload
        ) values (
          ${runId}, ${candidate.externalSourceId}, ${candidate.name},
          ${candidate.description || null}, ${candidate.priceCents},
          ${candidate.imageUrl || null}, ${candidate.sourceUrl || null},
          ${tx.json(candidate.sourcePayload || {})}
        )
        on conflict (import_run_id, external_source_id) do nothing
      `;
    }
    const [run] = await tx`
      update public.partner_menu_import_runs set
        status = 'staged', source_sha256 = ${sourceSha256},
        candidate_count = ${candidates.length}, completed_at = now()
      where id = ${runId}
      returning *
    `;
    return normalizeRow(run);
  });
}

export async function failPartnerMenuImport(runId, error) {
  const [row] = await getSql()`
    update public.partner_menu_import_runs set
      status = 'failed', error_message = ${String(error).slice(0, 1000)}, completed_at = now()
    where id = ${runId}
    returning *
  `;
  return normalizeRow(row);
}

export async function listPartnerMenuImports(limit = 20) {
  return normalizeRows(await getSql()`
    select r.*, p.slug as partner_slug, p.name as partner_name
    from public.partner_menu_import_runs r
    join public.partners p on p.id = r.partner_id
    order by r.started_at desc
    limit ${Math.min(Math.max(Number(limit) || 20, 1), 100)}
  `);
}

export async function getPartnerMenuImportCandidates(runId) {
  return normalizeRows(await getSql()`
    select * from public.partner_menu_import_candidates
    where import_run_id = ${runId}
    order by name
  `);
}

export async function publishPartnerMenuImport(runId) {
  const sql = getSql();
  return sql.begin(async tx => {
    const [run] = await tx`
      select * from public.partner_menu_import_runs where id = ${runId} for update
    `;
    if (!run) return { ok: false, code: 'not_found', message: 'Import run not found' };
    if (run.status === 'published') {
      return { ok: true, replayed: true, run: normalizeRow(run) };
    }
    if (run.status !== 'staged') {
      return { ok: false, code: 'not_staged', message: `Import cannot be published from ${run.status}` };
    }
    const candidates = await tx`
      select * from public.partner_menu_import_candidates
      where import_run_id = ${runId}
      order by created_at
    `;
    if (candidates.length === 0) {
      return { ok: false, code: 'empty', message: 'Import has no menu candidates' };
    }
    if (candidates.length > 6) {
      return { ok: false, code: 'too_many_meals', message: 'A weekly partner menu can publish at most six meals' };
    }
    const [week] = await tx`select date_trunc('week', now())::date as menu_week`;
    await tx`
      update public.menu_items set available = false
      where channel = 'partner_meal' and partner_id = ${run.partner_id}
    `;
    for (const [sortOrder, candidate] of candidates.entries()) {
      const sourceMenuDate = candidate.source_payload?.menuDate;
      const possibleAllergens = Array.isArray(candidate.source_payload?.possibleAllergens)
        ? candidate.source_payload.possibleAllergens
        : [];
      const menuDate = /^\d{4}-\d{2}-\d{2}$/.test(sourceMenuDate || '')
        ? sourceMenuDate
        : week.menu_week;
      const [item] = await tx`
        insert into public.menu_items (
          name, description, price_cents, image_url, available, sort_order,
          channel, partner_id, external_source_id, menu_week, source_url,
          possible_allergens
        ) values (
          ${candidate.name}, ${candidate.description}, ${candidate.price_cents},
          ${candidate.image_url}, true, ${sortOrder}, 'partner_meal', ${run.partner_id},
          ${candidate.external_source_id}, ${menuDate}, ${candidate.source_url},
          array(select jsonb_array_elements_text(${tx.json(possibleAllergens)}::jsonb))
        )
        on conflict (partner_id, external_source_id, menu_week)
          where channel = 'partner_meal'
        do update set
          name = excluded.name,
          description = excluded.description,
          price_cents = excluded.price_cents,
          image_url = excluded.image_url,
          source_url = excluded.source_url,
          possible_allergens = excluded.possible_allergens,
          sort_order = excluded.sort_order,
          available = true
        returning id
      `;
      await tx`
        update public.partner_menu_import_candidates
        set published_menu_item_id = ${item.id}
        where id = ${candidate.id}
      `;
    }
    const [published] = await tx`
      update public.partner_menu_import_runs set
        status = 'published', published_at = now()
      where id = ${runId}
      returning *
    `;
    return { ok: true, replayed: false, run: normalizeRow(published), itemCount: candidates.length };
  });
}

export async function cancelOrder(id, { reason = null, source = 'customer', actorSubject = null } = {}) {
  const sql = getSql();
  return sql.begin(async tx => {
    const [current] = await tx`select * from public.orders where id = ${id} for update`;
    if (!current) return { ok: false, code: 'not_found', message: 'Order not found' };
    if (['cancelled', 'completed'].includes(current.status)) {
      return {
        ok: false,
        code: 'final_state',
        message: `Order is already ${current.status}`,
        order: await loadOrderByInternalId(id, tx),
      };
    }
    if (['paid', 'authorized'].includes(current.payment_status)
      && current.payment_method !== LEGACY_CASH_PAYMENT_METHOD) {
      return {
        ok: false,
        code: 'refund_required',
        message: 'A confirmed provider refund is required before cancellation',
        order: await loadOrderByInternalId(id, tx),
      };
    }
    if (source === 'customer' && current.status !== 'pending') {
      return {
        ok: false,
        code: 'too_late',
        message: 'This order is already being prepared. Please come to the counter for help.',
        order: await loadOrderByInternalId(id, tx),
      };
    }
    if (!['customer', 'staff'].includes(source)) {
      return { ok: false, code: 'invalid_actor', message: 'Invalid cancellation actor' };
    }
    const trimmedReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : null;
    await tx`
      update public.orders set
        status = 'cancelled', cancellation_reason = ${trimmedReason || null}, cancelled_by = ${source}
      where id = ${id}
    `;
    await tx`
      insert into public.order_lifecycle_events
        (order_id, from_status, to_status, actor_type, actor_subject, metadata)
      values (
        ${id}, ${current.status}, 'cancelled', ${source}, ${actorSubject},
        ${tx.json({ reason: trimmedReason || null })}
      )
    `;
    return { ok: true, order: await loadOrderByInternalId(id, tx) };
  });
}

export async function transitionOrderStatus(id, status, { actorType = 'staff', actorSubject = null } = {}) {
  const sql = getSql();
  return sql.begin(async tx => {
    const [current] = await tx`select * from public.orders where id = ${id} for update`;
    if (!current) return { ok: false, code: 'not_found', message: 'Order not found' };
    const expected = LEGAL_STATUS_TRANSITIONS[current.status];
    if (expected !== status) {
      return {
        ok: false,
        code: current.status === status ? 'already_in_state' : 'invalid_transition',
        message: current.status === status
          ? `Order is already ${status}`
          : `Cannot move order from ${current.status} to ${status}`,
        order: await loadOrderByInternalId(id, tx),
      };
    }
    if (!isPaymentFulfillmentEligible(current)) {
      return {
        ok: false,
        code: 'payment_required',
        message: 'Payment must be authorized before fulfillment can begin',
        order: await loadOrderByInternalId(id, tx),
      };
    }
    await tx`update public.orders set status = ${status} where id = ${id}`;
    await tx`
      insert into public.order_lifecycle_events
        (order_id, from_status, to_status, actor_type, actor_subject)
      values (${id}, ${current.status}, ${status}, ${actorType}, ${actorSubject})
    `;
    return { ok: true, order: await loadOrderByInternalId(id, tx) };
  });
}

export async function getOrdersAwaitingPickupReminder(minutesOld = 10) {
  return normalizeRows(await getSql()`
    select id from public.orders
    where status = 'ready' and nullif(email, '') is not null
      and pickup_reminder_sent = false
      and (payment_status in ('authorized', 'paid')
        or (payment_status = 'unpaid' and payment_method = 'cash'))
      and updated_at <= now() - (${minutesOld} * interval '1 minute')
    order by updated_at
  `);
}

export async function claimPickupReminder(id) {
  const [row] = await getSql()`
    update public.orders set pickup_reminder_sent = true
    where id = ${id} and status = 'ready' and pickup_reminder_sent = false
    returning id
  `;
  return Boolean(row);
}

export async function markPickupReminderSent(id, sent = true) {
  return getSql()`update public.orders set pickup_reminder_sent = ${Boolean(sent)} where id = ${id}`;
}

export async function getOrderHistory({ page = 1, limit = 20, status = null, startDate = null, endDate = null, search = null } = {}) {
  const sql = getSql();
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (safePage - 1) * safeLimit;
  const normalizedStatus = status && status !== 'all' ? status : null;
  const normalizedSearch = search ? `%${search}%` : null;
  const [count] = await sql`
    select count(*)::integer as total from public.orders
    where (${normalizedStatus}::text is null or status::text = ${normalizedStatus})
      and (${startDate}::date is null or created_at::date >= ${startDate}::date)
      and (${endDate}::date is null or created_at::date <= ${endDate}::date)
      and (${normalizedSearch}::text is null or customer_name ilike ${normalizedSearch}
        or pickup_number::text ilike ${normalizedSearch} or email ilike ${normalizedSearch})
  `;
  const rows = await sql`
    select * from public.orders
    where (${normalizedStatus}::text is null or status::text = ${normalizedStatus})
      and (${startDate}::date is null or created_at::date >= ${startDate}::date)
      and (${endDate}::date is null or created_at::date <= ${endDate}::date)
      and (${normalizedSearch}::text is null or customer_name ilike ${normalizedSearch}
        or pickup_number::text ilike ${normalizedSearch} or email ilike ${normalizedSearch})
    order by created_at desc limit ${safeLimit} offset ${offset}
  `;
  return {
    orders: await hydrateOrders(sql, rows),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count.total,
      totalPages: Math.ceil(count.total / safeLimit),
    },
  };
}

export async function getOrderStats(startDate = null, endDate = null) {
  const [row] = await getSql()`
    select
      count(*)::integer as total_orders,
      coalesce(sum(total) filter (where status != 'cancelled'), 0) as total_revenue,
      count(*) filter (where status = 'completed')::integer as completed_orders,
      count(*) filter (where status = 'cancelled')::integer as cancelled_orders,
      count(*) filter (where status in ('pending', 'preparing', 'ready'))::integer as active_orders
    from public.orders
    where (${startDate}::date is null or created_at::date >= ${startDate}::date)
      and (${endDate}::date is null or created_at::date <= ${endDate}::date)
  `;
  return normalizeRow(row);
}

export async function getTodayOrderCount() {
  const [row] = await getSql()`
    select count(*)::integer as count from public.orders where created_at::date = current_date
  `;
  return row.count;
}

export async function getTodayRevenue() {
  const [row] = await getSql()`
    select coalesce(sum(total), 0) as total from public.orders
    where created_at::date = current_date and status != 'cancelled'
  `;
  return Number(row.total);
}

// ============ Settings ============
export async function getSetting(key) {
  const [row] = await getSql()`select value from public.settings where key = ${key}`;
  return row?.value ?? null;
}

export async function setSetting(key, value) {
  return getSql()`
    insert into public.settings (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value
  `;
}

export async function getAllSettings() {
  const rows = await getSql()`select key, value from public.settings order by key`;
  return Object.fromEntries(rows.map(row => [row.key, row.value]));
}
