import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Loader2, ShoppingCart, UtensilsCrossed } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { menuAPI } from '../utils/api';
import { useCart } from '../context/CartContext';
import { formatPriceFromDollars } from '../utils/formatters';
import MenuItemCard from '../components/Menu/MenuItemCard';
import ItemModal from '../components/Menu/ItemModal';
import GradientMesh from '../components/glass/GradientMesh';
import GlassPanel from '../components/glass/GlassPanel';
import PortalHomeLink from '../components/PortalHomeLink';
import { getPartnerSchedule } from '../utils/partnerSchedule';

export default function PartnerMealsPage() {
  const navigate = useNavigate();
  const { cartCount, cartTotal } = useCart();
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartBumpKey, setCartBumpKey] = useState(0);
  const previousCartCount = useRef(cartCount);

  useEffect(() => {
    let active = true;
    menuAPI.getItems('partner_meal')
      .then(data => {
        if (active) setItems(data || []);
      })
      .catch(err => {
        console.error('Failed to load partner menu:', err);
        if (active) setError('The weekly partner menu is unavailable right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (cartCount > previousCartCount.current) setCartBumpKey(key => key + 1);
    previousCartCount.current = cartCount;
  }, [cartCount]);

  const schedule = getPartnerSchedule(items[0]?.menu_week);

  return (
    <div className="min-h-screen pb-32 relative">
      <GradientMesh />
      <header className="relative z-10 px-4 pt-5">
        <div className="max-w-5xl mx-auto">
          <PortalHomeLink />
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-6">
        <GlassPanel intensity="hero" panelClassName="p-7 sm:p-9" overLight>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <span className="w-16 h-16 rounded-2xl bg-muze-dark text-muze-gold flex items-center justify-center flex-shrink-0">
              <UtensilsCrossed className="w-8 h-8" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muze-brown">Weekly meal pre-order</p>
              <h1 className="mt-1 text-3xl sm:text-4xl font-black text-muze-dark">Reserve next Monday’s meals</h1>
              <p className="mt-2 text-muze-dark/70">Choose from six vegetarian, chicken, and beef meals from Down to Earth Cuisine. Each meal is $20.59 total, including $1.59 Nevada sales tax.</p>
            </div>
          </div>
        </GlassPanel>

        {schedule ? (
          <div className={`mt-5 grid gap-3 rounded-2xl border p-5 sm:grid-cols-2 ${schedule.closed ? 'border-red-200 bg-red-50/90' : 'border-muze-gold/40 bg-amber-50/90'}`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muze-brown">Order deadline</p>
              <p className="mt-1 font-bold text-muze-dark">{schedule.deadlineLabel}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muze-brown">Delivered to Muze for pickup</p>
              <p className="mt-1 font-bold text-muze-dark">{schedule.deliveryLabel}</p>
            </div>
            <p className="sm:col-span-2 text-sm text-muze-dark/70">
              {schedule.closed
                ? 'This week’s pre-order window is closed. The next six-meal menu will appear after the weekly refresh.'
                : 'These meals are prepared ahead and delivered together on Monday; they are not available for immediate café pickup.'}
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-white/75 p-4 text-sm text-muze-dark/70 shadow-sm backdrop-blur-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
          <p>
            <strong className="text-muze-dark">Allergy notice:</strong> Tags cover FDA major allergens inferred from the partner’s published dish name and ingredients and may be incomplete. If you have a food allergy, ask Muze staff to confirm ingredients and cross-contact risk with the partner before ordering.
          </p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-9 h-9 animate-spin text-muze-brown" /></div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-3xl bg-white/80 border border-white shadow-sm p-10 text-center">
            <CalendarDays className="w-14 h-14 mx-auto text-muze-brown/40" />
            <h2 className="mt-4 text-2xl font-bold text-muze-dark">The next menu is being prepared</h2>
            <p className="mt-2 text-muze-dark/60">Weekly options will appear here after they are imported and approved.</p>
          </div>
        ) : (
          <section className="mt-7">
            {schedule ? (
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm font-semibold text-muze-dark/70 shadow-sm backdrop-blur-sm">
                <CalendarDays className="h-4 w-4 text-muze-brown" />
                Six-meal menu · delivery {schedule.deliveryLabel}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, index) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  disabled={schedule?.closed}
                  onClick={() => setSelectedItem(item)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none">
        <button
          type="button"
          onClick={() => navigate('/partner-meals/cart')}
          className="pointer-events-auto w-full max-w-md mx-auto rounded-2xl bg-muze-dark text-muze-gold shadow-2xl px-4 py-3 flex items-center gap-3 disabled:opacity-60"
          disabled={cartCount === 0 || schedule?.closed}
        >
          <span key={cartBumpKey} className={`relative w-11 h-11 rounded-full bg-muze-gold text-muze-dark flex items-center justify-center ${cartBumpKey ? 'animate-pop-bump' : ''}`}>
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 ? <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-white text-muze-dark text-xs font-bold flex items-center justify-center">{cartCount}</span> : null}
          </span>
          <span className="flex-1 text-left font-bold">
            {schedule?.closed ? 'Pre-orders closed for this week' : cartCount ? 'Review weekly pre-order' : 'Choose a meal to begin'}
          </span>
          <span className="font-black">{formatPriceFromDollars(cartTotal)}</span>
        </button>
      </div>

      {selectedItem ? <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} /> : null}
    </div>
  );
}
