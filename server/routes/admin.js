import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import * as db from '../db/database.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { adminRateLimit } from '../middleware/rateLimit.js';
import { getSupabaseAdminClient } from '../lib/supabase.js';
import {
  validateCategory,
  validateMenuItem,
  validateSettingValue,
} from '../validators/schemas.js';
import { sanitizeText, sanitizeMenuItemName } from '../utils/sanitize.js';
import { importPartnerMenu } from '../services/partnerMenuImport.js';

const router = express.Router();
const MENU_BUCKET = 'menu-images';
const MIME_EXTENSIONS = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, callback) => {
    callback(null, Boolean(MIME_EXTENSIONS[file.mimetype]));
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function storageObjectFromUrl(url) {
  if (typeof url !== 'string') return null;
  const marker = `/storage/v1/object/public/${MENU_BUCKET}/`;
  try {
    const parsed = new URL(url);
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    const objectName = decodeURIComponent(parsed.pathname.slice(index + marker.length));
    return objectName && !objectName.includes('/') && !objectName.includes('..') ? objectName : null;
  } catch {
    return null;
  }
}

async function removeStorageObject(objectName) {
  if (!objectName || objectName.includes('/') || objectName.includes('..')) return false;
  const { error } = await getSupabaseAdminClient().storage.from(MENU_BUCKET).remove([objectName]);
  if (error) throw error;
  return true;
}

// Supabase Auth happens in the browser. This endpoint remains as a session/role check.
router.get('/verify-token', requireAuth, (req, res) => {
  res.json({ valid: true, auth: req.auth });
});

router.get('/public/settings', async (req, res) => {
  try {
    const channel = req.query.channel === 'partner_meal' ? 'partner_meal' : 'cafe';
    const settingKey = channel === 'partner_meal' ? 'partner_tax_rate' : 'tax_rate';
    const fallback = channel === 'partner_meal' ? '0.08375' : '0.0825';
    res.json({ channel, tax_rate: await db.getSetting(settingKey) || fallback });
  } catch (error) {
    console.error('Error getting public settings:', error);
    res.status(500).json({ message: 'Failed to load settings' });
  }
});

router.get('/public/announcement', async (req, res) => {
  try {
    const enabled = await db.getSetting('announcement_enabled') === 'true';
    const announcement = await db.getSetting('announcement_text') || '';
    res.json({ enabled, text: enabled ? announcement : '' });
  } catch (error) {
    console.error('Error getting announcement:', error);
    res.status(500).json({ message: 'Failed to load announcement' });
  }
});

router.get('/public/kitchen-status', async (req, res) => {
  try {
    const open = await db.getSetting('kitchen_open') !== 'false';
    const message = await db.getSetting('kitchen_closed_message') || '';
    res.json({ open, message: open ? '' : message });
  } catch (error) {
    console.error('Error getting kitchen status:', error);
    res.status(500).json({ message: 'Failed to load kitchen status' });
  }
});

router.get('/public/popular-items', async (req, res) => {
  try {
    const raw = await db.getSetting('popular_item_ids') || '';
    let values;
    try {
      const parsed = JSON.parse(raw);
      values = Array.isArray(parsed) ? parsed : String(raw).split(',');
    } catch {
      values = String(raw).split(',');
    }
    const ids = values.map(value => Number(value)).filter(Number.isSafeInteger);
    const items = await Promise.all(ids.map(id => db.getMenuItem(id)));
    res.json(items.filter(item => item?.available));
  } catch (error) {
    console.error('Error getting popular items:', error);
    res.status(500).json({ message: 'Failed to load popular items' });
  }
});

router.use(requireAuth);
router.use(adminRateLimit);
router.use(requireAdmin);

router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'A JPEG, PNG, or WebP image is required' });
    const filename = `menu-${crypto.randomUUID()}${MIME_EXTENSIONS[req.file.mimetype]}`;
    const storage = getSupabaseAdminClient().storage.from(MENU_BUCKET);
    const { error } = await storage.upload(filename, req.file.buffer, {
      cacheControl: '31536000',
      contentType: req.file.mimetype,
      upsert: false,
    });
    if (error) throw error;
    const { data } = storage.getPublicUrl(filename);
    return res.status(201).json({ url: data.publicUrl, filename });
  } catch (error) {
    console.error('Error uploading image:', error);
    return res.status(500).json({ message: 'Failed to upload image' });
  }
});

