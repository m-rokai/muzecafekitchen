import express from 'express';
import * as db from '../db/database.js';
import { generateToken, requireAuth } from '../middleware/auth.js';
import { pinRateLimit, adminRateLimit } from '../middleware/rateLimit.js';
import {
  validateCategory,
  validateMenuItem,
  validateModifierGroup,
  validateModifierOption,
  validateSettingValue,
  validatePin,
} from '../validators/schemas.js';
import { sanitizeName, sanitizeText, sanitizeMenuItemName } from '../utils/sanitize.js';
import { createBackup, listBackups, restoreBackup, deleteBackup, deleteOldBackups, getBackupInfo } from '../services/backup.js';

const router = express.Router();

// ============ PIN Authentication ============
// This is the only unprotected route - returns JWT on success
// Rate limited to prevent brute force attacks
router.post('/verify-pin', pinRateLimit, (req, res) => {
  try {
    // Validate PIN format
    const validation = validatePin(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, message: 'Invalid PIN format' });
    }

    const { pin } = validation.data;
    const storedPin = db.getSetting('admin_pin') || '7890';

    if (pin === storedPin) {
      // Generate JWT token on successful authentication
      const token = generateToken({ role: 'admin' });
      res.json({
        success: true,
        token,
        expiresIn: '8h'
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid PIN' });
    }
  } catch (err) {
    console.error('Error verifying PIN:', err);
    res.status(500).json({ message: 'Failed to verify PIN' });
  }
});

// Verify token is still valid (for client-side auth check on page load)
router.get('/verify-token', requireAuth, (req, res) => {
  res.json({ valid: true, auth: req.auth });
});

// Public settings endpoint (only tax rate, for checkout)
router.get('/public/settings', (req, res) => {
  try {
    const taxRate = db.getSetting('tax_rate') || '0.0825';
    res.json({ tax_rate: taxRate });
  } catch (err) {
    console.error('Error getting public settings:', err);
    res.status(500).json({ message: 'Failed to load settings' });
  }
});

// Public announcement endpoint
router.get('/public/announcement', (req, res) => {
  try {
    const enabled = db.getSetting('announcement_enabled') === 'true';
    const text = db.getSetting('announcement_text') || '';
    res.json({
      enabled,
      text: enabled ? text : '',
    });
  } catch (err) {
    console.error('Error getting announcement:', err);
    res.status(500).json({ message: 'Failed to load announcement' });
  }
});

// ============ All routes below require authentication ============
router.use(requireAuth);
router.use(adminRateLimit);

// Get admin stats
router.get('/stats', (req, res) => {
  try {
    const orders = db.getTodayOrderCount();
    const revenue = db.getTodayRevenue();

    res.json({
      orders,
      revenue,
    });
  } catch (err) {
    console.error('Error getting stats:', err);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

// ============ Categories CRUD ============
router.get('/categories', (req, res) => {
  try {
    const categories = db.getAllCategories();
    res.json(categories);
  } catch (err) {
    console.error('Error getting categories:', err);
    res.status(500).json({ message: 'Failed to load categories' });
  }
});

router.get('/categories/:id', (req, res) => {
  try {
    const category = db.getCategory(parseInt(req.params.id));
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (err) {
    console.error('Error getting category:', err);
    res.status(500).json({ message: 'Failed to load category' });
  }
});

router.post('/categories', (req, res) => {
  try {
    // Validate input
    const validation = validateCategory(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid category data', errors: validation.errors });
    }

    const { name, description, sort_order } = validation.data;
    const sanitizedName = sanitizeMenuItemName(name);
    const sanitizedDesc = sanitizeText(description);

    const id = db.createCategory({
      name: sanitizedName,
      description: sanitizedDesc || '',
      sort_order: sort_order || 0,
    });
    res.status(201).json({ id, name: sanitizedName, description: sanitizedDesc || '', sort_order: sort_order || 0 });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ message: 'Failed to create category' });
  }
});

router.put('/categories/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, sort_order } = req.body;
    db.updateCategory(id, { name, description, sort_order });
    res.json({ message: 'Category updated', id });
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ message: 'Failed to update category' });
  }
});

