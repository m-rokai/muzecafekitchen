import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, AlertCircle, Loader2, Lock } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { orderAPI, paymentsAPI, settingsAPI } from '../utils/api';
import { formatPriceFromDollars } from '../utils/formatters';
import GradientMesh from '../components/glass/GradientMesh';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, cartTotal, customerName, setCustomerName, clearCart, getItemTotal } = useCart();

  const [name, setName] = useState(customerName);
  const [email, setEmail] = useState(localStorage.getItem('muze_customer_email') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [taxRate, setTaxRate] = useState(0.0825);
  const [kitchenStatus, setKitchenStatus] = useState({ open: true, message: '' });
  const orderSubmittedRef = useRef(false);

  useEffect(() => {
    settingsAPI.getTaxRate().then(rate => setTaxRate(rate)).catch(() => {});
    settingsAPI.getKitchenStatus().then(setKitchenStatus).catch(() => {});
  }, []);

  const tax = cartTotal * taxRate;
  const total = cartTotal + tax;

  useEffect(() => {
    if (items.length === 0 && !orderSubmittedRef.current) {
      navigate('/');
    }
  }, [items.length, navigate]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (loading) return;
    setLoading(true);
    setError(null);

    if (!name.trim()) { setError('Please enter your name'); setLoading(false); return; }
    if (items.length === 0) { setError('Your cart is empty'); setLoading(false); return; }
    if (!kitchenStatus.open) {
      setError(kitchenStatus.message || 'Online ordering is paused. Please try again soon.');
      setLoading(false);
      return;
    }

    try {
      const orderData = {
        customerName: name.trim(),
        email: email.trim() || null,
        subtotal: cartTotal,
        tax,
        total,
        items: items.map(item => ({
          menu_item_id: item.id,
          item_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: getItemTotal(item),
          special_instructions: item.specialInstructions || null,
          modifiers: item.modifiers?.map(mod => ({
            modifier_name: mod.display_name || mod.name,
            price_adjustment: mod.price_adjustment || 0,
          })) || [],
        })),
      };

      const result = await orderAPI.create(orderData);
      orderSubmittedRef.current = true;
      setCustomerName(name.trim());
      if (email.trim()) localStorage.setItem('muze_customer_email', email.trim());

      // Hand off to Stripe-hosted Checkout. The cart is cleared on the
      // confirmation page only after payment succeeds (cancel returns here
      // with the cart intact). Payment success -> webhook -> kitchen + email.
      const { url } = await paymentsAPI.createCheckoutSession(result.id);
      window.location.href = url;
    } catch (err) {
      console.error('Checkout failed:', err);
      setError(err.message || 'Failed to start checkout. Please try again.');
      orderSubmittedRef.current = false;
      setLoading(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="min-h-screen pb-32 relative">
      <GradientMesh />

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/70 border-b border-white/40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/cart')}
            className="w-11 h-11 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-colors"
            aria-label="Back to cart"
          >
            <ArrowLeft className="w-5 h-5 text-muze-dark" />
          </button>
          <h1 className="text-2xl font-bold text-muze-dark">Checkout</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Kitchen Closed Banner */}
        {!kitchenStatus.open && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
            <Lock className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Online ordering is paused</p>
              <p className="text-sm text-red-700 mt-1">
                {kitchenStatus.message || 'We\'re not accepting new orders right now. Please check back soon.'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="rounded-2xl bg-white border border-muze-gold/20 shadow-sm p-6 mb-5">
            <h3 className="font-bold text-muze-dark text-lg mb-1 flex items-center gap-2">
              <User className="w-5 h-5 text-muze-brown" />
              Your Name
            </h3>
            <p className="text-sm text-muze-dark/60 mb-4">
              We'll call this name when your order is ready.
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-muze-gold focus:outline-none transition-colors text-lg"
              autoFocus
              disabled={loading}
            />
          </div>

          {/* Email */}
          <div className="rounded-2xl bg-white border border-muze-gold/20 shadow-sm p-6 mb-5">
            <h3 className="font-bold text-muze-dark text-lg mb-1 flex items-center gap-2">
              <Mail className="w-5 h-5 text-muze-brown" />
              Email <span className="text-muze-dark/40 font-normal text-sm">(optional)</span>
            </h3>
            <p className="text-sm text-muze-dark/60 mb-4">
              Get notified when your order is ready for pickup.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-muze-gold focus:outline-none transition-colors text-lg"
              disabled={loading}
            />
          </div>

          {/* Order Review */}
          <div className="rounded-2xl bg-white border border-muze-gold/20 shadow-sm p-6 mb-5">
            <h3 className="font-bold text-muze-dark text-lg mb-4">Order Review</h3>
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.cartId} className="flex justify-between gap-3 pb-3 border-b border-muze-gold/10 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-muze-dark">
                      {item.quantity}× {item.name}
                    </p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-sm text-muze-dark/60 mt-0.5">
                        {item.modifiers.map(m => m.display_name || m.name).join(', ')}
                      </p>
                    )}
                    {item.specialInstructions && (
                      <p className="text-sm text-muze-dark/40 italic mt-0.5">
                        "{item.specialInstructions}"
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-muze-dark whitespace-nowrap">
                    {formatPriceFromDollars(getItemTotal(item))}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-5 border-t border-muze-gold/20 space-y-2">
              <div className="flex justify-between text-muze-dark/70">
                <span>Subtotal</span>
                <span>{formatPriceFromDollars(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-muze-dark/70">
                <span>Tax</span>
                <span>{formatPriceFromDollars(tax)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t border-muze-gold/20">
                <span className="text-muze-dark">Total</span>
                <span className="text-muze-brown">{formatPriceFromDollars(total)}</span>
              </div>
            </div>
          </div>

          {/* Card payment */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 mb-5">
            <p className="text-amber-900 text-sm text-center">
              <strong>Secure card payment.</strong> You'll pay by card on the next step. We start your order once payment is confirmed.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 rounded-2xl border border-red-200 mb-5 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </form>
      </main>

      {/* Sticky CTA */}
      <div className="fixed bottom-4 left-0 right-0 px-4 z-40">
        <button
          onClick={handleSubmit}
          disabled={loading || !name.trim() || !kitchenStatus.open}
          className="w-full max-w-2xl mx-auto block py-4 rounded-2xl bg-muze-dark text-muze-gold font-bold text-lg hover:bg-muze-brown hover:text-white transition-colors shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to payment…</>
          ) : !kitchenStatus.open ? (
            <><Lock className="w-5 h-5" /> Ordering paused</>
          ) : (
            <>Continue to Payment · {formatPriceFromDollars(total)}</>
          )}
        </button>
      </div>
    </div>
  );
}