router.delete('/upload/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    if (!filename || filename.includes('/') || filename.includes('..')) {
      return res.status(400).json({ message: 'Invalid filename' });
    }
    await removeStorageObject(filename);
    return res.json({ message: 'Image deleted', filename });
  } catch (error) {
    console.error('Error deleting image:', error);
    return res.status(500).json({ message: 'Failed to delete image' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [orders, revenue] = await Promise.all([db.getTodayOrderCount(), db.getTodayRevenue()]);
    res.json({ orders, revenue });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const result = await db.getOrderHistory({
      page: Number.parseInt(req.query.page || '1', 10),
      limit: Math.min(Number.parseInt(req.query.limit || '20', 10), 100),
      status: req.query.status || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      search: req.query.search || null,
    });
    res.json(result);
  } catch (error) {
    console.error('Error getting order history:', error);
    res.status(500).json({ message: 'Failed to load order history' });
  }
});

router.get('/orders/stats', async (req, res) => {
  try {
    res.json(await db.getOrderStats(req.query.startDate || null, req.query.endDate || null));
  } catch (error) {
    console.error('Error getting order stats:', error);
    res.status(500).json({ message: 'Failed to load order stats' });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const order = await db.getOrder(Number.parseInt(req.params.id, 10));
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (error) {
    console.error('Error getting order:', error);
    return res.status(500).json({ message: 'Failed to load order' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    res.json(await db.getAllCategories());
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ message: 'Failed to load categories' });
  }
});

router.get('/categories/:id', async (req, res) => {
  try {
    const category = await db.getCategory(Number.parseInt(req.params.id, 10));
    if (!category) return res.status(404).json({ message: 'Category not found' });
    return res.json(category);
  } catch (error) {
    console.error('Error getting category:', error);
    return res.status(500).json({ message: 'Failed to load category' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const validation = validateCategory(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid category data', errors: validation.errors });
    }
    const name = sanitizeMenuItemName(validation.data.name);
    const description = sanitizeText(validation.data.description) || '';
    const sortOrder = validation.data.sort_order || 0;
    const id = await db.createCategory({ name, description, sort_order: sortOrder });
    return res.status(201).json({ id, name, description, sort_order: sortOrder });
  } catch (error) {
    console.error('Error creating category:', error);
    return res.status(500).json({ message: 'Failed to create category' });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    await db.updateCategory(id, {
      name: req.body.name,
      description: req.body.description,
      sort_order: req.body.sort_order,
    });
    res.json({ message: 'Category updated', id });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Failed to update category' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    await db.deleteCategory(id);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

router.get('/items', async (req, res) => {
  try {
    res.json(await db.getAllMenuItemsIncludingUnavailable());
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).json({ message: 'Failed to load items' });
  }
});

router.get('/items/:id', async (req, res) => {
  try {
    const item = await db.getMenuItem(Number.parseInt(req.params.id, 10));
    if (!item) return res.status(404).json({ message: 'Item not found' });
    item.modifier_groups = await db.getModifiersForItem(item.id);
    return res.json(item);
  } catch (error) {
    console.error('Error getting item:', error);
    return res.status(500).json({ message: 'Failed to load item' });
  }
});

router.post('/items', async (req, res) => {
  try {
    const validation = validateMenuItem(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid item data', errors: validation.errors });
    }
    const data = validation.data;
    const name = sanitizeMenuItemName(data.name);
    const id = await db.createMenuItem({
      ...data,
      name,
      description: sanitizeText(data.description) || '',
    });
    if (data.modifier_group_ids?.length) await db.setItemModifierGroups(id, data.modifier_group_ids);
    return res.status(201).json({ id, name, price: data.price });
  } catch (error) {
    console.error('Error creating item:', error);
    return res.status(500).json({ message: 'Failed to create item' });
  }
});

router.put('/items/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const { modifier_group_ids: groupIds, ...updates } = req.body;
    await db.updateMenuItem(id, updates);
    if (groupIds !== undefined) await db.setItemModifierGroups(id, groupIds);
    res.json({ message: 'Item updated', id });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ message: 'Failed to update item' });
  }
});

router.patch('/items/:id/availability', async (req, res) => {
  try {
    await db.updateMenuItem(Number.parseInt(req.params.id, 10), { available: Boolean(req.body.available) });
    res.json({ message: 'Availability updated' });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ message: 'Failed to update availability' });
  }
});

