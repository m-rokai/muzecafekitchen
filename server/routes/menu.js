import express from 'express';
import * as db from '../db/database.js';

const router = express.Router();

// Get all categories
router.get('/categories', (req, res) => {
  try {
    const categories = db.getAllCategories();
    res.json(categories);
  } catch (err) {
    console.error('Error getting categories:', err);
    res.status(500).json({ message: 'Failed to load categories' });
  }
});

// Get all menu items
router.get('/items', (req, res) => {
  try {
    const items = db.getAllMenuItems();
    res.json(items);
  } catch (err) {
    console.error('Error getting items:', err);
    res.status(500).json({ message: 'Failed to load menu items' });
  }
});

// Get items by category
router.get('/categories/:id/items', (req, res) => {
  try {
    const items = db.getMenuItemsByCategory(parseInt(req.params.id));
    res.json(items);
  } catch (err) {
    console.error('Error getting items by category:', err);
    res.status(500).json({ message: 'Failed to load items' });
  }
});

// Get single menu item
router.get('/items/:id', (req, res) => {
  try {
    const item = db.getMenuItem(parseInt(req.params.id));
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
router.get('/items/:id/modifiers', (req, res) => {
  try {
    const groups = db.getModifiersForItem(parseInt(req.params.id));

    // Fetch options for each group
    const groupsWithOptions = groups.map(group => {
      const options = db.getModifierOptions(group.id);
      return {
        ...group,
        options,
      };
    });

    res.json(groupsWithOptions);
  } catch (err) {
    console.error('Error getting modifiers:', err);
    res.status(500).json({ message: 'Failed to load modifiers' });
  }
});

// Get all modifiers
router.get('/modifiers', (req, res) => {
  try {
    const modifiers = db.getAllModifierOptions();
    res.json(modifiers);
  } catch (err) {
    console.error('Error getting modifiers:', err);
    res.status(500).json({ message: 'Failed to load modifiers' });
  }
});

export default router;