router.delete('/categories/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.deleteCategory(id);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

// ============ Menu Items CRUD ============
router.get('/items', (req, res) => {
  try {
    const items = db.getAllMenuItemsIncludingUnavailable();
    res.json(items);
  } catch (err) {
    console.error('Error getting items:', err);
    res.status(500).json({ message: 'Failed to load items' });
  }
});

router.get('/items/:id', (req, res) => {
  try {
    const item = db.getMenuItem(parseInt(req.params.id));
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    // Include modifier groups linked to this item
    item.modifier_groups = db.getModifiersForItem(item.id);
    res.json(item);
  } catch (err) {
    console.error('Error getting item:', err);
    res.status(500).json({ message: 'Failed to load item' });
  }
});

router.post('/items', (req, res) => {
  try {
    // Validate input
    const validation = validateMenuItem(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid item data', errors: validation.errors });
    }

    const { name, description, price, category_id, available, sort_order, modifier_group_ids } = validation.data;
    const sanitizedName = sanitizeMenuItemName(name);
    const sanitizedDesc = sanitizeText(description);

    const id = db.createMenuItem({
      name: sanitizedName,
      description: sanitizedDesc || '',
      price,
      category_id: category_id || null,
      available: available !== undefined ? (available ? 1 : 0) : 1,
      sort_order: sort_order || 0,
    });
    // Link modifier groups if provided
    if (modifier_group_ids && modifier_group_ids.length > 0) {
      db.setItemModifierGroups(id, modifier_group_ids);
    }
    res.status(201).json({ id, name: sanitizedName, price });
  } catch (err) {
    console.error('Error creating item:', err);
    res.status(500).json({ message: 'Failed to create item' });
  }
});

router.put('/items/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, price, category_id, available, sort_order, modifier_group_ids } = req.body;
    db.updateMenuItem(id, { name, description, price, category_id, available, sort_order });
    // Update modifier group links if provided
    if (modifier_group_ids !== undefined) {
      db.setItemModifierGroups(id, modifier_group_ids);
    }
    res.json({ message: 'Item updated', id });
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ message: 'Failed to update item' });
  }
});

router.patch('/items/:id/availability', (req, res) => {
  try {
    const { available } = req.body;
    const itemId = parseInt(req.params.id);
    db.updateMenuItem(itemId, { available: available ? 1 : 0 });
    res.json({ message: 'Availability updated' });
  } catch (err) {
    console.error('Error updating availability:', err);
    res.status(500).json({ message: 'Failed to update availability' });
  }
});

router.delete('/items/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.deleteMenuItem(id);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ message: 'Failed to delete item' });
  }
});

// ============ Modifier Groups CRUD ============
router.get('/modifier-groups', (req, res) => {
  try {
    const groups = db.getAllModifierGroups();
    // Include options for each group
    for (const group of groups) {
      group.options = db.getModifierOptions(group.id);
    }
    res.json(groups);
  } catch (err) {
    console.error('Error getting modifier groups:', err);
    res.status(500).json({ message: 'Failed to load modifier groups' });
  }
});

router.get('/modifier-groups/:id', (req, res) => {
  try {
    const group = db.getModifierGroupWithOptions(parseInt(req.params.id));
    if (!group) {
      return res.status(404).json({ message: 'Modifier group not found' });
    }
    // Include items linked to this group
    group.items = db.getItemsForModifierGroup(group.id);
    res.json(group);
  } catch (err) {
    console.error('Error getting modifier group:', err);
    res.status(500).json({ message: 'Failed to load modifier group' });
  }
});

router.post('/modifier-groups', (req, res) => {
  try {
    const { name, display_name, min_selections, max_selections, required, sort_order } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const id = db.createModifierGroup({
      name,
      display_name: display_name || name,
      min_selections: min_selections || 0,
      max_selections: max_selections || 10,
      required: required || 0,
      sort_order: sort_order || 0,
    });
    res.status(201).json({ id, name, display_name: display_name || name });
  } catch (err) {
    console.error('Error creating modifier group:', err);
    res.status(500).json({ message: 'Failed to create modifier group' });
  }
});

router.put('/modifier-groups/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, display_name, min_selections, max_selections, required, sort_order } = req.body;
    db.updateModifierGroup(id, { name, display_name, min_selections, max_selections, required, sort_order });
    res.json({ message: 'Modifier group updated', id });
  } catch (err) {
    console.error('Error updating modifier group:', err);
    res.status(500).json({ message: 'Failed to update modifier group' });
  }
});

router.delete('/modifier-groups/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.deleteModifierGroup(id);
    res.json({ message: 'Modifier group deleted' });
  } catch (err) {
    console.error('Error deleting modifier group:', err);
    res.status(500).json({ message: 'Failed to delete modifier group' });
  }
});

// ============ Modifier Options CRUD ============
router.get('/modifier-options', (req, res) => {
  try {
    const options = db.getAllModifierOptions();
    res.json(options);
  } catch (err) {
    console.error('Error getting modifier options:', err);
    res.status(500).json({ message: 'Failed to load modifier options' });
  }
});