router.delete('/items/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const item = await db.getMenuItem(id);
    const objectName = storageObjectFromUrl(item?.image_url);
    await db.deleteMenuItem(id);
    if (objectName) await removeStorageObject(objectName);
    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Failed to delete item' });
  }
});

router.get('/modifier-groups', async (req, res) => {
  try {
    const groups = await db.getAllModifierGroups();
    await Promise.all(groups.map(async group => {
      group.options = await db.getModifierOptions(group.id, true);
    }));
    res.json(groups);
  } catch (error) {
    console.error('Error getting modifier groups:', error);
    res.status(500).json({ message: 'Failed to load modifier groups' });
  }
});

router.get('/modifier-groups/:id', async (req, res) => {
  try {
    const group = await db.getModifierGroupWithOptions(Number.parseInt(req.params.id, 10));
    if (!group) return res.status(404).json({ message: 'Modifier group not found' });
    group.items = await db.getItemsForModifierGroup(group.id);
    return res.json(group);
  } catch (error) {
    console.error('Error getting modifier group:', error);
    return res.status(500).json({ message: 'Failed to load modifier group' });
  }
});

router.post('/modifier-groups', async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ message: 'Name is required' });
    const id = await db.createModifierGroup(req.body);
    return res.status(201).json({ id, name: req.body.name, display_name: req.body.display_name || req.body.name });
  } catch (error) {
    console.error('Error creating modifier group:', error);
    return res.status(500).json({ message: 'Failed to create modifier group' });
  }
});

router.put('/modifier-groups/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    await db.updateModifierGroup(id, req.body);
    res.json({ message: 'Modifier group updated', id });
  } catch (error) {
    console.error('Error updating modifier group:', error);
    res.status(500).json({ message: 'Failed to update modifier group' });
  }
});

router.delete('/modifier-groups/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    await db.deleteModifierGroup(id);
    res.json({ message: 'Modifier group deleted' });
  } catch (error) {
    console.error('Error deleting modifier group:', error);
    res.status(500).json({ message: 'Failed to delete modifier group' });
  }
});

router.get('/modifier-options', async (req, res) => {
  try {
    res.json(await db.getAllModifierOptions(true));
  } catch (error) {
    console.error('Error getting modifier options:', error);
    res.status(500).json({ message: 'Failed to load modifier options' });
  }
});

router.post('/modifier-options', async (req, res) => {
  try {
    if (!req.body.group_id || !req.body.name) {
      return res.status(400).json({ message: 'Group ID and name are required' });
    }
    const id = await db.createModifierOption(req.body);
    return res.status(201).json({ id, name: req.body.name, price_adjustment: req.body.price_adjustment || 0 });
  } catch (error) {
    console.error('Error creating modifier option:', error);
    return res.status(500).json({ message: 'Failed to create modifier option' });
  }
});

router.put('/modifier-options/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    await db.updateModifierOption(id, req.body);
    res.json({ message: 'Modifier option updated', id });
  } catch (error) {
    console.error('Error updating modifier option:', error);
    res.status(500).json({ message: 'Failed to update modifier option' });
  }
});

