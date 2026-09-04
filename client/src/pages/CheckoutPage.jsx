import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Mail, AlertCircle, CalendarClock, Loader2, Lock } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { orderAPI, settingsAPI } from '../utils/api';
import { formatPriceFromDollars } from '../utils/formatters';
import GradientMesh from '../components/glass/GradientMesh';
import SquareCardField from '../components/SquareCardField';
import PortalHomeLink from '../components/PortalHomeLink';
import { getPartnerSchedule } from '../utils/partnerSchedule';
import { calculateOrderTotals } from '../utils/pricing';

export default function CheckoutPage({
  basePath = '/cafe',
  channel = 'cafe',
  paymentProvider = 'Square',
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, cartTotal, customerName, setCustomerName, clearCart, getItemTotal } = useCart();

  const [name, setName] = useState(customerName);
  const [email, setEmail] = useState(localStorage.getItem('muze_customer_email') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => (
    searchParams.get('payment') === 'cancelled'
      ? 'Payment was cancelled. Your cart is still here when you are ready.'
      : null
  ));
  const [taxRate, setTaxRate] = useState(0.0825);
  const [kitchenStatus, setKitchenStatus] = useState({ open: true, message: '' });
  const orderSubmittedRef = useRef(false);
  const idempotencyKeyRef = useRef(null);
  const paymentAttemptKeyRef = useRef(null);
  const squareTokenRef = useRef(null);
  const squareCardRef = useRef(null);
  const handleSquareReady = useCallback(card => {
    squareCardRef.current = card;
  }, []);

  useEffect(() => {
    settingsAPI.getTaxRate(channel).then(rate => setTaxRate(rate)).catch(() => {});
    settingsAPI.getKitchenStatus().then(setKitchenStatus).catch(() => {});
  }, [channel]);

  const taxIncluded = channel === 'partner_meal';
  const { subtotal, tax, total } = calculateOrderTotals(cartTotal, taxRate, { taxIncluded });
  const preorderSchedule = channel === 'partner_meal'
    ? getPartnerSchedule(items[0]?.menu_week)
    : null;

  useEffect(() => {
    if (items.length === 0 && !orderSubmittedRef.current) {
      navigate(basePath);
    }
  }, [basePath, items.length, navigate]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (loading) return;
    setLoading(true);
    setError(null);

    if (!name.trim()) { setError('Please enter your name'); setLoading(false); return; }
    if (!email.trim()) { setError('Please enter your email'); setLoading(false); return; }
    if (items.length === 0) { setError('Your cart is empty'); setLoading(false); return; }
    if (!kitchenStatus.open) {
      setError(kitchenStatus.message || 'Online ordering is paused. Please try again soon.');
      setLoading(false);
      return;
    }
    if (preorderSchedule?.closed) {
      setError('Weekly meal pre-orders closed Wednesday at 12:00 PM Pacific.');
      setLoading(false);
      return;
    }

    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      if (!paymentAttemptKeyRef.current) {
        paymentAttemptKeyRef.current = typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const orderData = {
        customerName: name.trim(),
        email: email.trim(),
        channel,
        items: items.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          special_instructions: item.specialInstructions || null,
          modifiers: item.modifiers?.map(mod => ({
            modifier_option_id: mod.id,
          })) || [],
        })),
      };

      if (channel === 'cafe') {
        if (!squareCardRef.current) throw new Error('Secure Square payment is not ready yet');
        if (!squareTokenRef.current) {
          const tokenResult = await squareCardRef.current.tokenize();
          if (tokenResult.status !== 'OK' || !tokenResult.token) {
            const detail = tokenResult.errors?.[0]?.detail;
            throw new Error(detail || 'Please check your card details and try again');
          }
          squareTokenRef.current = tokenResult.token;
        }
        orderData.paymentSourceToken = squareTokenRef.current;
      }

      const result = await orderAPI.create(
        orderData,
        idempotencyKeyRef.current,
        paymentAttemptKeyRef.current,
      );
      orderSubmittedRef.current = true;
      setCustomerName(name.trim());
      localStorage.setItem('muze_customer_email', email.trim());
      localStorage.setItem(`muze_last_order_${channel}`, JSON.stringify({
        orderId: result.id,
        pickupNumber: result.pickup_number,
        timestamp: Date.now(),
      }));
      if (result.checkout_url) {
        window.location.assign(result.checkout_url);
        return;
      }
      clearCart();
      navigate(`/orders/${result.id}`, { replace: true });
    } catch (err) {
      console.error('Order failed:', err);
      if (err.status === 402) {
        paymentAttemptKeyRef.current = null;
        squareTokenRef.current = null;
      }
      setError(err.message || 'Failed to place order. Please try again.');
    } finally {
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
            onClick={() => navigate(`${basePath}/cart`)}
            className="w-11 h-11 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-colors"
            aria-label="Back to cart"
          >
            <ArrowLeft className="w-5 h-5 text-muze-dark" />
          </button>
          <h1 className="text-2xl font-bold text-muze-dark">Checkout</h1>
          <PortalHomeLink className="ml-auto" label="Home" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {preorderSchedule ? (
          <div className={`mb-6 rounded-2xl border p-5 ${preorderSchedule.closed ? 'border-red-200 bg-red-50' : 'border-muze-gold/40 bg-amber-50'}`}>
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-6 w-6 flex-shrink-0 text-muze-brown" />
              <div>
                <p className="font-bold text-muze-dark">Weekly meal pre-order</p>
                <p className="mt-1 text-sm text-muze-dark/75">Order by {preorderSchedule.deadlineLabel}.</p>
                <p className="text-sm text-muze-dark/75">Delivered to Muze for pickup {preorderSchedule.deliveryLabel}.</p>
                <p className="mt-2 text-sm text-muze-dark/65">This is prepared ahead for Monday, not an immediate café order.</p>
              </div>
            </div>
          </div>
        ) : null}

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
              {preorderSchedule ? 'We’ll use this name for your Monday pickup.' : 'We’ll call this name when your order is ready.'}
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
              Email <span className="text-red-600 font-normal text-sm">(required)</span>
            </h3>
            <p className="text-sm text-muze-dark/60 mb-4">
              {preorderSchedule ? 'Your receipt and Monday pickup notifications will be sent here.' : 'Get notified when your order is ready for pickup.'}
            </p>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-muze-gold focus:outline-none transition-colors text-lg"
              disabled={loading}
            />
          </div>

          {channel === 'cafe' ? <SquareCardField onReady={handleSquareReady} /> : null}

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
                <span>{taxIncluded ? 'Subtotal before tax' : 'Subtotal'}</span>
                <span>{formatPriceFromDollars(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muze-dark/70">
                <span>{taxIncluded ? 'Nevada tax (included)' : 'Tax'}</span>
                <span>{formatPriceFromDollars(tax)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t border-muze-gold/20">
                <span className="text-muze-dark">Total</span>
                <span className="text-muze-brown">{formatPriceFromDollars(total)}</span>
              </div>
            </div>
          </div>

          {/* Provider-aware online payment */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 mb-5">
            <p className="text-amber-900 text-sm text-center">
            <strong>{preorderSchedule ? 'Weekly pre-order for Monday pickup at Muze.' : 'Pickup at Muze.'}</strong> Your payment will be processed securely through {paymentProvider}.
            {taxIncluded ? ' All listed meal prices include Nevada sales tax.' : ''}
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
          disabled={loading || !name.trim() || !email.trim() || !kitchenStatus.open || preorderSchedule?.closed}
          className="w-full max-w-2xl mx-auto block py-4 rounded-2xl bg-muze-dark text-muze-gold font-bold text-lg hover:bg-muze-brown hover:text-white transition-colors shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Placing Order…</>
          ) : !kitchenStatus.open ? (
            <><Lock className="w-5 h-5" /> Ordering paused</>
          ) : preorderSchedule?.closed ? (
            <><Lock className="w-5 h-5" /> Pre-orders closed</>
          ) : (
            <>Continue to {paymentProvider} · {formatPriceFromDollars(total)}</>
          )}
        </button>
      </div>
    </div>
  );
}
