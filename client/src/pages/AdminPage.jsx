import { createElement, useCallback, useEffect, useRef, useState } from 'react';
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
  LogOut,
  Database,
  Megaphone,
  Receipt,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  User,
  ImageIcon,
  LayoutDashboard,
} from 'lucide-react';
import { adminAPI, isAuthenticated as checkAuth } from '../utils/api';
import { formatPriceFromDollars } from '../utils/formatters';
import StaffSignIn from '../components/StaffSignIn';

export default function AdminPage() {
  const [authState, setAuthState] = useState('checking'); // 'checking' | 'authenticated' | 'unauthenticated'
  const [activeTab, setActiveTab] = useState('overview');
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modifierGroups, setModifierGroups] = useState([]);
  const [stats, setStats] = useState({ orders: 0, revenue: 0 });
  const [settings, setSettings] = useState({ tax_rate: '0.0825' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const adminTabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'items', label: 'Menu Items', icon: Package },
    { id: 'categories', label: 'Categories', icon: FolderOpen },
    { id: 'modifiers', label: 'Modifiers', icon: Sliders },
    { id: 'orders', label: 'Orders', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Verify authentication on mount
  useEffect(() => {
    verifyAuth();
  }, []);

  async function verifyAuth() {
    if (!await checkAuth()) {
      setAuthState('unauthenticated');
      return;
    }

    try {
      // Verify token is still valid with server
      const result = await adminAPI.verifyToken();
      if (result.auth?.role !== 'admin') throw new Error('Administrator access is required');
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

  async function handleLogout() {
    await adminAPI.logout();
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
    return <StaffSignIn onSuccess={handleAuthSuccess} title="Admin Access" />;
  }

  async function loadData() {
    try {
      setLoading(true);
      setLoadError(null);
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
      setLoadError(err.message || 'The dashboard could not load its latest data.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-muze-dark text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Settings className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold leading-tight">Admin Dashboard</h1>
                <p className="text-white/70 text-sm">Muze Office</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/"
                className="px-3 sm:px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm sm:text-base"
              >
                <span className="hidden xs:inline">View </span>Menu
              </Link>
              <Link
                to="/kitchen"
                className="px-3 sm:px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-2 text-sm sm:text-base"
              >
                <ChefHat className="w-4 h-4" />
                Kitchen
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 sm:px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 transition-colors flex items-center gap-2"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4">
          <div className="py-3 sm:hidden">
            <label htmlFor="admin-section" className="sr-only">Dashboard section</label>
            <select
              id="admin-section"
              value={activeTab}
              onChange={(event) => setActiveTab(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white focus:border-muze-gold focus:outline-none focus:ring-2 focus:ring-muze-gold"
            >
              {adminTabs.map(tab => <option key={tab.id} value={tab.id} className="text-muze-dark">{tab.label}</option>)}
            </select>
          </div>
          <div className="hidden flex-wrap gap-1 sm:flex">
            {adminTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gray-50 text-muze-dark'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        {loadError && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <span>{loadError}</span>
            <button onClick={loadData} className="font-semibold underline underline-offset-2">Retry</button>
          </div>
        )}
        {activeTab === 'overview' && (
          <OverviewSection
            items={menuItems}
            categories={categories}
            modifierGroups={modifierGroups}
            stats={stats}
            settings={settings}
            loading={loading}
            onNavigate={setActiveTab}
            onUpdate={loadData}
          />
        )}
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
        {activeTab === 'orders' && (
          <OrdersSection />
        )}
        {activeTab === 'settings' && (
          <SettingsSection
            key={`${settings.tax_rate}:${settings.announcement_text}:${settings.announcement_enabled}`}
            settings={settings}
            onUpdate={loadData}
          />
        )}
      </main>
    </div>
  );
}

// ============ Overview Section ============
function OverviewSection({
  items,
  categories,
  modifierGroups,
  stats,
  settings,
  loading,
  onNavigate,
  onUpdate,
}) {
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const kitchenOpen = settings.kitchen_open !== 'false';
  const cafeItems = items;
  const unavailableItems = cafeItems.filter(item => !item.available);
  const uncategorizedItems = cafeItems.filter(item => !item.category_id);
  const missingImages = cafeItems.filter(item => !item.image_url);

  async function toggleKitchenStatus() {
    setSavingStatus(true);
    setStatusError(null);
    try {
      await adminAPI.updateSetting('kitchen_open', String(!kitchenOpen));
      await onUpdate();
    } catch (err) {
      setStatusError(err.message || 'Could not update café status.');
    } finally {
      setSavingStatus(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-8 w-8 animate-spin text-muze-gold" />
      </div>
    );
  }

  const healthItems = [
    { label: 'Unavailable items', value: unavailableItems.length },
    { label: 'Uncategorized items', value: uncategorizedItems.length },
    { label: 'Missing images', value: missingImages.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muze-brown">Daily operations</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950">Your café at a glance</h2>
          <p className="mt-1 text-sm text-gray-600">Manage availability, announcements, menus, and incoming orders.</p>
        </div>
        <button onClick={onUpdate} className="btn btn-secondary flex items-center justify-center gap-2 self-start sm:self-auto">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewMetric icon={ShoppingBag} label="Today's orders" value={stats.orders || 0} />
        <OverviewMetric icon={DollarSign} label="Today's revenue" value={formatPriceFromDollars(stats.revenue || 0)} />
        <OverviewMetric icon={Coffee} label="Café items" value={cafeItems.length} />
        <OverviewMetric icon={Coffee} label="Available items" value={cafeItems.length - unavailableItems.length} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-500">Café ordering</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${kitchenOpen ? 'bg-green-500' : 'bg-red-500'}`} />
                <h3 className="text-xl font-bold text-gray-950">
                  {kitchenOpen ? 'Accepting orders' : 'Ordering paused'}
                </h3>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                {kitchenOpen
                  ? 'Customers can add café items and continue to checkout.'
                  : settings.kitchen_closed_message || 'Customers can browse, but they cannot place a new order.'}
              </p>
            </div>
            <button
              onClick={toggleKitchenStatus}
              disabled={savingStatus}
              className={`btn flex flex-shrink-0 items-center gap-2 ${kitchenOpen ? 'btn-secondary' : 'btn-primary'}`}
            >
              {savingStatus && <RefreshCw className="h-4 w-4 animate-spin" />}
              {kitchenOpen ? 'Pause' : 'Open café'}
            </button>
          </div>
          {statusError && <p className="mt-3 text-sm text-red-600">{statusError}</p>}

          <div className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-3">
            {healthItems.map(item => (
              <button
                key={item.label}
                onClick={() => onNavigate('items')}
                className="rounded-xl bg-gray-50 p-3 text-left transition-colors hover:bg-gray-100"
              >
                <p className={`text-2xl font-bold ${item.value ? 'text-amber-700' : 'text-green-700'}`}>{item.value}</p>
                <p className="mt-0.5 text-xs font-medium text-gray-600">{item.label}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2 text-gray-950">
            <Megaphone className="h-5 w-5 text-muze-brown" />
            <h3 className="font-bold">Announcement</h3>
          </div>
          <div className={`mt-4 rounded-xl border p-4 ${settings.announcement_enabled === 'true' ? 'border-muze-gold/50 bg-muze-gold/15' : 'border-gray-200 bg-gray-50'}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              {settings.announcement_enabled === 'true' ? 'Visible now' : 'Hidden'}
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-gray-800">
              {settings.announcement_text || 'No announcement has been written.'}
            </p>
          </div>
          <button onClick={() => onNavigate('settings')} className="mt-4 text-sm font-semibold text-muze-brown hover:underline">
            Edit announcement →
          </button>
        </section>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-5">
          <h3 className="font-bold text-gray-950">Catalog structure</h3>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <div><dt className="text-xs text-gray-500">Categories</dt><dd className="mt-1 text-xl font-bold">{categories.length}</dd></div>
            <div><dt className="text-xs text-gray-500">Items live</dt><dd className="mt-1 text-xl font-bold">{cafeItems.length - unavailableItems.length}</dd></div>
            <div><dt className="text-xs text-gray-500">Modifier sets</dt><dd className="mt-1 text-xl font-bold">{modifierGroups.length}</dd></div>
          </dl>
          <button onClick={() => onNavigate('items')} className="mt-5 text-sm font-semibold text-muze-brown hover:underline">Manage café menu →</button>
        </section>

        <section className="card p-5">
          <h3 className="font-bold text-gray-950">Quick actions</h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => onNavigate('orders')} className="rounded-xl border border-gray-200 p-3 text-left text-sm font-semibold hover:bg-gray-50">Review orders</button>
            <button onClick={() => onNavigate('items')} className="rounded-xl border border-gray-200 p-3 text-left text-sm font-semibold hover:bg-gray-50">Edit café menu</button>
            <button onClick={() => onNavigate('categories')} className="rounded-xl border border-gray-200 p-3 text-left text-sm font-semibold hover:bg-gray-50">Edit categories</button>
            <Link to="/kitchen" className="rounded-xl border border-gray-200 p-3 text-left text-sm font-semibold hover:bg-gray-50">Kitchen display</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function OverviewMetric({ icon, label, value }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 sm:text-sm">{label}</p>
          <p className="mt-1 truncate text-xl font-bold text-gray-950 sm:text-2xl">{value}</p>
        </div>
        <span className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muze-gold/15 text-muze-brown sm:flex">
          {createElement(icon, { className: 'h-4 w-4' })}
        </span>
      </div>
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold text-gray-600">Item</th>
                <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold text-gray-600">Category</th>
                <th className="px-3 sm:px-4 py-3 text-right text-sm font-semibold text-gray-600">Price</th>
                <th className="px-3 sm:px-4 py-3 text-center text-sm font-semibold text-gray-600">Available</th>
                <th className="px-3 sm:px-4 py-3 text-center text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-4 py-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-gray-500 truncate max-w-[50vw] sm:max-w-xs">{item.description}</p>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-gray-600">{item.category_name || 'Uncategorized'}</td>
                  <td className="px-3 sm:px-4 py-3 text-right font-medium whitespace-nowrap">{formatPriceFromDollars(item.price)}</td>
                  <td className="px-3 sm:px-4 py-3 text-center">
                    <button
                      onClick={() => toggleAvailability(item.id, item.available)}
                      className={`w-10 h-10 inline-flex items-center justify-center rounded-lg transition-colors ${
                        item.available
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      aria-label={item.available ? 'Mark unavailable' : 'Mark available'}
                    >
                      {item.available ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="w-10 h-10 inline-flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        aria-label="Edit item"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="w-10 h-10 inline-flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="Delete item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
    image_url: item?.image_url || null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loadingModifiers, setLoadingModifiers] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const result = await adminAPI.uploadImage(file);
      setForm(f => ({ ...f, image_url: result.url }));
    } catch (err) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleRemoveImage() {
    // If we have an image URL, we could optionally delete it from the server
    // For now, just clear it from the form - the old image will be orphaned
    // but this keeps the UX simple
    setForm(f => ({ ...f, image_url: null }));
  }

  const loadItemModifiers = useCallback(async () => {
    if (!item?.id) return;
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
  }, [item]);

  useEffect(() => {
    const timer = setTimeout(loadItemModifiers, 0);
    return () => clearTimeout(timer);
  }, [loadItemModifiers]);

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
        image_url: form.image_url || null,
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
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Item Image</label>
            <div className="flex items-start gap-4">
              {/* Image Preview */}
              <div className="w-24 h-24 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
                {form.image_url ? (
                  <img
                    src={form.image_url}
                    alt="Item preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                )}
              </div>
              {/* Upload Controls */}
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="btn btn-secondary py-2 px-4 text-sm flex items-center gap-2"
                >
                  {uploadingImage ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      {form.image_url ? 'Change Image' : 'Upload Image'}
                    </>
                  )}
                </button>
                {form.image_url && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove image
                  </button>
                )}
                <p className="text-xs text-gray-500">JPEG, PNG, GIF, or WebP. Max 5MB.</p>
              </div>
            </div>
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t">
            <button type="button" onClick={onCancel} className="btn btn-secondary w-full sm:w-auto">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
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
          <div className="flex flex-col sm:flex-row gap-3">
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
              className="input w-full sm:w-24"
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
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary w-full sm:w-auto">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
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
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <input
                    type="number"
                    value={editingCategory.sort_order}
                    onChange={e => setEditingCategory(c => ({ ...c, sort_order: parseInt(e.target.value) || 0 }))}
                    className="input w-full sm:w-20"
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
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  <button
                    onClick={() => setEditingCategory(null)}
                    className="btn btn-secondary w-full sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateCategory(cat.id)}
                    disabled={saving}
                    className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-gray-400 text-sm w-8 flex-shrink-0">{cat.sort_order}</span>
                    <span className="font-medium text-gray-900">{cat.name}</span>
                    <span className="text-gray-400 text-sm">({itemCounts[cat.id] || 0} items)</span>
                  </div>
                  {cat.description && (
                    <p className="text-sm text-gray-500 mt-1 sm:ml-11">{cat.description}</p>
                  )}
                  {!cat.description && (
                    <p className="text-sm text-gray-400 italic mt-1 sm:ml-11">No description</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setEditingCategory({ ...cat })}
                    className="w-10 h-10 inline-flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    aria-label="Edit category"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="w-10 h-10 inline-flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="Delete category"
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
              <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setEditingGroup({ ...group })}
                  className="w-10 h-10 inline-flex items-center justify-center text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                  aria-label="Edit modifier group"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="w-10 h-10 inline-flex items-center justify-center text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  aria-label="Delete modifier group"
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
    <form onSubmit={handleSubmit} className="card p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 mt-6 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn btn-secondary w-full sm:w-auto">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
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

// ============ Orders Section ============
function OrdersSection() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const result = await adminAPI.getOrders({
        page,
        limit: 20,
        status: statusFilter !== 'all' ? statusFilter : null,
        startDate: startDate || null,
        endDate: endDate || null,
        search: debouncedSearch || null,
      });
      setOrders(result.orders || []);
      setPagination(result.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, endDate, page, startDate, statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      const result = await adminAPI.getOrderStats(startDate || null, endDate || null);
      setStats(result);
    } catch (err) {
      console.error('Failed to load order stats:', err);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    const timer = setTimeout(loadOrders, 0);
    return () => clearTimeout(timer);
  }, [loadOrders]);

  useEffect(() => {
    const timer = setTimeout(loadStats, 0);
    return () => clearTimeout(timer);
  }, [loadStats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function getStatusBadge(status) {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      preparing: 'bg-blue-100 text-blue-800',
      ready: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card p-4">
            <p className="text-sm text-gray-600">Total Orders</p>
            <p className="text-2xl font-bold text-muze-dark">{stats.total_orders}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-600">Revenue</p>
            <p className="text-2xl font-bold text-green-600">{formatPriceFromDollars(stats.total_revenue)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-gray-700">{stats.completed_orders}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-600">Active</p>
            <p className="text-2xl font-bold text-blue-600">{stats.active_orders}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-600">Cancelled</p>
            <p className="text-2xl font-bold text-red-600">{stats.cancelled_orders}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 sm:gap-4 items-end">
          {/* Search */}
          <div className="w-full sm:flex-1 sm:min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Customer name, email, or pickup #"
                className="input pl-10 w-full"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="input w-full"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="w-[calc(50%-0.375rem)] sm:w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="input w-full"
            />
          </div>
          <div className="w-[calc(50%-0.375rem)] sm:w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="input w-full"
            />
          </div>

          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            className="btn btn-secondary py-2 px-4 w-full sm:w-auto"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-muze-gold" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">{error}</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No orders found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Pickup #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Total</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-bold text-muze-dark">#{String(order.pickup_number).padStart(3, '0')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{order.customer_name}</p>
                          {order.email && (
                            <p className="text-sm text-gray-500">{order.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-600">{order.items?.length || 0} items</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{formatPriceFromDollars(order.total)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2 text-muze-accent hover:bg-muze-accent/10 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 bg-gray-50 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs sm:text-sm text-gray-600">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total} orders
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

// Order Detail Modal
function OrderDetailModal({ order, onClose }) {
  function formatDate(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function getStatusBadge(status) {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      preparing: 'bg-blue-100 text-blue-800',
      ready: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-muze-dark text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Order #{String(order.pickup_number).padStart(3, '0')}</h2>
              <p className="text-white/70 text-sm">{formatDate(order.created_at)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Customer Info */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{order.customer_name}</span>
            </div>
            {order.email && (
              <p className="text-sm text-gray-600 ml-6">{order.email}</p>
            )}
          </div>

          {/* Status */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">Status:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(order.status)}`}>
              {order.status}
            </span>
          </div>

          {/* Order Items */}
          <div className="mb-4">
            <h3 className="font-medium text-gray-900 mb-2">Items</h3>
            <div className="space-y-2">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <p className="font-medium">
                      {item.quantity}x {item.item_name}
                    </p>
                    {item.modifiers && (
                      <p className="text-sm text-gray-600">{item.modifiers}</p>
                    )}
                    {item.special_instructions && (
                      <p className="text-sm text-muze-accent italic">"{item.special_instructions}"</p>
                    )}
                  </div>
                  <span className="font-medium">{formatPriceFromDollars(item.total_price)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Order Notes */}
          {order.notes && (
            <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm font-medium text-yellow-800">Order Notes:</p>
              <p className="text-sm text-yellow-700">{order.notes}</p>
            </div>
          )}

          {/* Cancellation Info */}
          {order.status === 'cancelled' && (
            <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-800">
                Cancelled{order.cancelled_by ? ` by ${order.cancelled_by}` : ''}
              </p>
              {order.cancellation_reason && (
                <p className="text-sm text-red-700 mt-1">Reason: {order.cancellation_reason}</p>
              )}
            </div>
          )}

          {/* Totals */}
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatPriceFromDollars(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax</span>
              <span>{formatPriceFromDollars(order.tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-1 border-t">
              <span>Total</span>
              <span>{formatPriceFromDollars(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full btn btn-primary py-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Settings Section ============
function SettingsSection({ settings, onUpdate }) {
  const [taxRate, setTaxRate] = useState(() => (
    (parseFloat(settings.tax_rate || 0.0825) * 100).toFixed(2)
  ));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Announcement state
  const [announcementText, setAnnouncementText] = useState(settings.announcement_text || '');
  const [announcementEnabled, setAnnouncementEnabled] = useState(
    settings.announcement_enabled === 'true',
  );
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementResult, setAnnouncementResult] = useState(null);
  const [announcementError, setAnnouncementError] = useState(null);

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

      {/* Café Tax Rate Setting */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Percent className="w-6 h-6" />
          Café Tax Rate
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Set the sales tax rate applied to café orders.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="relative w-full sm:flex-1 sm:max-w-xs">
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
            className="btn btn-primary px-6 py-3 flex items-center justify-center gap-2 w-full sm:w-auto"
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

      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Staff account security</h2>
        <p className="text-gray-600 text-sm">
          Staff credentials and password resets are managed through Supabase Authentication.
          Access roles are stored in protected app metadata and cannot be changed from the browser.
        </p>
      </div>

      {/* Database Backup Section */}
      <BackupSection />
    </div>
  );
}

// ============ Backup Section ============
function BackupSection() {
  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Database className="w-6 h-6" />
        Managed database backups
      </h2>
      <p className="text-gray-600 text-sm">
        Supabase manages database backups outside this application. Configure retention and
        point-in-time recovery in the Supabase dashboard, where restore access can be restricted
        to project owners instead of every application administrator.
      </p>
    </div>
  );
}
