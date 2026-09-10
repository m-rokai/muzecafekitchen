import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Mail, AlertCircle, Loader2, Lock } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { orderAPI, settingsAPI } from '../utils/api';
import { formatPriceFromDollars } from '../utils/formatters';
import GradientMesh from '../components/glass/GradientMesh';
import SquareCardField from '../components/SquareCardField';
import { calculateOrderTotals } from '../utils/pricing';
import CafeBrandLockup from '../components/CafeBrandLockup';

const CHECKOUT_ATTEMPT_STORAGE_KEY = 'muze_square_checkout_attempt';

function newCheckoutKey(prefix) {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readStoredCheckoutAttempt() {
  try {
    return JSON.parse(sessionStorage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function storeCheckoutAttempt(attempt) {
  try {
    if (attempt) sessionStorage.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
    else sessionStorage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
  } catch {
    // Checkout still works when storage is unavailable; only refresh recovery is reduced.
  }
}

export default function CheckoutPage() {
  const basePath = '/cafe';
  const channel = 'cafe';
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
  const [squareReady, setSquareReady] = useState(false);
  const orderSubmittedRef = useRef(false);
  const idempotencyKeyRef = useRef(null);
  const paymentAttemptKeyRef = useRef(null);
  const squareTokenRef = useRef(null);
  const squareCardRef = useRef(null);
  const handleSquareReady = useCallback(card => {
    squareCardRef.current = card;
    setSquareReady(Boolean(card));
  }, []);

  useEffect(() => {
    settingsAPI.getTaxRate().then(rate => setTaxRate(rate)).catch(() => {});
    settingsAPI.getKitchenStatus().then(setKitchenStatus).catch(() => {});
  }, []);

  const { subtotal, tax, total } = calculateOrderTotals(cartTotal, taxRate);

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
    try {
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
      const requestSignature = JSON.stringify(orderData);
      const stored = readStoredCheckoutAttempt();
      const requestMatchesStoredAttempt = stored?.requestSignature === requestSignature;
      if (!idempotencyKeyRef.current || !paymentAttemptKeyRef.current || !requestMatchesStoredAttempt) {
        if (requestMatchesStoredAttempt
          && stored.idempotencyKey && stored.paymentAttemptKey) {
          idempotencyKeyRef.current = stored.idempotencyKey;
          paymentAttemptKeyRef.current = stored.paymentAttemptKey;
        } else {
          idempotencyKeyRef.current = newCheckoutKey('order');
          paymentAttemptKeyRef.current = newCheckoutKey('payment');
        }
        storeCheckoutAttempt({
          requestSignature,
          idempotencyKey: idempotencyKeyRef.current,
          paymentAttemptKey: paymentAttemptKeyRef.current,
        });
      }

      if (!squareCardRef.current) throw new Error('Secure Square payment is not ready yet');
      if (!squareTokenRef.current) {
        const [givenName, ...familyNameParts] = name.trim().split(/\s+/);
        const tokenResult = await squareCardRef.current.tokenize({
          amount: total.toFixed(2),
          billingContact: {
            givenName,
            familyName: familyNameParts.join(' ') || undefined,
            email: email.trim(),
            countryCode: 'US',
          },
          currencyCode: 'USD',
          intent: 'CHARGE',
          customerInitiated: true,
          sellerKeyedIn: false,
        });
        if (tokenResult.status !== 'OK' || !tokenResult.token) {
          const detail = tokenResult.errors?.[0]?.detail;
          throw new Error(detail || 'Please check your card details and try again');
        }
        squareTokenRef.current = tokenResult.token;
      }
      orderData.paymentSourceToken = squareTokenRef.current;

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
      storeCheckoutAttempt(null);
      clearCart();
      navigate(`/orders/${result.id}`, { replace: true });
    } catch (err) {
      console.error('Order failed:', err);
      if (err.status === 402) {
        paymentAttemptKeyRef.current = newCheckoutKey('payment');
        squareTokenRef.current = null;
        const stored = readStoredCheckoutAttempt();
        if (stored?.requestSignature && idempotencyKeyRef.current) {
          storeCheckoutAttempt({
            ...stored,
            idempotencyKey: idempotencyKeyRef.current,
            paymentAttemptKey: paymentAttemptKeyRef.current,
          });
        }
      } else if (err.status === 409) {
        idempotencyKeyRef.current = null;
        paymentAttemptKeyRef.current = null;
        squareTokenRef.current = null;
        storeCheckoutAttempt(null);
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
          <CafeBrandLockup compact className="ml-auto hidden sm:inline-flex" />
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
              We’ll call this name when your order is ready.
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
              Get notified when your order is ready for pickup.
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

          <SquareCardField onReady={handleSquareReady} />

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
                <span>{formatPriceFromDollars(subtotal)}</span>
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

          {/* Online payment */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 mb-5">
            <p className="text-amber-900 text-sm text-center">
            <strong>Pickup at Muze.</strong> Your payment will be processed securely through Square.
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
          disabled={loading || !squareReady || !name.trim() || !email.trim() || !kitchenStatus.open}
          className="w-full max-w-2xl mx-auto block py-4 rounded-2xl bg-muze-dark text-muze-gold font-bold text-lg hover:bg-muze-brown hover:text-white transition-colors shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Placing Order…</>
          ) : !kitchenStatus.open ? (
            <><Lock className="w-5 h-5" /> Ordering paused</>
          ) : !squareReady ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Loading secure payment…</>
          ) : (
            <>Continue to Square · {formatPriceFromDollars(total)}</>
          )}
        </button>
      </div>
    </div>
  );
}
