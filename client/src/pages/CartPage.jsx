import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatPriceFromDollars } from '../utils/formatters';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, cartTotal, updateQuantity, removeItem, getItemTotal } = useCart();

  const TAX_RATE = 0.0825; // 8.25% tax
  const tax = cartTotal * TAX_RATE;
  const total = cartTotal + tax;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-6">Add some delicious items to get started!</p>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary"
          >
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">Your Cart</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Cart Items */}
        <div className="space-y-4 mb-8">
          {items.map(item => (
            <div key={item.cartId} className="card p-4">
              <div className="flex justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                <button
                  onClick={() => removeItem(item.cartId)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Modifiers */}
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="text-sm text-gray-600 mb-2">
                  {item.modifiers.map((mod, i) => (
                    <span key={mod.id}>
                      {mod.display_name || mod.name}
                      {mod.price_adjustment > 0 && (
                        <span className="text-muze-accent"> +{formatPriceFromDollars(mod.price_adjustment)}</span>
                      )}
                      {i < item.modifiers.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              )}

              {/* Special instructions */}
              {item.specialInstructions && (
                <p className="text-sm text-gray-500 italic mb-3 bg-gray-50 p-2 rounded">
                  "{item.specialInstructions}"
                </p>
              )}

              {/* Quantity and price */}
              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                    className="w-10 h-10 rounded-lg border-2 border-gray-200 flex items-center justify-center hover:border-muze-accent hover:text-muze-accent transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center text-lg font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                    className="w-10 h-10 rounded-lg border-2 border-gray-200 flex items-center justify-center hover:border-muze-accent hover:text-muze-accent transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xl font-bold text-muze-accent">
                  {formatPriceFromDollars(getItemTotal(item))}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Add more items */}
        <button
          onClick={() => navigate('/')}
          className="w-full py-3 text-muze-accent font-medium border-2 border-dashed border-muze-accent/30 rounded-xl hover:border-muze-accent hover:bg-muze-accent/5 transition-colors mb-8"
        >
          + Add more items
        </button>

        {/* Order Summary */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
          <div className="space-y-3 text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPriceFromDollars(cartTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (8.25%)</span>
              <span>{formatPriceFromDollars(tax)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t text-gray-900 font-semibold text-lg">
              <span>Total</span>
              <span className="text-muze-accent">{formatPriceFromDollars(total)}</span>
            </div>
          </div>
        </div>

        {/* Payment Notice */}
        <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <p className="text-amber-800 text-sm text-center">
            <strong>Pay at pickup:</strong> You'll pay when you pick up your order at Muze Office.
          </p>
        </div>
      </main>

      {/* Checkout Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/checkout')}
            className="w-full btn btn-primary py-4 text-lg"
          >
            Continue to Checkout - {formatPriceFromDollars(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
