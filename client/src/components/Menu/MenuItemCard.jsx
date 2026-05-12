import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { formatPriceFromDollars } from '../../utils/formatters';
import { useCart } from '../../context/CartContext';
import { getCategoryStyle } from './categoryIcons';

export default function MenuItemCard({ item, onClick, index = 0 }) {
  const { addItem } = useCart();
  const { Icon, tint } = getCategoryStyle(item.category_name || '', item.name || '');
  const [pingKey, setPingKey] = useState(0);
  const pingTimer = useRef(null);

  // Quick-add only works for items without modifier groups. The card
  // itself doesn't know that yet (server only sends the link via /modifiers
  // endpoint when an item is opened), so we fall back to opening the modal
  // unless the item explicitly carries `has_modifiers === false`.
  const canQuickAdd = item.has_modifiers === false;

  // Stagger entrance — cap delay so late cards don't feel laggy.
  const staggerDelay = `${Math.min(index, 11) * 40}ms`;

  function handleQuickAdd(e) {
    e.stopPropagation();
    if (!canQuickAdd) {
      onClick();
      return;
    }
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      modifiers: [],
      specialInstructions: '',
    });
    setPingKey(k => k + 1);
    if (pingTimer.current) clearTimeout(pingTimer.current);
    pingTimer.current = setTimeout(() => setPingKey(0), 650);
  }

  const unavailable = item.available === 0 || item.available === false;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={unavailable}
      style={{ animationDelay: staggerDelay }}
      className={`animate-fade-up group text-left w-full flex flex-col rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 overflow-hidden ${unavailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Visual zone */}
      <div className={`relative aspect-[4/3] bg-gradient-to-br ${tint} flex items-center justify-center overflow-hidden`}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <Icon className="w-16 h-16 text-muze-dark/30 group-hover:scale-110 transition-transform duration-300" strokeWidth={1.4} />
        )}
        {unavailable && (
          <span className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-white/90 text-muze-dark text-xs font-semibold uppercase tracking-wider">
              Unavailable
            </span>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-muze-dark text-lg leading-tight">{item.name}</h3>
        {item.description && (
          <p className="text-sm text-muze-dark/60 mt-1 line-clamp-2">{item.description}</p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between">
          <p className="text-xl font-bold text-muze-brown">
            {formatPriceFromDollars(item.price)}
          </p>
          <span
            onClick={handleQuickAdd}
            role="button"
            aria-label={canQuickAdd ? `Add ${item.name} to cart` : `Customize ${item.name}`}
            className="relative w-12 h-12 rounded-full bg-muze-dark text-muze-gold flex items-center justify-center hover:bg-muze-brown hover:text-white shadow-md transition-colors"
          >
            {pingKey > 0 && (
              <span
                key={pingKey}
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-muze-gold animate-ping-once pointer-events-none"
              />
            )}
            <Plus className="w-6 h-6 relative" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </button>
  );
}
