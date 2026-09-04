import express from 'express';
import * as db from '../db/database.js';

const router = express.Router();
const CHANNELS = new Set(['cafe', 'partner_meal']);

function requestedChannel(req, res) {
  const channel = req.query.channel || 'cafe';
  if (!CHANNELS.has(channel)) {
    res.status(400).json({ message: 'Invalid storefront channel' });
    return null;
  }
  return channel;
}

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const channel = requestedChannel(req, res);
    if (!channel) return;
    const categories = await db.getAllCategories(channel);
    res.json(categories);
  } catch (err) {
    console.error('Error getting categories:', err);
    res.status(500).json({ message: 'Failed to load categories' });
  }
});

// Get all menu items
router.get('/items', async (req, res) => {
  try {
    const channel = requestedChannel(req, res);
    if (!channel) return;
    const items = await db.getAllMenuItems(channel);
    res.json(items);
  } catch (err) {
    console.error('Error getting items:', err);
    res.status(500).json({ message: 'Failed to load menu items' });
  }
});

// Get items by category
router.get('/categories/:id/items', async (req, res) => {
  try {
    const channel = requestedChannel(req, res);
    if (!channel) return;
    const items = await db.getMenuItemsByCategory(parseInt(req.params.id), channel);
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
    if (!item) {
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