router.delete('/modifier-options/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    await db.deleteModifierOption(id);
    res.json({ message: 'Modifier option deleted' });
  } catch (error) {
    console.error('Error deleting modifier option:', error);
    res.status(500).json({ message: 'Failed to delete modifier option' });
  }
});

router.put('/items/:id/modifier-groups', async (req, res) => {
  try {
    if (!Array.isArray(req.body.group_ids)) {
      return res.status(400).json({ message: 'group_ids must be an array' });
    }
    const itemId = Number.parseInt(req.params.id, 10);
    await db.setItemModifierGroups(itemId, req.body.group_ids);
    return res.json({ message: 'Modifier groups updated for item', itemId });
  } catch (error) {
    console.error('Error linking modifier groups:', error);
    return res.status(500).json({ message: 'Failed to update modifier groups' });
  }
});

router.delete('/clear-menu', async (req, res) => {
  try {
    await db.clearItemModifierLinks();
    await db.deleteAllModifierOptions();
    await db.deleteAllModifierGroups();
    await db.deleteAllMenuItems();
    res.json({ message: 'Menu cleared successfully' });
  } catch (error) {
    console.error('Error clearing menu:', error);
    res.status(500).json({ message: 'Failed to clear menu' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    res.json(await db.getAllSettings());
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ message: 'Failed to load settings' });
  }
});

router.patch('/settings/:key', async (req, res) => {
  try {
    const validation = validateSettingValue(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid setting value', errors: validation.errors });
    }
    const value = sanitizeText(validation.data.value, 500);
    await db.setSetting(req.params.key, value);
    return res.json({ message: 'Setting updated', key: req.params.key, value });
  } catch (error) {
    console.error('Error updating setting:', error);
    return res.status(500).json({ message: 'Failed to update setting' });
  }
});

router.get('/backup/info', (req, res) => {
  res.json({
    provider: 'supabase',
    managed: true,
    message: 'Backups and point-in-time recovery are managed in the Supabase dashboard.',
  });
});

router.get('/backups', (req, res) => res.json({ backups: [], managed: true, provider: 'supabase' }));

const managedBackupResponse = (req, res) => res.status(409).json({
  message: 'Database backups are managed by Supabase and cannot be changed from this application.',
  code: 'MANAGED_BACKUPS',
});

router.post('/backup', managedBackupResponse);
router.post('/backup/:filename/restore', managedBackupResponse);
router.delete('/backup/:filename', managedBackupResponse);
router.delete('/backups/cleanup', managedBackupResponse);

router.get('/partner-menu/imports', async (req, res) => {
  try {
    return res.json(await db.listPartnerMenuImports(req.query.limit));
  } catch (error) {
    console.error('Failed to load partner menu imports:', error);
    return res.status(500).json({ message: 'Failed to load partner menu imports' });
  }
});

router.get('/partner-menu/imports/:id/candidates', async (req, res) => {
  try {
    return res.json(await db.getPartnerMenuImportCandidates(req.params.id));
  } catch (error) {
    console.error('Failed to load partner menu candidates:', error);
    return res.status(500).json({ message: 'Failed to load partner menu candidates' });
  }
});

router.post('/partner-menu/imports/refresh', async (req, res) => {
  try {
    return res.status(202).json(await importPartnerMenu());
  } catch (error) {
    console.error('Manual partner menu import failed:', error);
    return res.status(500).json({ message: 'Partner menu import failed' });
  }
});

router.post('/partner-menu/imports/:id/publish', async (req, res) => {
  try {
    const result = await db.publishPartnerMenuImport(req.params.id);
    if (!result.ok) {
      return res.status(result.code === 'not_found' ? 404 : 409).json({
        message: result.message,
        code: result.code,
      });
    }
    return res.json(result);
  } catch (error) {
    console.error('Failed to publish partner menu import:', error);
    return res.status(500).json({ message: 'Failed to publish partner menu import' });
  }
});

export default router;
