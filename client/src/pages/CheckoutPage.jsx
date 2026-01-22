import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { orderAPI, settingsAPI } from '../utils/api';
import { formatPriceFromDollars } from '../utils/formatters';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, cartTotal, customerName, setCustomerName, clearCart, getItemTotal } = useCart();

  const [name, setName] = useState(customerName);
  const [email, setEmail] = useState(localStorage.getItem('muze_customer_email') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [taxRate, setTaxRate] = useState(0.0825);
  const orderSubmittedRef = useRef(false);

  useEffect(() => {
    settingsAPI.getTaxRate().then(rate => setTaxRate(rate)).catch(() => {});
  }, []);

  const tax = cartTotal * taxRate;
  const total = cartTotal + tax;

  // Redirect if cart is empty (using useEffect to avoid render-time navigation)
  // But don't redirect if we just submitted an order
  useEffect(() => {
    if (items.length === 0 && !orderSubmittedRef.current) {
      navigate('/');
    }
  }, [items.length, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // IMMEDIATELY set loading to prevent double submissions
    // (before any async operations or validation)
    if (loading) return; // Extra guard against rapid clicks
    setLoading(true);
    setError(null);

    if (!name.trim()) {
      setError('Please enter your name');
      setLoading(false);
      return;
    }

    if (items.length === 0) {
      setError('Your cart is empty');
      setLoading(false);
      return;
    }

    try {
      // Build order data
      const orderData = {
        customerName: name.trim(),
        email: email.trim() || null,
        subtotal: cartTotal,
        tax: tax,
        total: total,
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

      // Mark order as submitted to prevent redirect to home
      orderSubmittedRef.current = true;

      // Save customer name and email for future orders
      setCustomerName(name.trim());
      if (email.trim()) {
        localStorage.setItem('muze_customer_email', email.trim());
      }

      // Save order to localStorage so customer can return to it
      localStorage.setItem('muze_last_order', JSON.stringify({
        orderId: result.id,
        pickupNumber: result.pickup_number,
        timestamp: Date.now(),
      }));

      // Clear cart on successful order (before navigation to prevent race conditions)
      clearCart();

      // Navigate to confirmation page
      navigate(`/confirmation/${result.id}`, { replace: true });
    } catch (err) {
      console.error('Order failed:', err);
      setError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show nothing while redirecting
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/cart')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">Checkout</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {/* Name Input */}
        <form onSubmit={handleSubmit}>
          <div className="card p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Your Name
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              We'll call this name when your order is ready.
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="input text-lg"
              autoFocus
              disabled={loading}
            />
          </div>

          {/* Email Input (Optional) */}
          <div className="card p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email <span className="text-gray-400 font-normal text-sm">(optional)</span>
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Get notified when your order is ready for pickup.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input text-lg"
              disabled={loading}
            />
          </div>

          {/* Order Review */}
          <div className="card p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Order Review</h3>
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.cartId} className="flex justify-between pb-3 border-b last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">
                      {item.quantity}x {item.name}
                    </p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-sm text-gray-500">
                        {item.modifiers.map(m => m.display_name || m.name).join(', ')}
                      </p>
                    )}
                    {item.specialInstructions && (
                      <p className="text-sm text-gray-400 italic">
                        "{item.specialInstructions}"
                      </p>
                    )}
                  </div>
                  <span className="font-medium">
                    {formatPriceFromDollars(getItemTotal(item))}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatPriceFromDollars(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{formatPriceFromDollars(tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                <span>Total</span>
                <span className="text-muze-accent">{formatPriceFromDollars(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Notice */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 mb-6">
            <p className="text-amber-800 text-sm text-center">
              <strong>Pay at pickup:</strong> You'll pay when you pick up your order at Muze Office.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 mb-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </form>
      </main>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="w-full btn btn-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Placing Order...
              </>
            ) : (
              <>Place Order - {formatPriceFromDollars(total)}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
