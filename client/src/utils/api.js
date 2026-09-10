import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

async function session() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

async function requireSession() {
  const current = await session();
  if (!current?.access_token) throw new Error('Authentication required');
  return current;
}

async function ensureCustomerSession() {
  const current = await session();
  if (current?.access_token) return current;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message || 'Unable to start a customer session');
  return data.session;
}

export async function getAuthToken() {
  return (await session())?.access_token || null;
}

export async function isAuthenticated() {
  return Boolean(await getAuthToken());
}

async function request(endpoint, options = {}) {
  const config = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  };
  if (options.body instanceof FormData) {
    config.body = options.body;
    delete config.headers['Content-Type'];
  } else if (options.body !== undefined) {
    config.body = typeof options.body === 'object'
      ? JSON.stringify(options.body)
      : options.body;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, config);
  } catch {
    throw new Error('Network error - please check your connection');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: 'Request failed' }));
    const error = new Error(payload.message || 'Request failed');
    error.status = response.status;
    error.code = payload.code;
    error.details = payload.errors;
    throw error;
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function withBearer(endpoint, options, authSession) {
  return request(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${authSession.access_token}`,
    },
  });
}

async function authRequest(endpoint, options = {}) {
  try {
    return await withBearer(endpoint, options, await requireSession());
  } catch (error) {
    if (error.status === 401) {
      await supabase.auth.signOut({ scope: 'local' });
      throw new Error('Session expired. Please sign in again.');
    }
    throw error;
  }
}

async function customerRequest(endpoint, options = {}) {
  return withBearer(endpoint, options, await ensureCustomerSession());
}

export const menuAPI = {
  getCategories: () => request('/menu/categories'),
  getItems: () => request('/menu/items'),
  getItemsByCategory: categoryId => request(`/menu/categories/${categoryId}/items`),
  getItem: id => request(`/menu/items/${id}`),
  getModifiers: itemId => request(`/menu/items/${itemId}/modifiers`),
  getAllModifiers: () => request('/menu/modifiers'),
};

export const orderAPI = {
  create: (orderData, idempotencyKey, paymentAttemptKey) => customerRequest('/orders', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
      ...(paymentAttemptKey ? { 'Payment-Attempt-Key': paymentAttemptKey } : {}),
    },
    body: orderData,
  }),
  get: id => customerRequest(`/orders/${id}`),
  cancel: (id, reason) => customerRequest(`/orders/${id}/cancel`, {
    method: 'PATCH',
    body: { reason: reason || null },
  }),
  getActive: () => authRequest('/orders/active'),
  updateStatus: (id, status, reason) => authRequest(`/orders/${id}/status`, {
    method: 'PATCH',
    body: reason ? { status, reason } : { status },
  }),
  getKitchenStatus: () => authRequest('/orders/kitchen-status'),
  setKitchenStatus: (open, message) => authRequest('/orders/kitchen-status', {
    method: 'PATCH',
    body: { open, message },
  }),
};

export const settingsAPI = {
  getTaxRate: () => request('/admin/public/settings')
    .then(value => Number.parseFloat(value?.tax_rate || '0.0825'))
    .catch(() => 0.0825),
  getAnnouncement: () => request('/admin/public/announcement')
    .catch(() => ({ enabled: false, text: '' })),
  getKitchenStatus: () => request('/admin/public/kitchen-status')
    .catch(() => ({ open: true, message: '' })),
  getPopularItems: () => request('/admin/public/popular-items').catch(() => []),
};

export const adminAPI = {
  sendSignInLink: async (email, destination = '/admin') => {
    const address = email.trim().toLowerCase();
    const redirect = new URL('/auth/callback', window.location.origin);
    redirect.searchParams.set('next', destination === '/kitchen' ? '/kitchen' : '/admin');
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        // Account creation convenience only; the database and API enforce roles.
        shouldCreateUser: /^[^@\s]+@muzeoffice\.com$/.test(address),
        emailRedirectTo: redirect.toString(),
      },
    });
    if (error) throw error;
  },
  verifyToken: () => authRequest('/admin/verify-token'),
  logout: () => supabase.auth.signOut({ scope: 'local' }),
  getStats: () => authRequest('/admin/stats'),
  getSettings: () => authRequest('/admin/settings'),
  updateSetting: (key, value) => authRequest(`/admin/settings/${key}`, {
    method: 'PATCH', body: { value },
  }),
  getCategories: () => authRequest('/admin/categories'),
  getCategory: id => authRequest(`/admin/categories/${id}`),
  createCategory: data => authRequest('/admin/categories', { method: 'POST', body: data }),
  updateCategory: (id, data) => authRequest(`/admin/categories/${id}`, { method: 'PUT', body: data }),
  deleteCategory: id => authRequest(`/admin/categories/${id}`, { method: 'DELETE' }),
  getItems: () => authRequest('/admin/items'),
  getItem: id => authRequest(`/admin/items/${id}`),
  createItem: data => authRequest('/admin/items', { method: 'POST', body: data }),
  updateItem: (id, data) => authRequest(`/admin/items/${id}`, { method: 'PUT', body: data }),
  deleteItem: id => authRequest(`/admin/items/${id}`, { method: 'DELETE' }),
  toggleItemAvailability: (id, available) => authRequest(`/admin/items/${id}/availability`, {
    method: 'PATCH', body: { available },
  }),
  getModifierGroups: () => authRequest('/admin/modifier-groups'),
  getModifierGroup: id => authRequest(`/admin/modifier-groups/${id}`),
  createModifierGroup: data => authRequest('/admin/modifier-groups', { method: 'POST', body: data }),
  updateModifierGroup: (id, data) => authRequest(`/admin/modifier-groups/${id}`, { method: 'PUT', body: data }),
  deleteModifierGroup: id => authRequest(`/admin/modifier-groups/${id}`, { method: 'DELETE' }),
  getModifierOptions: () => authRequest('/admin/modifier-options'),
  createModifierOption: data => authRequest('/admin/modifier-options', { method: 'POST', body: data }),
  updateModifierOption: (id, data) => authRequest(`/admin/modifier-options/${id}`, { method: 'PUT', body: data }),
  deleteModifierOption: id => authRequest(`/admin/modifier-options/${id}`, { method: 'DELETE' }),
  setItemModifierGroups: (itemId, groupIds) => authRequest(`/admin/items/${itemId}/modifier-groups`, {
    method: 'PUT', body: { group_ids: groupIds },
  }),
  uploadImage: file => {
    const form = new FormData();
    form.append('image', file);
    return authRequest('/admin/upload', { method: 'POST', body: form });
  },
  deleteImage: filename => authRequest(`/admin/upload/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
  getBackupInfo: () => authRequest('/admin/backup/info'),
  getBackups: () => authRequest('/admin/backups'),
  createBackup: () => authRequest('/admin/backup', { method: 'POST' }),
  restoreBackup: filename => authRequest(`/admin/backup/${filename}/restore`, { method: 'POST' }),
  deleteBackup: filename => authRequest(`/admin/backup/${filename}`, { method: 'DELETE' }),
  cleanupBackups: (days = 7) => authRequest(`/admin/backups/cleanup?days=${days}`, { method: 'DELETE' }),
  getOrders: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value)).toString();
    return authRequest(`/admin/orders${query ? `?${query}` : ''}`);
  },
  getOrderStats: (startDate, endDate) => {
    const query = new URLSearchParams(Object.entries({ startDate, endDate }).filter(([, value]) => value)).toString();
    return authRequest(`/admin/orders/stats${query ? `?${query}` : ''}`);
  },
  getOrder: id => authRequest(`/admin/orders/${id}`),
};

export default { menuAPI, orderAPI, adminAPI, settingsAPI };
