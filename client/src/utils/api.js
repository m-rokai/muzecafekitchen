// In production, use relative URL since client is served from same origin
// In development, use localhost:3001
const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

// ============ Auth Token Management ============
const AUTH_TOKEN_KEY = 'muze_auth_token';
const DEV_CUSTOMER_SUBJECT_KEY = 'muze_dev_customer_subject';

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getAuthToken();
}

function getCustomerAuthHeaders() {
  if (import.meta.env.VITE_CUSTOMER_AUTH_MODE !== 'dev-header') return {};
  let subject = localStorage.getItem(DEV_CUSTOMER_SUBJECT_KEY);
  if (!subject) {
    subject = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEV_CUSTOMER_SUBJECT_KEY, subject);
  }
  return { 'X-Dev-Customer-Subject': subject };
}

// ============ Request Helpers ============

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  // Build config more explicitly to avoid issues
  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Handle body - stringify if it's an object
  if (options.body) {
    if (options.body instanceof FormData) {
      config.body = options.body;
      delete config.headers['Content-Type'];
    } else if (typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    } else {
      config.body = options.body;
    }
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    console.error('Network error:', networkError);
    throw new Error('Network error - please check your connection');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (parseError) {
    console.error('JSON parse error:', parseError, 'Response text:', text.substring(0, 200));
    throw new Error('Invalid response from server');
  }
}

// Authenticated request - adds Bearer token header
async function authRequest(endpoint, options = {}) {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Authentication required');
  }

  const authOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  };

  try {
    return await request(endpoint, authOptions);
  } catch (error) {
    // If token is invalid/expired, clear it and throw specific error
    if (error.message === 'Invalid or expired token' || error.message === 'Authentication required') {
      clearAuthToken();
      throw new Error('Session expired. Please log in again.');
    }
    throw error;
  }
}

// ============ Menu endpoints (public) ============
export const menuAPI = {
  getCategories: () => request('/menu/categories'),
  getItems: () => request('/menu/items'),
  getItemsByCategory: (categoryId) => request(`/menu/categories/${categoryId}/items`),
  getItem: (id) => request(`/menu/items/${id}`),
  getModifiers: (itemId) => request(`/menu/items/${itemId}/modifiers`),
  getAllModifiers: () => request('/menu/modifiers'),
};

// ============ Order endpoints ============
export const orderAPI = {
  // Customer routes require an upstream-verified subject in production. The
  // dev header is sent only when explicitly enabled in Vite env.
  create: (orderData, idempotencyKey) => request('/orders', {
    method: 'POST',
    headers: {
      ...getCustomerAuthHeaders(),
      'Idempotency-Key': idempotencyKey,
    },
    body: orderData,
  }),
  get: (id) => request(`/orders/${id}`, {
    headers: getCustomerAuthHeaders(),
  }),

  // Public - customer cancels their own order (server gates to pending status)
  cancel: (id, reason) => request(`/orders/${id}/cancel`, {
    method: 'PATCH',
    headers: getCustomerAuthHeaders(),
    body: { reason: reason || null },
  }),

  // Protected - kitchen staff only
  getActive: () => authRequest('/orders/active'),
  updateStatus: (id, status, reason) => authRequest(`/orders/${id}/status`, {
    method: 'PATCH',
    body: reason ? { status, reason } : { status },
  }),

  // Kitchen open/closed (kitchen staff)
  getKitchenStatus: () => authRequest('/orders/kitchen-status'),
  setKitchenStatus: (open, message) => authRequest('/orders/kitchen-status', {
    method: 'PATCH',
    body: { open, message },
  }),
};

// ============ Settings endpoints (public read, protected write) ============
export const settingsAPI = {
  // Public endpoint for checkout
  getTaxRate: () => request('/admin/public/settings')
    .then(s => parseFloat(s?.tax_rate || '0.0825'))
    .catch(() => 0.0825), // Fallback on error

  // Public announcement
  getAnnouncement: () => request('/admin/public/announcement')
    .catch(() => ({ enabled: false, text: '' })),

  // Public kitchen open/closed status — fail open so customers can still order if API hiccups
  getKitchenStatus: () => request('/admin/public/kitchen-status')
    .catch(() => ({ open: true, message: '' })),

  // Public "Most Popular" rail (curated list, server-resolved to full items)
  getPopularItems: () => request('/admin/public/popular-items')
    .catch(() => []),
};

