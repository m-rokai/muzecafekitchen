import { z } from 'zod';

// ============ Order Validation ============

const OrderItemModifierSchema = z.object({
  modifier_name: z.string().min(1).max(100),
  price_adjustment: z.number().default(0),
});

const OrderItemSchema = z.object({
  menu_item_id: z.number().int().positive().optional(),
  item_name: z.string().min(1).max(100),
  quantity: z.number().int().min(1).max(100),
  unit_price: z.number().min(0),
  total_price: z.number().min(0),
  special_instructions: z.string().max(500).nullable().optional(),
  modifiers: z.array(OrderItemModifierSchema).max(20).default([]),
});

const OrderCreationSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').max(100),
  email: z.string().email().max(254).nullable().optional(),
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item').max(50),
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  total: z.number().min(0),
  notes: z.string().max(500).optional(),
});

export function validateOrderCreation(data) {
  const result = OrderCreationSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true, data: result.data };
}

// ============ Category Validation ============

const CategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().max(500).optional().default(''),
  sort_order: z.number().int().min(0).default(0),
});

export function validateCategory(data) {
  const result = CategorySchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true, data: result.data };
}

// ============ Menu Item Validation ============

const MenuItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().default(''),
  price: z.number().min(0, 'Price must be non-negative'),
  category_id: z.number().int().positive().nullable().optional(),
  available: z.union([z.boolean(), z.number().int().min(0).max(1)]).default(1),
  sort_order: z.number().int().min(0).default(0),
  modifier_group_ids: z.array(z.number().int().positive()).optional(),
});

export function validateMenuItem(data) {
  const result = MenuItemSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true, data: result.data };
}

// ============ Modifier Group Validation ============

const ModifierGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  display_name: z.string().max(50).optional(),
  min_selections: z.number().int().min(0).default(0),
  max_selections: z.number().int().min(1).default(10),
  required: z.union([z.boolean(), z.number().int().min(0).max(1)]).default(0),
  sort_order: z.number().int().min(0).default(0),
});

export function validateModifierGroup(data) {
  const result = ModifierGroupSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true, data: result.data };
}

// ============ Modifier Option Validation ============

const ModifierOptionSchema = z.object({
  group_id: z.number().int().positive('Group ID is required'),
  name: z.string().min(1, 'Name is required').max(50),
  display_name: z.string().max(50).optional(),
  price_adjustment: z.number().default(0),
  available: z.union([z.boolean(), z.number().int().min(0).max(1)]).default(1),
  sort_order: z.number().int().min(0).default(0),
});

export function validateModifierOption(data) {
  const result = ModifierOptionSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true, data: result.data };
}

// ============ Settings Validation ============

const SettingValueSchema = z.object({
  value: z.string().max(500),
});

export function validateSettingValue(data) {
  const result = SettingValueSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true, data: result.data };
}

// ============ PIN Validation ============

const PinSchema = z.object({
  pin: z.string()
    .min(4, 'PIN must be at least 4 digits')
    .max(6, 'PIN cannot exceed 6 digits')
    .regex(/^\d+$/, 'PIN must contain only digits'),
});

export function validatePin(data) {
  const result = PinSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true, data: result.data };
}

// ============ Order Status Validation ============

const OrderStatusSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'completed', 'cancelled']),
});

export function validateOrderStatus(data) {
  const result = OrderStatusSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true, data: result.data };
}
