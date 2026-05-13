import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { settingsAPI } from '../utils/api';
import { formatPriceFromDollars } from '../utils/formatters';
import GradientMesh from '../components/glass/GradientMesh';
import GlassPanel from '../components/glass/GlassPanel';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, cartTotal, updateQuantity, removeItem, getItemTotal } = useCart();
  const [taxRate, setTaxRate] = useState(0.0825);

  useEffect(() => {
    settingsAPI.getTaxRate().then(setTaxRate).catch(() => {});
  }, []);

  const tax = cartTotal * taxRate;
  const total = cartTotal + tax;

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <GradientMesh />
        <div className="text-center p-8 relative z-10">
          <ShoppingBag className="w-16 h-16 text-muze-brown/40 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-muze-dark mb-2">Your cart is empty</h2>
          <p className="text-muze-dark/60 mb-6">Add something delicious to get started.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-full bg-muze-dark text-muze-gold font-semibold hover:bg-muze-brown hover:text-white transition-colors shadow-md"
          >
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 relative">
      <GradientMesh />

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/60 border-b border-white/40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-11 h-11 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-colors"
            aria-label="Back to menu"
          >
            <ArrowLeft className="w-5 h-5 text-muze-dark" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-muze-dark">Your Cart</h1>
            <p className="text-sm text-muze-dark/60">
              {items.length} item{items.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Cart Items */}
        <div className="space-y-3 mb-6">
          {items.map(item => (
            <div key={item.cartId} className="rounded-2xl bg-white/80 backdrop-blur-sm border border-white/70 shadow-sm p-5">
              <div className="flex justify-between items-start gap-3">
                <h3 className="font-bold text-muze-dark text-lg leading-tight">{item.name}</h3>
                <button
                  onClick={() => removeItem(item.cartId)}
                  className="text-muze-dark/40 hover:text-red-500 transition-colors p-1"
                  aria-label="Remove"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {item.modifiers && item.modifiers.length > 0 && (
                <div className="text-sm text-muze-dark/60 mt-1">
                  {item.modifiers.map((mod, i) => (
                    <span key={mod.id}>
                      {mod.display_name || mod.name}
                      {mod.price_adjustment > 0 && (
                        <span className="text-muze-brown"> +{formatPriceFromDollars(mod.price_adjustment)}</span>
                      )}
                      {i < item.modifiers.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              )}

              {item.specialInstructions && (
                <p className="text-sm text-muze-dark/50 italic mt-2 bg-muze-cream/60 rounded-lg px-3 py-2">
                  "{item.specialInstructions}"
                </p>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-muze-gold/10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                    className="w-11 h-11 rounded-full border-2 border-muze-gold/30 flex items-center justify-center hover:border-muze-gold hover:bg-muze-gold/10 transition-colors"
                    aria-label="Decrease"
                  >
                    <Minus className="w-4 h-4 text-muze-dark" />
                  </button>
                  <span className="w-9 text-center text-xl font-bold text-muze-dark">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                    className="w-11 h-11 rounded-full border-2 border-muze-gold/30 flex items-center justify-center hover:border-muze-gold hover:bg-muze-gold/10 transition-colors"
                    aria-label="Increase"
                  >
                    <Plus className="w-4 h-4 text-muze-dark" />
                  </button>
                </div>
                <span className="text-2xl font-bold text-muze-brown">
                  {formatPriceFromDollars(getItemTotal(item))}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Add more */}
        <button
          onClick={() => navigate('/')}
          className="w-full py-4 text-muze-brown font-semibold rounded-2xl border-2 border-dashed border-muze-brown/30 hover:border-muze-brown hover:bg-muze-brown/5 transition-colors mb-6"
        >
          + Add more items
        </button>

        {/* Order Summary in Glass */}
        <GlassPanel intensity="chrome" panelClassName="p-6" overLight>
          <h3 className="font-bold text-muze-dark text-lg mb-4">Order Summary</h3>
          <div className="space-y-3 text-muze-dark/80">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-medium">{formatPriceFromDollars(cartTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax ({(taxRate * 100).toFixed(2)}%)</span>
              <span className="font-medium">{formatPriceFromDollars(tax)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-muze-gold/30 text-muze-dark text-xl font-bold">
              <span>Total</span>
              <span className="text-muze-brown">{formatPriceFromDollars(total)}</span>
            </div>
          </div>
        </GlassPanel>

        {/* Pay-at-pickup */}
        <div className="mt-5 p-4 bg-amber-50/80 rounded-2xl border border-amber-200">
          <p className="text-amber-900 text-sm text-center">
            <strong>Pay at pickup.</strong> Settle up when you collect your order at Muze Office.
          </p>
        </div>
      </main>

      {/* Sticky Checkout CTA */}
      <div className="fixed bottom-4 left-0 right-0 px-4 z-40">
        <button
          onClick={() => navigate('/checkout')}
          className="w-full max-w-2xl mx-auto block py-4 rounded-2xl bg-muze-dark text-muze-gold font-bold text-lg hover:bg-muze-brown hover:text-white transition-colors shadow-2xl"
        >
          Continue to Checkout · {formatPriceFromDollars(total)}
        </button>
      </div>
    </div>
  );
}