router.post('/modifier-options', (req, res) => {
  try {
    const { group_id, name, display_name, price_adjustment, available, sort_order } = req.body;
    if (!group_id || !name) {
      return res.status(400).json({ message: 'Group ID and name are required' });
    }
    const id = db.createModifierOption({
      group_id,
      name,
      display_name: display_name || name,
      price_adjustment: price_adjustment || 0,
      available: available !== undefined ? available : 1,
      sort_order: sort_order || 0,
    });
    res.status(201).json({ id, name, price_adjustment: price_adjustment || 0 });
  } catch (err) {
    console.error('Error creating modifier option:', err);
    res.status(500).json({ message: 'Failed to create modifier option' });
  }
});

router.put('/modifier-options/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, display_name, price_adjustment, available, sort_order, group_id } = req.body;
    db.updateModifierOption(id, { name, display_name, price_adjustment, available, sort_order, group_id });
    res.json({ message: 'Modifier option updated', id });
  } catch (err) {
    console.error('Error updating modifier option:', err);
    res.status(500).json({ message: 'Failed to update modifier option' });
  }
});

router.delete('/modifier-options/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.deleteModifierOption(id);
    res.json({ message: 'Modifier option deleted' });
  } catch (err) {
    console.error('Error deleting modifier option:', err);
    res.status(500).json({ message: 'Failed to delete modifier option' });
  }
});

// ============ Item-Modifier Group Linking ============
router.put('/items/:id/modifier-groups', (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { group_ids } = req.body;
    if (!Array.isArray(group_ids)) {
      return res.status(400).json({ message: 'group_ids must be an array' });
    }
    db.setItemModifierGroups(itemId, group_ids);
    res.json({ message: 'Modifier groups updated for item', itemId });
  } catch (err) {
    console.error('Error linking modifier groups:', err);
    res.status(500).json({ message: 'Failed to update modifier groups' });
  }
});

// Clear all menu items and modifiers
router.delete('/clear-menu', (req, res) => {
  try {
    // Clear in order to avoid foreign key issues
    db.clearItemModifierLinks();
    db.deleteAllModifierOptions();
    db.deleteAllModifierGroups();
    db.deleteAllMenuItems();

    res.json({ message: 'Menu cleared successfully' });
  } catch (err) {
    console.error('Error clearing menu:', err);
    res.status(500).json({ message: 'Failed to clear menu' });
  }
});

// Get all settings
router.get('/settings', (req, res) => {
  try {
    const settings = db.getAllSettings();
    res.json(settings);
  } catch (err) {
    console.error('Error getting settings:', err);
    res.status(500).json({ message: 'Failed to load settings' });
  }
});

// Update a setting
router.patch('/settings/:key', (req, res) => {
  try {
    const { key } = req.params;

    // Validate setting value
    const validation = validateSettingValue(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid setting value', errors: validation.errors });
    }

    const { value } = validation.data;
    const sanitizedValue = sanitizeText(value, 500);

    db.setSetting(key, sanitizedValue);
    res.json({ message: 'Setting updated', key, value: sanitizedValue });
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ message: 'Failed to update setting' });
  }
});

// ============ Database Backup Management ============

// Get backup info
router.get('/backup/info', (req, res) => {
  try {
    const info = getBackupInfo();
    res.json(info);
  } catch (err) {
    console.error('Error getting backup info:', err);
    res.status(500).json({ message: 'Failed to get backup info' });
  }
});

// List all backups
router.get('/backups', (req, res) => {
  try {
    const backups = listBackups();
    res.json({ backups });
  } catch (err) {
    console.error('Error listing backups:', err);
    res.status(500).json({ message: 'Failed to list backups' });
  }
});

// Create a new backup
router.post('/backup', (req, res) => {
  try {
    const result = createBackup();
    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating backup:', err);
    res.status(500).json({ message: 'Failed to create backup' });
  }
});

// Restore from a backup
router.post('/backup/:filename/restore', (req, res) => {
  try {
    const { filename } = req.params;
    const result = restoreBackup(filename);
    res.json(result);
  } catch (err) {
    console.error('Error restoring backup:', err);
    // Return 404 for not found errors
    if (err.message === 'Backup file not found') {
      return res.status(404).json({ message: 'Backup not found' });
    }
    res.status(500).json({ message: err.message || 'Failed to restore backup' });
  }
});

// Delete a specific backup
router.delete('/backup/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const result = deleteBackup(filename);
    res.json(result);
  } catch (err) {
    console.error('Error deleting backup:', err);
    // Return 404 for not found errors
    if (err.message === 'Backup file not found') {
      return res.status(404).json({ message: 'Backup not found' });
    }
    res.status(500).json({ message: err.message || 'Failed to delete backup' });
  }
});

// Clean up old backups (older than 7 days)
router.delete('/backups/cleanup', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const result = deleteOldBackups(days);
    res.json(result);
  } catch (err) {
    console.error('Error cleaning up backups:', err);
    res.status(500).json({ message: 'Failed to clean up backups' });
  }
});

export default router;
