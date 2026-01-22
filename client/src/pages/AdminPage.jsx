import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Coffee,
  DollarSign,
  ShoppingBag,
  Settings,
  Eye,
  EyeOff,
  ChefHat,
  Percent,
  FolderOpen,
  Package,
  Sliders,
  Lock,
  LogOut,
  Database,
  Download,
  Upload,
  Clock,
  HardDrive,
  Megaphone,
} from 'lucide-react';
import { adminAPI, menuAPI, isAuthenticated as checkAuth } from '../utils/api';
import { formatPriceFromDollars } from '../utils/formatters';
import PinEntry from '../components/PinEntry';

export default function AdminPage() {
  const [authState, setAuthState] = useState('checking'); // 'checking' | 'authenticated' | 'unauthenticated'
  const [activeTab, setActiveTab] = useState('items');
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modifierGroups, setModifierGroups] = useState([]);
  const [stats, setStats] = useState({ orders: 0, revenue: 0 });
  const [settings, setSettings] = useState({ tax_rate: '0.0825' });
  const [loading, setLoading] = useState(true);

  // Verify authentication on mount
  useEffect(() => {
    verifyAuth();
  }, []);

  async function verifyAuth() {
    if (!checkAuth()) {
      setAuthState('unauthenticated');
      return;
    }

    try {
      // Verify token is still valid with server
      await adminAPI.verifyToken();
      setAuthState('authenticated');
    } catch (err) {
      // Token invalid or expired
      console.log('Token verification failed:', err.message);
      setAuthState('unauthenticated');
    }
  }

  useEffect(() => {
    if (authState === 'authenticated') {
      loadData();
    }
  }, [authState]);

  function handleLogout() {
    adminAPI.logout();
    setAuthState('unauthenticated');
  }

  function handleAuthSuccess() {
    setAuthState('authenticated');
  }

  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-muze-dark flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-muze-gold" />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <PinEntry onSuccess={handleAuthSuccess} title="Admin Access" />;
  }

  async function loadData() {
    try {
      setLoading(true);
      const [items, cats, groups, statsData, settingsData] = await Promise.all([
        adminAPI.getItems(),
        adminAPI.getCategories(),
        adminAPI.getModifierGroups(),
        adminAPI.getStats(),
        adminAPI.getSettings(),
      ]);
      setMenuItems(items || []);
      setCategories(cats || []);
      setModifierGroups(groups || []);
      setStats(statsData || { orders: 0, revenue: 0 });
      setSettings(settingsData || { tax_rate: '0.0825' });
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-muze-dark text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-white/70">Muze Office</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                View Menu
              </Link>
              <Link
                to="/kitchen"
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                <ChefHat className="w-4 h-4" />
                Kitchen
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 transition-colors flex items-center gap-2"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-8 h-8 text-white/70" />
                <div>
                  <p className="text-white/70 text-sm">Today's Orders</p>
                  <p className="text-2xl font-bold">{stats.orders}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-white/70" />
                <div>
                  <p className="text-white/70 text-sm">Today's Revenue</p>
                  <p className="text-2xl font-bold">{formatPriceFromDollars(stats.revenue)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Coffee className="w-8 h-8 text-white/70" />
                <div>
                  <p className="text-white/70 text-sm">Menu Items</p>
                  <p className="text-2xl font-bold">{menuItems.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-6 py-3 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'items'
                  ? 'bg-gray-50 text-muze-dark'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Package className="w-4 h-4" />
              Menu Items
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-3 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'categories'
                  ? 'bg-gray-50 text-muze-dark'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Categories
            </button>
            <button
              onClick={() => setActiveTab('modifiers')}
              className={`px-6 py-3 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'modifiers'
                  ? 'bg-gray-50 text-muze-dark'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Modifiers
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-3 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'bg-gray-50 text-muze-dark'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'items' && (
          <ItemsSection
            items={menuItems}
            categories={categories}
            modifierGroups={modifierGroups}
            onUpdate={loadData}
            loading={loading}
          />
        )}
        {activeTab === 'categories' && (
          <CategoriesSection
            categories={categories}
            itemCounts={menuItems.reduce((acc, item) => {
              acc[item.category_id] = (acc[item.category_id] || 0) + 1;
              return acc;
            }, {})}
            onUpdate={loadData}
          />
        )}
        {activeTab === 'modifiers' && (
          <ModifiersSection
            modifierGroups={modifierGroups}
            onUpdate={loadData}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsSection
            settings={settings}
            onUpdate={loadData}
          />
        )}
      </main>
    </div>
  );
}

// ============ Items Section ============
function ItemsSection({ items, categories, modifierGroups, onUpdate, loading }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const filteredItems = selectedCategory
    ? items.filter(item => item.category_id === selectedCategory)
    : items;

  async function toggleAvailability(itemId, currentlyAvailable) {
    try {
      await adminAPI.toggleItemAvailability(itemId, !currentlyAvailable);
      onUpdate();
    } catch (err) {
      console.error('Failed to update availability:', err);
    }
  }

  async function deleteItem(itemId) {
    if (!confirm('Delete this item?')) return;
    try {
      await adminAPI.deleteItem(itemId);
      onUpdate();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      {/* Add/Edit Form Modal */}
      {(showAddForm || editingItem) && (
        <ItemForm
          item={editingItem}
          categories={categories}
          modifierGroups={modifierGroups}
          onSave={() => {
            setShowAddForm(false);
            setEditingItem(null);
            onUpdate();
          }}
          onCancel={() => {
            setShowAddForm(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Menu Items</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            !selectedCategory
              ? 'bg-muze-dark text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          All ({items.length})
        </button>
        {categories.map(cat => {
          const count = items.filter(i => i.category_id === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-muze-dark text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Items Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Item</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Category</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Price</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Available</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  {item.description && (
                    <p className="text-sm text-gray-500 truncate max-w-xs">{item.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{item.category_name || 'Uncategorized'}</td>
                <td className="px-4 py-3 text-right font-medium">{formatPriceFromDollars(item.price)}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleAvailability(item.id, item.available)}
                    className={`p-2 rounded-lg transition-colors ${
                      item.available
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {item.available ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Coffee className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No menu items found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Item Form Modal ============
function ItemForm({ item, categories, modifierGroups, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    price: item?.price?.toString() || '',
    category_id: item?.category_id || '',
    available: item?.available !== undefined ? item.available : 1,
    modifier_group_ids: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loadingModifiers, setLoadingModifiers] = useState(false);

  useEffect(() => {
    if (item?.id) {
      loadItemModifiers();
    }
  }, [item?.id]);

  async function loadItemModifiers() {
    setLoadingModifiers(true);
    try {
      const fullItem = await adminAPI.getItem(item.id);
      if (fullItem.modifier_groups) {
        setForm(f => ({
          ...f,
          modifier_group_ids: fullItem.modifier_groups.map(g => g.id),
        }));
      }
    } catch (err) {
      console.error('Failed to load item modifiers:', err);
    } finally {
      setLoadingModifiers(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.price) {
      setError('Name and price are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        category_id: form.category_id || null,
        available: form.available ? 1 : 0,
        modifier_group_ids: form.modifier_group_ids,
      };

      if (item?.id) {
        await adminAPI.updateItem(item.id, data);
      } else {
        await adminAPI.createItem(data);
      }
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }

  function toggleModifierGroup(groupId) {
    setForm(f => ({
      ...f,
      modifier_group_ids: f.modifier_group_ids.includes(groupId)
        ? f.modifier_group_ids.filter(id => id !== groupId)
        : [...f.modifier_group_ids, groupId],
    }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">{item ? 'Edit Item' : 'Add New Item'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input"
              placeholder="Item name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input"
              rows={3}
              placeholder="Item description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className="input pl-7"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value ? parseInt(e.target.value) : null }))}
                className="input"
              >
                <option value="">Uncategorized</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.available}
                onChange={e => setForm(f => ({ ...f, available: e.target.checked ? 1 : 0 }))}
                className="w-4 h-4 rounded border-gray-300 text-muze-accent focus:ring-muze-accent"
              />
              <span className="text-sm font-medium text-gray-700">Available for ordering</span>
            </label>
          </div>

          {/* Modifier Groups */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Modifier Groups</label>
            {loadingModifiers ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                {modifierGroups.length === 0 ? (
                  <p className="text-gray-500 text-sm">No modifier groups available</p>
                ) : (
                  modifierGroups.map(group => (
                    <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.modifier_group_ids.includes(group.id)}
                        onChange={() => toggleModifierGroup(group.id)}
                        className="w-4 h-4 rounded border-gray-300 text-muze-accent focus:ring-muze-accent"
                      />
                      <span className="text-sm text-gray-700">{group.display_name || group.name}</span>
                      <span className="text-xs text-gray-400">({group.options?.length || 0} options)</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {item ? 'Update Item' : 'Add Item'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ Categories Section ============
function CategoriesSection({ categories, itemCounts, onUpdate }) {
  const [editingCategory, setEditingCategory] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);

  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategory.name) return;

    setSaving(true);
    try {
      await adminAPI.createCategory(newCategory);
      setNewCategory({ name: '', description: '', sort_order: categories.length });
      setShowAddForm(false);
      onUpdate();
    } catch (err) {
      console.error('Failed to create category:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCategory(id) {
    if (!editingCategory.name) return;

    setSaving(true);
    try {
      await adminAPI.updateCategory(id, editingCategory);
      setEditingCategory(null);
      onUpdate();
    } catch (err) {
      console.error('Failed to update category:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(id) {
    const count = itemCounts[id] || 0;
    const msg = count > 0
      ? `This will uncategorize ${count} menu items. Delete anyway?`
      : 'Delete this category?';
    if (!confirm(msg)) return;

    try {
      await adminAPI.deleteCategory(id);
      onUpdate();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Categories</h2>
        <button
          onClick={() => {
            setNewCategory({ name: '', description: '', sort_order: categories.length });
            setShowAddForm(true);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleAddCategory} className="card p-4 mb-6 space-y-3">
          <div className="flex gap-4">
            <input
              type="text"
              value={newCategory.name}
              onChange={e => setNewCategory(c => ({ ...c, name: e.target.value }))}
              placeholder="Category name"
              className="input flex-1"
              autoFocus
            />
            <input
              type="number"
              value={newCategory.sort_order}
              onChange={e => setNewCategory(c => ({ ...c, sort_order: parseInt(e.target.value) || 0 }))}
              placeholder="Order"
              className="input w-24"
            />
          </div>
          <div>
            <input
              type="text"
              value={newCategory.description}
              onChange={e => setNewCategory(c => ({ ...c, description: e.target.value }))}
              placeholder="Description (shown to customers, e.g., 'All drinks come in 16 oz cups')"
              className="input w-full"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Add Category
            </button>
          </div>
        </form>
      )}

      {/* Categories List */}
      <div className="space-y-3">
        {categories.map(cat => (
          <div key={cat.id} className="card overflow-hidden">
            {editingCategory?.id === cat.id ? (
              /* Edit Mode */
              <div className="p-4 space-y-3">
                <div className="flex gap-4">
                  <input
                    type="number"
                    value={editingCategory.sort_order}
                    onChange={e => setEditingCategory(c => ({ ...c, sort_order: parseInt(e.target.value) || 0 }))}
                    className="input w-20"
                    placeholder="Order"
                  />
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={e => setEditingCategory(c => ({ ...c, name: e.target.value }))}
                    className="input flex-1"
                    placeholder="Category name"
                  />
                  <span className="flex items-center text-gray-500 text-sm">
                    {itemCounts[cat.id] || 0} items
                  </span>
                </div>
                <input
                  type="text"
                  value={editingCategory.description || ''}
                  onChange={e => setEditingCategory(c => ({ ...c, description: e.target.value }))}
                  placeholder="Description (shown to customers)"
                  className="input w-full"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingCategory(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateCategory(cat.id)}
                    disabled={saving}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="p-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm w-8">{cat.sort_order}</span>
                    <span className="font-medium text-gray-900">{cat.name}</span>
                    <span className="text-gray-400 text-sm">({itemCounts[cat.id] || 0} items)</span>
                  </div>
                  {cat.description && (
                    <p className="text-sm text-gray-500 mt-1 ml-11">{cat.description}</p>
                  )}
                  {!cat.description && (
                    <p className="text-sm text-gray-400 italic mt-1 ml-11">No description</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingCategory({ ...cat })}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {categories.length === 0 && (
          <div className="card p-12 text-center text-gray-500">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No categories yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Modifiers Section ============
function ModifiersSection({ modifierGroups, onUpdate }) {
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [showAddOptionForm, setShowAddOptionForm] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingOption, setEditingOption] = useState(null);

  async function handleAddGroup(groupData) {
    try {
      await adminAPI.createModifierGroup(groupData);
      setShowAddGroupForm(false);
      onUpdate();
    } catch (err) {
      console.error('Failed to create modifier group:', err);
    }
  }

  async function handleUpdateGroup(id, groupData) {
    try {
      await adminAPI.updateModifierGroup(id, groupData);
      setEditingGroup(null);
      onUpdate();
    } catch (err) {
      console.error('Failed to update modifier group:', err);
    }
  }

  async function handleDeleteGroup(id) {
    if (!confirm('Delete this modifier group and all its options?')) return;
    try {
      await adminAPI.deleteModifierGroup(id);
      onUpdate();
    } catch (err) {
      console.error('Failed to delete modifier group:', err);
    }
  }

  async function handleAddOption(optionData) {
    try {
      await adminAPI.createModifierOption(optionData);
      setShowAddOptionForm(null);
      onUpdate();
    } catch (err) {
      console.error('Failed to create modifier option:', err);
    }
  }

  async function handleUpdateOption(id, optionData) {
    try {
      await adminAPI.updateModifierOption(id, optionData);
      setEditingOption(null);
      onUpdate();
    } catch (err) {
      console.error('Failed to update modifier option:', err);
    }
  }

  async function handleDeleteOption(id) {
    if (!confirm('Delete this modifier option?')) return;
    try {
      await adminAPI.deleteModifierOption(id);
      onUpdate();
    } catch (err) {
      console.error('Failed to delete modifier option:', err);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Modifier Groups</h2>
        <button
          onClick={() => setShowAddGroupForm(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Modifier Group
        </button>
      </div>

      {/* Add Group Form */}
      {showAddGroupForm && (
        <ModifierGroupForm
          onSave={handleAddGroup}
          onCancel={() => setShowAddGroupForm(false)}
        />
      )}

      {/* Groups List */}
      <div className="space-y-4">
        {modifierGroups.map(group => (
          <div key={group.id} className="card overflow-hidden">
            {/* Group Header */}
            <div
              className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
            >
              <div className="flex items-center gap-3">
                <Sliders className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">{group.display_name || group.name}</p>
                  <p className="text-sm text-gray-500">{group.options?.length || 0} options</p>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setEditingGroup({ ...group })}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded Options */}
            {expandedGroup === group.id && (
              <div className="p-4 border-t">
                {/* Add Option Button */}
                <button
                  onClick={() => setShowAddOptionForm(group.id)}
                  className="mb-4 text-sm text-muze-accent hover:underline flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Option
                </button>

                {/* Add Option Form */}
                {showAddOptionForm === group.id && (
                  <ModifierOptionForm
                    groupId={group.id}
                    onSave={handleAddOption}
                    onCancel={() => setShowAddOptionForm(null)}
                  />
                )}

                {/* Options List */}
                <div className="space-y-2">
                  {group.options?.map(option => (
                    <div key={option.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      {editingOption?.id === option.id ? (
                        <ModifierOptionForm
                          option={editingOption}
                          groupId={group.id}
                          onSave={(data) => handleUpdateOption(option.id, data)}
                          onCancel={() => setEditingOption(null)}
                          inline
                        />
                      ) : (
                        <>
                          <div>
                            <span className="font-medium text-gray-900">{option.display_name || option.name}</span>
                            {option.price_adjustment > 0 && (
                              <span className="ml-2 text-green-600 text-sm">
                                +{formatPriceFromDollars(option.price_adjustment)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingOption({ ...option })}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOption(option.id)}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {(!group.options || group.options.length === 0) && !showAddOptionForm && (
                    <p className="text-gray-500 text-sm text-center py-4">No options yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {modifierGroups.length === 0 && (
          <div className="card p-12 text-center text-gray-500">
            <Sliders className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No modifier groups yet</p>
          </div>
        )}
      </div>

      {/* Edit Group Modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <ModifierGroupForm
            group={editingGroup}
            onSave={(data) => handleUpdateGroup(editingGroup.id, data)}
            onCancel={() => setEditingGroup(null)}
          />
        </div>
      )}
    </div>
  );
}

function ModifierGroupForm({ group, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: group?.name || '',
    display_name: group?.display_name || '',
    min_selections: group?.min_selections || 0,
    max_selections: group?.max_selections || 10,
    required: group?.required || 0,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name) return;

    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-md w-full">
      <h3 className="text-lg font-bold mb-4">{group ? 'Edit Modifier Group' : 'New Modifier Group'}</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Internal Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="input"
            placeholder="e.g., coffee_addons"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input
            type="text"
            value={form.display_name}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            className="input"
            placeholder="e.g., Add-ons"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Selections</label>
            <input
              type="number"
              min="0"
              value={form.min_selections}
              onChange={e => setForm(f => ({ ...f, min_selections: parseInt(e.target.value) || 0 }))}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Selections</label>
            <input
              type="number"
              min="1"
              value={form.max_selections}
              onChange={e => setForm(f => ({ ...f, max_selections: parseInt(e.target.value) || 10 }))}
              className="input"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.required}
            onChange={e => setForm(f => ({ ...f, required: e.target.checked ? 1 : 0 }))}
            className="w-4 h-4 rounded border-gray-300 text-muze-accent focus:ring-muze-accent"
          />
          <span className="text-sm font-medium text-gray-700">Required</span>
        </label>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {group ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

function ModifierOptionForm({ option, groupId, onSave, onCancel, inline }) {
  const [form, setForm] = useState({
    name: option?.name || '',
    display_name: option?.display_name || '',
    price_adjustment: option?.price_adjustment?.toString() || '0',
    group_id: groupId,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name) return;

    setSaving(true);
    await onSave({
      ...form,
      price_adjustment: parseFloat(form.price_adjustment) || 0,
    });
    setSaving(false);
  }

  if (inline) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="input py-1 text-sm flex-1"
          placeholder="Name"
        />
        <div className="relative w-24">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.price_adjustment}
            onChange={e => setForm(f => ({ ...f, price_adjustment: e.target.value }))}
            className="input py-1 text-sm pl-5"
          />
        </div>
        <button type="submit" disabled={saving} className="p-1.5 text-green-600 hover:bg-green-100 rounded">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onCancel} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded">
          <X className="w-4 h-4" />
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-white border rounded-lg mb-3">
      <div className="flex gap-3">
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="input py-1.5 text-sm flex-1"
          placeholder="Option name"
          autoFocus
        />
        <div className="relative w-28">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.price_adjustment}
            onChange={e => setForm(f => ({ ...f, price_adjustment: e.target.value }))}
            className="input py-1.5 text-sm pl-5"
            placeholder="0.00"
          />
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary py-1.5 px-3">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Add'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary py-1.5 px-3">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ============ Settings Section ============
function SettingsSection({ settings, onUpdate }) {
  const [taxRate, setTaxRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Announcement state
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementResult, setAnnouncementResult] = useState(null);
  const [announcementError, setAnnouncementError] = useState(null);

  // PIN change state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [pinResult, setPinResult] = useState(null);
  const [pinError, setPinError] = useState(null);
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);

  useEffect(() => {
    const rate = parseFloat(settings.tax_rate || 0.0825);
    setTaxRate((rate * 100).toFixed(2));
    setAnnouncementText(settings.announcement_text || '');
    setAnnouncementEnabled(settings.announcement_enabled === 'true');
  }, [settings.tax_rate, settings.announcement_text, settings.announcement_enabled]);

  const handleSaveAnnouncement = async () => {
    setSavingAnnouncement(true);
    setAnnouncementError(null);
    setAnnouncementResult(null);

    try {
      await adminAPI.updateSetting('announcement_text', announcementText);
      await adminAPI.updateSetting('announcement_enabled', announcementEnabled.toString());
      setAnnouncementResult('Announcement updated successfully');
      onUpdate();
    } catch (err) {
      console.error('Failed to save announcement:', err);
      setAnnouncementError(err.message || 'Failed to save announcement');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleSaveTaxRate = async () => {
    setSaving(true);
    setError(null);
    setResult(null);

    try {
      const decimalRate = parseFloat(taxRate) / 100;

      if (isNaN(decimalRate) || decimalRate < 0 || decimalRate > 1) {
        throw new Error('Please enter a valid tax rate between 0 and 100');
      }

      await adminAPI.updateSetting('tax_rate', decimalRate.toString());
      setResult('Tax rate updated successfully');
      onUpdate();
    } catch (err) {
      console.error('Failed to save tax rate:', err);
      setError(err.message || 'Failed to save tax rate');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    setPinError(null);
    setPinResult(null);

    // Validate inputs
    if (!currentPin || currentPin.length < 4) {
      setPinError('Please enter your current PIN');
      return;
    }
    if (!newPin || newPin.length < 4) {
      setPinError('New PIN must be at least 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('New PINs do not match');
      return;
    }

    setSavingPin(true);

    try {
      // Verify current PIN first
      const verifyResult = await adminAPI.verifyPin(currentPin);
      if (!verifyResult.success) {
        throw new Error('Current PIN is incorrect');
      }

      // Update to new PIN
      await adminAPI.updateSetting('admin_pin', newPin);
      setPinResult('PIN changed successfully');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      console.error('Failed to change PIN:', err);
      setPinError(err.message || 'Failed to change PIN');
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Announcement Banner Setting */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Megaphone className="w-6 h-6" />
          Announcement Banner
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Display a banner on the menu page to announce specials, soups of the day, or important notices.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Announcement Message
            </label>
            <textarea
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              className="input w-full"
              rows={2}
              placeholder="e.g., Today's soup: Tomato Basil! | Happy Hour: 2-4pm - 20% off all drinks"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">{announcementText.length}/500 characters</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={announcementEnabled}
              onChange={(e) => setAnnouncementEnabled(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-muze-accent focus:ring-muze-accent"
            />
            <span className="font-medium text-gray-700">Show announcement banner</span>
          </label>

          <button
            onClick={handleSaveAnnouncement}
            disabled={savingAnnouncement}
            className="btn btn-primary px-6 py-3 flex items-center gap-2"
          >
            {savingAnnouncement ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Announcement'
            )}
          </button>
        </div>

        {announcementResult && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-green-800 text-sm">{announcementResult}</span>
          </div>
        )}

        {announcementError && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-800 text-sm">{announcementError}</span>
          </div>
        )}

        {/* Preview */}
        {announcementText && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
            <div className={`bg-muze-gold/90 text-muze-dark px-4 py-3 rounded-lg ${!announcementEnabled ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <Megaphone className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{announcementText}</p>
              </div>
            </div>
            {!announcementEnabled && (
              <p className="text-xs text-gray-500 mt-1">Banner is currently hidden. Enable it above to show on the menu.</p>
            )}
          </div>
        )}
      </div>

      {/* Tax Rate Setting */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Percent className="w-6 h-6" />
          Tax Rate
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Set the sales tax rate applied to all orders. Enter the percentage (e.g., 8.25 for 8.25%).
        </p>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="input pr-10 text-lg"
              placeholder="8.25"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
              %
            </span>
          </div>
          <button
            onClick={handleSaveTaxRate}
            disabled={saving}
            className="btn btn-primary px-6 py-3 flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-3">
          Current rate: {(parseFloat(settings.tax_rate || 0.0825) * 100).toFixed(2)}%
        </p>

        {result && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-green-800 text-sm">{result}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        )}
      </div>

      <div className="card p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">About Tax Calculation</h3>
        <p className="text-blue-800 text-sm">
          The tax rate is applied to the subtotal of each order at checkout.
          Changes will apply to all new orders immediately.
        </p>
      </div>

      {/* PIN Change Setting */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Lock className="w-6 h-6" />
          Change Admin PIN
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Update the PIN used for admin and kitchen access. The PIN must be at least 4 digits.
        </p>

        <form onSubmit={handleChangePin} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current PIN
            </label>
            <div className="relative">
              <input
                type={showCurrentPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input pr-10"
                placeholder="Enter current PIN"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPin(!showCurrentPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New PIN
            </label>
            <div className="relative">
              <input
                type={showNewPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input pr-10"
                placeholder="Enter new PIN"
              />
              <button
                type="button"
                onClick={() => setShowNewPin(!showNewPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New PIN
            </label>
            <input
              type={showNewPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="input"
              placeholder="Confirm new PIN"
            />
          </div>

          <button
            type="submit"
            disabled={savingPin}
            className="btn btn-primary px-6 py-3 flex items-center gap-2"
          >
            {savingPin ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Change PIN'
            )}
          </button>
        </form>

        {pinResult && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-green-800 text-sm">{pinResult}</span>
          </div>
        )}

        {pinError && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-800 text-sm">{pinError}</span>
          </div>
        )}
      </div>

      {/* Database Backup Section */}
      <BackupSection />
    </div>
  );
}

// ============ Backup Section ============
function BackupSection() {
  const [backups, setBackups] = useState([]);
  const [backupInfo, setBackupInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [cleanupDays, setCleanupDays] = useState(7);

  useEffect(() => {
    loadBackups();
  }, []);

  async function loadBackups() {
    try {
      setLoading(true);
      const [backupsData, infoData] = await Promise.all([
        adminAPI.getBackups(),
        adminAPI.getBackupInfo(),
      ]);
      setBackups(backupsData?.backups || []);
      setBackupInfo(infoData);
    } catch (err) {
      console.error('Failed to load backups:', err);
      setError('Failed to load backups');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBackup() {
    setCreating(true);
    setError(null);
    setMessage(null);

    try {
      const result = await adminAPI.createBackup();
      setMessage(`Backup created: ${result.filename}`);
      loadBackups();
    } catch (err) {
      console.error('Failed to create backup:', err);
      setError(err.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  }

  async function handleRestoreBackup(filename) {
    if (!confirm(`Restore database from backup "${filename}"?\n\nWARNING: This will replace the current database. A pre-restore backup will be created automatically.`)) {
      return;
    }

    setRestoring(filename);
    setError(null);
    setMessage(null);

    try {
      const result = await adminAPI.restoreBackup(filename);
      setMessage(`Database restored from ${filename}. You may need to refresh the page.`);
      loadBackups();
    } catch (err) {
      console.error('Failed to restore backup:', err);
      setError(err.message || 'Failed to restore backup');
    } finally {
      setRestoring(null);
    }
  }

  async function handleDeleteBackup(filename) {
    if (!confirm(`Delete backup "${filename}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(filename);
    setError(null);
    setMessage(null);

    try {
      await adminAPI.deleteBackup(filename);
      setMessage(`Backup deleted: ${filename}`);
      loadBackups();
    } catch (err) {
      console.error('Failed to delete backup:', err);
      setError(err.message || 'Failed to delete backup');
    } finally {
      setDeleting(null);
    }
  }

  async function handleCleanupBackups() {
    if (!confirm(`Delete all backups older than ${cleanupDays} days?`)) {
      return;
    }

    setCleaning(true);
    setError(null);
    setMessage(null);

    try {
      const result = await adminAPI.cleanupBackups(cleanupDays);
      setMessage(result.message || `Cleaned up old backups`);
      loadBackups();
    } catch (err) {
      console.error('Failed to cleanup backups:', err);
      setError(err.message || 'Failed to cleanup backups');
    } finally {
      setCleaning(false);
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Database className="w-6 h-6" />
        Database Backups
      </h2>
      <p className="text-gray-600 text-sm mb-4">
        Create and manage database backups. Backups include all orders, menu items, categories, and settings.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="btn btn-primary flex items-center gap-2"
        >
          {creating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Create Backup
            </>
          )}
        </button>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="365"
            value={cleanupDays}
            onChange={(e) => setCleanupDays(parseInt(e.target.value) || 7)}
            className="input w-20 py-2"
          />
          <button
            onClick={handleCleanupBackups}
            disabled={cleaning}
            className="btn btn-secondary flex items-center gap-2"
          >
            {cleaning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Cleaning...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Clean up older than {cleanupDays} days
              </>
            )}
          </button>
        </div>

        <button
          onClick={loadBackups}
          disabled={loading}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Storage Info */}
      {backupInfo && (
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg mb-4">
          <HardDrive className="w-5 h-5 text-gray-500" />
          <span className="text-sm text-gray-600">
            <strong>{backupInfo.backupCount}</strong> backup{backupInfo.backupCount !== 1 ? 's' : ''} |
            <strong className="ml-1">{backupInfo.totalSize}</strong> total
          </span>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-green-800 text-sm">{message}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-800 text-sm">{error}</span>
        </div>
      )}

      {/* Backups List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : backups.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No backups yet</p>
          <p className="text-sm">Click "Create Backup" to create your first backup</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Backups</h3>
          {backups.map((backup) => (
            <div
              key={backup.filename}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 text-sm truncate max-w-xs" title={backup.filename}>
                    {backup.filename}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      {backup.size}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(backup.created)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRestoreBackup(backup.filename)}
                  disabled={restoring === backup.filename}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                  title="Restore this backup"
                >
                  {restoring === backup.filename ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleDeleteBackup(backup.filename)}
                  disabled={deleting === backup.filename}
                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete this backup"
                >
                  {deleting === backup.filename ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <h3 className="font-semibold text-amber-900 mb-2">Backup Information</h3>
        <ul className="text-amber-800 text-sm space-y-1">
          <li>Backups are stored locally on the server</li>
          <li>Restoring a backup will replace all current data</li>
          <li>A pre-restore backup is automatically created before restoring</li>
          <li>For safety, download important backups to external storage</li>
        </ul>
      </div>
    </div>
  );
}
