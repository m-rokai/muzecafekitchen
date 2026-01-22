import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { formatPriceFromDollars } from '../../utils/formatters';

export default function CartDrawer({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { items, cartTotal, updateQuantity, removeItem, getItemTotal } = useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Your Cart</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[calc(100vh-10rem)]">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Your cart is empty</p>
              <button
                onClick={onClose}
                className="mt-4 text-muze-accent font-medium hover:underline"
              >
                Browse menu
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map(item => (
                <CartItem
                  key={item.cartId}
                  item={item}
                  onUpdateQuantity={(qty) => updateQuantity(item.cartId, qty)}
                  onRemove={() => removeItem(item.cartId)}
                  total={getItemTotal(item)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t bg-white">
            <div className="flex justify-between mb-4">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold">{formatPriceFromDollars(cartTotal)}</span>
            </div>
            <button
              onClick={() => {
                onClose();
                navigate('/cart');
              }}
              className="w-full btn btn-primary py-4"
            >
              Continue to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CartItem({ item, onUpdateQuantity, onRemove, total }) {
  return (
    <div className="card p-4">
      <div className="flex justify-between mb-2">
        <h3 className="font-medium">{item.name}</h3>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Modifiers */}
      {item.modifiers && item.modifiers.length > 0 && (
        <div className="text-sm text-gray-500 mb-2">
          {item.modifiers.map((mod, i) => (
            <span key={mod.id}>
              {mod.display_name || mod.name}
              {mod.price_adjustment > 0 && ` (+${formatPriceFromDollars(mod.price_adjustment)})`}
              {i < item.modifiers.length - 1 && ', '}
            </span>
          ))}
        </div>
      )}

      {/* Special instructions */}
      {item.specialInstructions && (
        <p className="text-sm text-gray-500 italic mb-2">
          "{item.specialInstructions}"
        </p>
      )}

      {/* Quantity and price */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateQuantity(item.quantity - 1)}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-8 text-center font-medium">{item.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <span className="font-semibold text-muze-accent">
          {formatPriceFromDollars(total)}
        </span>
      </div>
    </div>
  );
}
