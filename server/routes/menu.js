import express from 'express';
import * as db from '../db/database.js';
import { requireCafeQuery } from '../middleware/storefront.js';

const router = express.Router();
router.use(requireCafeQuery);

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.getAllCategories('cafe', true);
    res.json(categories);
  } catch (err) {
    console.error('Error getting categories:', err);
    res.status(500).json({ message: 'Failed to load categories' });
  }
});

// Get all menu items
router.get('/items', async (req, res) => {
  try {
    const items = await db.getAllMenuItems('cafe');
    res.json(items);
  } catch (err) {
    console.error('Error getting items:', err);
    res.status(500).json({ message: 'Failed to load menu items' });
  }
});

// Get items by category
router.get('/categories/:id/items', async (req, res) => {
  try {
    const items = await db.getMenuItemsByCategory(parseInt(req.params.id), 'cafe');
    res.json(items);
  } catch (err) {
    console.error('Error getting items by category:', err);
    res.status(500).json({ message: 'Failed to load items' });
  }
});

// Get single menu item
router.get('/items/:id', async (req, res) => {
  try {
    const item = await db.getMenuItem(parseInt(req.params.id));
    if (!item || item.channel !== 'cafe') {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (err) {
    console.error('Error getting item:', err);
    res.status(500).json({ message: 'Failed to load item' });
  }
});

// Get modifiers for an item
router.get('/items/:id/modifiers', async (req, res) => {
  try {
    const item = await db.getMenuItem(parseInt(req.params.id));
    if (!item || item.channel !== 'cafe') {
      return res.status(404).json({ message: 'Item not found' });
    }
    const groups = await db.getModifiersForItem(parseInt(req.params.id));
    res.json(groups);
  } catch (err) {
    console.error('Error getting modifiers:', err);
    res.status(500).json({ message: 'Failed to load modifiers' });
  }
});

// Get all modifiers
router.get('/modifiers', async (req, res) => {
  try {
    const modifiers = await db.getAllModifierOptions();
    res.json(modifiers);
  } catch (err) {
    console.error('Error getting modifiers:', err);
    res.status(500).json({ message: 'Failed to load modifiers' });
  }
});

export default router;
