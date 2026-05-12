import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, Coffee, Receipt, Megaphone, Lock, Sparkles } from 'lucide-react';
import { menuAPI, orderAPI, settingsAPI } from '../utils/api';
import { useCart } from '../context/CartContext';
import { formatPriceFromDollars, formatPickupNumber } from '../utils/formatters';
import CategoryNav from '../components/Menu/CategoryNav';
import MenuItemCard from '../components/Menu/MenuItemCard';
import ItemModal from '../components/Menu/ItemModal';
import CartDrawer from '../components/Cart/CartDrawer';
import HeroSection from '../components/Menu/HeroSection';
import GradientMesh from '../components/glass/GradientMesh';
import GlassPanel from '../components/glass/GlassPanel';

export default function MenuPage() {
  const navigate = useNavigate();
  const { cartCount, cartTotal } = useCart();

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [announcement, setAnnouncement] = useState({ enabled: false, text: '' });
  const [kitchenStatus, setKitchenStatus] = useState({ open: true, message: '' });
  const [popularItems, setPopularItems] = useState([]);
  const [cartBumpKey, setCartBumpKey] = useState(0);
  const prevCartCount = useRef(cartCount);

  useEffect(() => {
    loadMenu();
    checkForActiveOrder();
    loadAnnouncement();
    loadKitchenStatus();
    loadPopularItems();
  }, []);

  useEffect(() => {
    if (cartCount > prevCartCount.current) {
      setCartBumpKey(k => k + 1);
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  async function loadPopularItems() {
    const items = await settingsAPI.getPopularItems();
    setPopularItems(items || []);
  }

  async function loadAnnouncement() {
    try {
      const data = await settingsAPI.getAnnouncement();
      setAnnouncement(data);
    } catch {
      // optional
    }
  }

  async function loadKitchenStatus() {
    const data = await settingsAPI.getKitchenStatus();
    setKitchenStatus(data);
  }

  async function checkForActiveOrder() {
    try {
      const savedOrder = localStorage.getItem('muze_last_order');
      if (!savedOrder) return;
      const { orderId, timestamp } = JSON.parse(savedOrder);
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      if (timestamp < twoHoursAgo) {
        localStorage.removeItem('muze_last_order');
        return;
      }
      const order = await orderAPI.get(orderId);
      if (order && order.status !== 'completed' && order.status !== 'cancelled') {
        setActiveOrder(order);
      } else {
        localStorage.removeItem('muze_last_order');
      }
    } catch {
      localStorage.removeItem('muze_last_order');
    }
  }

  async function loadMenu() {
    try {
      setLoading(true);
      const [categoriesData, itemsData] = await Promise.all([
        menuAPI.getCategories(),
        menuAPI.getItems(),
      ]);
      setCategories(categoriesData || []);
      setMenuItems(itemsData || []);
    } catch (err) {
      setError('Failed to load menu. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = menuItems.filter(item =>
    !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedByCategory = categories
    .map(cat => ({
      ...cat,
      items: filteredItems.filter(item => item.category_id === cat.id),
    }))
    .filter(cat => cat.items.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GradientMesh />
        <div className="text-center">
          <Coffee className="w-12 h-12 text-muze-brown animate-pulse-soft mx-auto" />
          <p className="mt-4 text-muze-dark/70">Loading menu…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GradientMesh />
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={loadMenu} className="btn btn-primary">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 relative">
      <GradientMesh />

      {/* Active Order Banner — kept lightweight, sits above the hero */}
      {activeOrder && (
        <Link
          to={`/confirmation/${activeOrder.id}`}
          className="block bg-muze-dark text-muze-gold px-4 py-3 sticky top-0 z-50 shadow-md"
        >
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Receipt className="w-5 h-5" />
              <div>
                <p className="font-semibold">Order #{formatPickupNumber(activeOrder.pickup_number)}</p>
                <p className="text-sm opacity-80">
                  Status: {activeOrder.status === 'pending' ? 'Received' : activeOrder.status === 'preparing' ? 'Preparing' : 'Ready for pickup'}
                </p>
              </div>
            </div>
            <span className="text-sm font-medium">View →</span>
          </div>
        </Link>
      )}

      {/* Announcement & Closed banners */}
      {announcement.enabled && announcement.text && (
        <div className="bg-muze-gold text-muze-dark px-4 py-3 shadow-sm">
          <div className="max-w-3xl mx-auto flex items-start sm:items-center gap-3">
            <Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-sm sm:text-base font-medium leading-relaxed whitespace-pre-line">{announcement.text}</p>
          </div>
        </div>
      )}
      {!kitchenStatus.open && (
        <div className="bg-red-600 text-white px-4 py-3 shadow-sm">
          <div className="max-w-3xl mx-auto flex items-start sm:items-center gap-3">
            <Lock className="w-5 h-5 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-semibold">Online ordering is paused</p>
              <p className="text-sm text-red-50 leading-relaxed">
                {kitchenStatus.message || 'We\'re not accepting new orders right now. Please check back soon.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Glass Hero */}
      <HeroSection
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Sticky Category Nav */}
      {categories.length > 0 && (
        <div className="sticky top-0 z-30 backdrop-blur-md bg-muze-cream/60 border-b border-white/40">
          <div className="max-w-5xl mx-auto px-4">
            <CategoryNav
              categories={categories}
              selectedCategory={null}
              onSelectCategory={() => {}}
            />
          </div>
        </div>
      )}

      {/* Menu Items */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {searchQuery ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredItems.map((item, i) => (
              <MenuItemCard key={item.id} item={item} index={i} onClick={() => setSelectedItem(item)} />
            ))}
            {filteredItems.length === 0 && (
              <p className="col-span-full text-center text-muze-dark/60 py-12">
                No items found for "{searchQuery}"
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Most Popular — full-size grid, same as category sections */}
            {popularItems.length > 0 && (
              <section className="mb-10 scroll-mt-32">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-muze-brown" />
                  <h2 className="text-2xl font-bold text-muze-dark">Most Popular</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {popularItems.map((item, i) => (
                    <MenuItemCard key={`popular-${item.id}`} item={item} index={i} onClick={() => setSelectedItem(item)} />
                  ))}
                </div>
              </section>
            )}

            {groupedByCategory.map(cat => (
            <section key={cat.id} id={`cat-${cat.id}`} className="mb-10 scroll-mt-32">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-muze-dark">{cat.name}</h2>
                {cat.description && (
                  <p className="text-sm text-muze-dark/60 mt-1">{cat.description}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {cat.items.map((item, i) => (
                  <MenuItemCard key={item.id} item={item} index={i} onClick={() => setSelectedItem(item)} />
                ))}
              </div>
            </section>
            ))}
          </>
        )}

        {menuItems.length === 0 && (
          <div className="text-center py-16">
            <Coffee className="w-16 h-16 text-muze-brown/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muze-dark mb-2">No menu items yet</h3>
            <p className="text-muze-dark/60">Menu items will appear here once they're added.</p>
          </div>
        )}
      </main>

      {/* Sticky Cart Pill — always visible, glass treatment */}
      <div className="fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none animate-slide-up-bottom">
        <GlassPanel
          intensity="chrome"
          className="max-w-md mx-auto pointer-events-auto"
          panelClassName="px-2 py-2"
          onClick={() => (cartCount > 0 ? navigate('/cart') : setIsCartOpen(true))}
          overLight
        >
          <div className="flex items-center gap-3 cursor-pointer select-none">
            <span
              key={cartBumpKey}
              className={`relative w-12 h-12 rounded-full bg-muze-dark text-muze-gold flex items-center justify-center shadow-md flex-shrink-0 ${cartBumpKey > 0 ? 'animate-pop-bump' : ''}`}
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-muze-gold text-muze-dark text-xs flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-muze-dark leading-tight">
                {cartCount > 0 ? `${cartCount} item${cartCount === 1 ? '' : 's'} in cart` : 'Your cart is empty'}
              </p>
              <p className="text-xs text-muze-dark/60">
                {cartCount > 0 ? 'Tap to review' : 'Add something to get started'}
              </p>
            </div>
            <span className="text-lg font-bold text-muze-brown pr-2">
              {formatPriceFromDollars(cartTotal)}
            </span>
          </div>
        </GlassPanel>
      </div>

      {/* Modals */}
      {selectedItem && (
        <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