// ============ Admin endpoints (all protected except verifyPin) ============
export const adminAPI = {
  // Authentication
  verifyPin: async (pin) => {
    const result = await request('/admin/verify-pin', {
      method: 'POST',
      body: { pin },
    });

    // Store token on successful authentication
    if (result.success && result.token) {
      setAuthToken(result.token);
    }

    return result;
  },

  // Verify current token is still valid
  verifyToken: () => authRequest('/admin/verify-token'),

  // Logout - clear token
  logout: () => {
    clearAuthToken();
    return Promise.resolve({ success: true });
  },

  // Stats
  getStats: () => authRequest('/admin/stats'),

  // Settings
  getSettings: () => authRequest('/admin/settings'),
  updateSetting: (key, value) => authRequest(`/admin/settings/${key}`, {
    method: 'PATCH',
    body: { value },
  }),

  // Categories
  getCategories: () => authRequest('/admin/categories'),
  getCategory: (id) => authRequest(`/admin/categories/${id}`),
  createCategory: (data) => authRequest('/admin/categories', {
    method: 'POST',
    body: data,
  }),
  updateCategory: (id, data) => authRequest(`/admin/categories/${id}`, {
    method: 'PUT',
    body: data,
  }),
  deleteCategory: (id) => authRequest(`/admin/categories/${id}`, {
    method: 'DELETE',
  }),

  // Menu Items
  getItems: () => authRequest('/admin/items'),
  getItem: (id) => authRequest(`/admin/items/${id}`),
  createItem: (data) => authRequest('/admin/items', {
    method: 'POST',
    body: data,
  }),
  updateItem: (id, data) => authRequest(`/admin/items/${id}`, {
    method: 'PUT',
    body: data,
  }),
  deleteItem: (id) => authRequest(`/admin/items/${id}`, {
    method: 'DELETE',
  }),
  toggleItemAvailability: (id, available) => authRequest(`/admin/items/${id}/availability`, {
    method: 'PATCH',
    body: { available },
  }),

  // Modifier Groups
  getModifierGroups: () => authRequest('/admin/modifier-groups'),
  getModifierGroup: (id) => authRequest(`/admin/modifier-groups/${id}`),
  createModifierGroup: (data) => authRequest('/admin/modifier-groups', {
    method: 'POST',
    body: data,
  }),
  updateModifierGroup: (id, data) => authRequest(`/admin/modifier-groups/${id}`, {
    method: 'PUT',
    body: data,
  }),
  deleteModifierGroup: (id) => authRequest(`/admin/modifier-groups/${id}`, {
    method: 'DELETE',
  }),

  // Modifier Options
  getModifierOptions: () => authRequest('/admin/modifier-options'),
  createModifierOption: (data) => authRequest('/admin/modifier-options', {
    method: 'POST',
    body: data,
  }),
  updateModifierOption: (id, data) => authRequest(`/admin/modifier-options/${id}`, {
    method: 'PUT',
    body: data,
  }),
  deleteModifierOption: (id) => authRequest(`/admin/modifier-options/${id}`, {
    method: 'DELETE',
  }),

  // Item-Modifier Group linking
  setItemModifierGroups: (itemId, groupIds) => authRequest(`/admin/items/${itemId}/modifier-groups`, {
    method: 'PUT',
    body: { group_ids: groupIds },
  }),

  // Image Upload
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return authRequest('/admin/upload', {
      method: 'POST',
      body: formData,
    });
  },
  deleteImage: (filename) => authRequest(`/admin/upload/${filename}`, {
    method: 'DELETE',
  }),

  // Backup Management
  getBackupInfo: () => authRequest('/admin/backup/info'),
  getBackups: () => authRequest('/admin/backups'),
  createBackup: () => authRequest('/admin/backup', { method: 'POST' }),
  restoreBackup: (filename) => authRequest(`/admin/backup/${filename}/restore`, { method: 'POST' }),
  deleteBackup: (filename) => authRequest(`/admin/backup/${filename}`, { method: 'DELETE' }),
  cleanupBackups: (days = 7) => authRequest(`/admin/backups/cleanup?days=${days}`, { method: 'DELETE' }),

  // Order History
  getOrders: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.status) searchParams.set('status', params.status);
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return authRequest(`/admin/orders${query ? `?${query}` : ''}`);
  },
  getOrderStats: (startDate, endDate) => {
    const searchParams = new URLSearchParams();
    if (startDate) searchParams.set('startDate', startDate);
    if (endDate) searchParams.set('endDate', endDate);
    const query = searchParams.toString();
    return authRequest(`/admin/orders/stats${query ? `?${query}` : ''}`);
  },
  getOrder: (id) => authRequest(`/admin/orders/${id}`),
};

export default { menuAPI, orderAPI, adminAPI, settingsAPI };
