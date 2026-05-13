import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
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
        className="absolute inset-0 bg-muze-dark/40 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white/95 backdrop-blur-xl backdrop-saturate-150 shadow-2xl border-l border-white/60 animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-muze-gold/20">
          <div>
            <h2 className="text-2xl font-bold text-muze-dark">Your Cart</h2>
            <p className="text-sm text-muze-dark/60">
              {items.length === 0 ? 'No items yet' : `${items.length} item${items.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-muze-cream flex items-center justify-center hover:bg-muze-gold/20 transition-colors"
            aria-label="Close cart"
          >
            <X className="w-5 h-5 text-muze-dark" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <ShoppingBag className="w-14 h-14 text-muze-brown/30 mb-3" />
              <p className="text-muze-dark/70 mb-1">Your cart is empty</p>
              <p className="text-sm text-muze-dark/50 mb-5">
                Add something delicious to get started.
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-full bg-muze-dark text-muze-gold font-semibold hover:bg-muze-brown hover:text-white transition-colors"
              >
                Browse menu
              </button>
            </div>
          ) : (
            <div className="space-y-3">
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
          <div className="p-5 border-t border-muze-gold/20 bg-white/90">
            <div className="flex justify-between items-center mb-4">
              <span className="text-muze-dark/60">Subtotal</span>
              <span className="text-xl font-bold text-muze-dark">{formatPriceFromDollars(cartTotal)}</span>
            </div>
            <button
              onClick={() => { onClose(); navigate('/cart'); }}
              className="w-full py-4 rounded-2xl bg-muze-dark text-muze-gold font-bold text-base hover:bg-muze-brown hover:text-white transition-colors shadow-md"
            >
              Review &amp; Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CartItem({ item, onUpdateQuantity, onRemove, total }) {
  return (
    <div className="rounded-2xl bg-white border border-muze-gold/20 p-4 shadow-sm">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-muze-dark text-base">{item.name}</h3>

          {item.modifiers && item.modifiers.length > 0 && (
            <p className="text-sm text-muze-dark/60 mt-1">
              {item.modifiers.map((mod, i) => (
                <span key={mod.id}>
                  {mod.display_name || mod.name}
                  {mod.price_adjustment > 0 && ` (+${formatPriceFromDollars(mod.price_adjustment)})`}
                  {i < item.modifiers.length - 1 && ', '}
                </span>
              ))}
            </p>
          )}

          {item.specialInstructions && (
            <p className="text-sm text-muze-dark/50 italic mt-1">
              "{item.specialInstructions}"
            </p>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-muze-dark/40 hover:text-red-500 transition-colors p-1"
          aria-label="Remove item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-muze-gold/10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateQuantity(item.quantity - 1)}
            className="w-9 h-9 rounded-full border border-muze-gold/30 flex items-center justify-center hover:bg-muze-gold/10 transition-colors"
            aria-label="Decrease"
          >
            <Minus className="w-4 h-4 text-muze-dark" />
          </button>
          <span className="w-7 text-center font-bold text-muze-dark">{item.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            className="w-9 h-9 rounded-full border border-muze-gold/30 flex items-center justify-center hover:bg-muze-gold/10 transition-colors"
            aria-label="Increase"
          >
            <Plus className="w-4 h-4 text-muze-dark" />
          </button>
        </div>
        <span className="text-lg font-bold text-muze-brown">
          {formatPriceFromDollars(total)}
        </span>
      </div>
    </div>
  );
}
