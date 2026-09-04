import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from '../db/database.js';
import { closeDatabase } from '../db/postgres.js';
import { categories, menuItems, modifierGroups, modifierOptions } from '../db/seed.js';
import { getSupabaseAdminClient } from '../lib/supabase.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = path.resolve(scriptDirectory, '../uploads');

function imageFilename(name) {
  const slug = name.toLowerCase()
    .replace(/["']/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `menu-${slug}.webp`;
}

async function uploadImage(name) {
  const filename = imageFilename(name);
  const data = await fs.readFile(path.join(uploadsDirectory, filename));
  const storage = getSupabaseAdminClient().storage.from('menu-images');
  const { error } = await storage.upload(filename, data, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) throw error;
  return storage.getPublicUrl(filename).data.publicUrl;
}

async function seed() {
  if ((await db.getAllCategories()).length > 0) {
    throw new Error('Seed refused because categories already exist. Reset the target database first.');
  }

  const categoryIds = new Map();
  for (const category of categories) {
    const id = await db.createCategory(category);
    categoryIds.set(category.id, id);
  }

  const itemIds = new Map();
  for (const [sortOrder, item] of menuItems.entries()) {
    const id = await db.createMenuItem({
      ...item,
      category_id: categoryIds.get(item.category_id),
      image_url: await uploadImage(item.name),
      sort_order: sortOrder,
    });
    itemIds.set(item.name, id);
  }

  const groupIds = new Map();
  for (const group of modifierGroups) {
    const id = await db.createModifierGroup(group);
    groupIds.set(group.id, id);
  }
  for (const [sortOrder, option] of modifierOptions.entries()) {
    await db.createModifierOption({
      ...option,
      group_id: groupIds.get(option.group_id),
      price_adjustment: option.price,
      sort_order: sortOrder,
    });
  }

  for (const item of menuItems) {
    const groups = modifierGroups.filter(group => (
      group.category_ids?.includes(item.category_id) || group.item_names?.includes(item.name)
    ));
    await db.setItemModifierGroups(itemIds.get(item.name), groups.map(group => groupIds.get(group.id)));
  }
  console.log(`Seeded ${categories.length} categories and ${menuItems.length} menu items.`);
}

try {
  await seed();
} finally {
  await closeDatabase();
}
