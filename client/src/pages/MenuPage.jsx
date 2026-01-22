import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, Search, Coffee, Receipt } from 'lucide-react';
import { menuAPI, orderAPI } from '../utils/api';
import { useCart } from '../context/CartContext';
import { formatPriceFromDollars, formatPickupNumber } from '../utils/formatters';
import CategoryNav from '../components/Menu/CategoryNav';
import MenuItemCard from '../components/Menu/MenuItemCard';
import ItemModal from '../components/Menu/ItemModal';
import CartDrawer from '../components/Cart/CartDrawer';

export default function MenuPage() {
  const navigate = useNavigate();
  const { cartCount, cartTotal } = useCart();

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);

  useEffect(() => {
    loadMenu();
    checkForActiveOrder();
  }, []);

  // Check if customer has an active order they can return to
  async function checkForActiveOrder() {
    try {
      const savedOrder = localStorage.getItem('muze_last_order');
      if (!savedOrder) return;

      const { orderId, timestamp } = JSON.parse(savedOrder);

      // Only show orders from the last 2 hours
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      if (timestamp < twoHoursAgo) {
        localStorage.removeItem('muze_last_order');
        return;
      }

      // Verify the order still exists and isn't completed
      const order = await orderAPI.get(orderId);
      if (order && order.status !== 'completed' && order.status !== 'cancelled') {
        setActiveOrder(order);
      } else {
        localStorage.removeItem('muze_last_order');
      }
    } catch (err) {
      // Order not found or error, clear localStorage
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
      const categories = categoriesData || [];
      const items = itemsData || [];
      setCategories(categories);
      setMenuItems(items);
      if (categories.length > 0) {
        setSelectedCategory(categories[0].id);
      }
    } catch (err) {
      setError('Failed to load menu. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = !selectedCategory || item.category_id === selectedCategory;
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Build a map of category names to their descriptions
  const categoryDescriptions = categories.reduce((acc, cat) => {
    acc[cat.name] = cat.description;
    return acc;
  }, {});

  const groupedItems = filteredItems.reduce((acc, item) => {
    const categoryName = item.category_name || 'Other';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muze-cream">
        <div className="text-center">
          <img src="/logo.png" alt="Muze Café" className="h-16 mx-auto animate-pulse-soft" />
          <p className="mt-4 text-muze-brown">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muze-cream">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={loadMenu} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muze-cream pb-24">
      {/* Active Order Banner */}
      {activeOrder && (
        <Link
          to={`/confirmation/${activeOrder.id}`}
          className="block bg-muze-gold text-muze-dark px-4 py-3 sticky top-0 z-50"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Receipt className="w-5 h-5" />
              <div>
                <p className="font-semibold">Order #{formatPickupNumber(activeOrder.pickup_number)}</p>
                <p className="text-sm opacity-80">
                  Status: {activeOrder.status === 'pending' ? 'Received' : activeOrder.status === 'preparing' ? 'Preparing' : 'Ready for pickup'}
                </p>
              </div>
            </div>
            <span className="text-sm font-medium">View Order →</span>
          </div>
        </Link>
      )}

      {/* Header */}
      <header className="bg-muze-dark sticky top-0 z-40" style={{ top: activeOrder ? '60px' : '0' }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Muze Café" className="h-10" />
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-muze-gold text-muze-dark text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Tagline */}
          <p className="text-muze-gold/80 text-sm mt-1">Order ahead, skip the line</p>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muze-gold/50" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/10 text-white placeholder-muze-gold/50 border border-muze-gold/30 focus:border-muze-gold focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Category Navigation */}
        <CategoryNav
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </header>

      {/* Menu Items */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {searchQuery ? (
          // Flat list when searching
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <MenuItemCard
                key={item.id}
                item={item}
                onClick={() => setSelectedItem(item)}
              />
            ))}
            {filteredItems.length === 0 && (
              <p className="col-span-full text-center text-muze-brown/60 py-8">
                No items found for "{searchQuery}"
              </p>
            )}
          </div>
        ) : (
          // Grouped by category
          Object.entries(groupedItems).map(([categoryName, items]) => (
            <section key={categoryName} className="mb-8">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-muze-dark">{categoryName}</h2>
                {categoryDescriptions[categoryName] && (
                  <p className="text-sm text-muze-brown/70 mt-1">{categoryDescriptions[categoryName]}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(item => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {menuItems.length === 0 && (
          <div className="text-center py-12">
            <Coffee className="w-16 h-16 text-muze-gold/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muze-dark mb-2">No menu items yet</h3>
            <p className="text-muze-brown/60">
              Menu items will appear here once they're added.
            </p>
          </div>
        )}
      </main>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-muze-cream to-transparent pointer-events-none">
          <button
            onClick={() => navigate('/cart')}
            className="w-full max-w-lg mx-auto btn btn-primary py-4 flex items-center justify-between pointer-events-auto shadow-lg"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              View Cart ({cartCount} items)
            </span>
            <span className="font-semibold">{formatPriceFromDollars(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Item Modal */}
      {selectedItem && (
        <ItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />
    </div>
  );
}
