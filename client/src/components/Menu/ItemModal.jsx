import { useCallback, useEffect, useState } from 'react';
import { X, Minus, Plus, Check } from 'lucide-react';
import { menuAPI } from '../../utils/api';
import { useCart } from '../../context/CartContext';
import { formatPriceFromDollars } from '../../utils/formatters';
import { getCategoryStyle } from './categoryIcons';
import PossibleAllergens from './PossibleAllergens';

export default function ItemModal({ item, onClose }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [modifierGroups, setModifierGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const { Icon, tint } = getCategoryStyle(item.category_name || '', item.name || '');

  const loadModifiers = useCallback(async () => {
    try {
      const data = await menuAPI.getModifiers(item.id);
      setModifierGroups(data || []);
    } catch (err) {
      console.error('Failed to load modifiers:', err);
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    const timer = setTimeout(loadModifiers, 0);
    return () => clearTimeout(timer);
  }, [loadModifiers]);

  const toggleModifier = (modifier, group) => {
    setSelectedModifiers(prev => {
      const isSelected = prev.some(m => m.id === modifier.id);
      if (isSelected) return prev.filter(m => m.id !== modifier.id);
      const groupModifiers = prev.filter(m => group.options?.some(opt => opt.id === m.id));
      if (group.max_selections && groupModifiers.length >= group.max_selections) {
        const oldestInGroup = prev.find(m => group.options?.some(opt => opt.id === m.id));
        return [...prev.filter(m => m.id !== oldestInGroup?.id), modifier];
      }
      return [...prev, modifier];
    });
  };

  const calculateTotal = () => {
    const basePrice = item.price * quantity;
    const modifiersPrice = selectedModifiers.reduce(
      (sum, mod) => sum + (mod.price_adjustment || 0),
      0,
    ) * quantity;
    return basePrice + modifiersPrice;
  };

  const handleAddToCart = () => {
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      menu_week: item.menu_week || null,
      quantity,
      modifiers: selectedModifiers,
      specialInstructions: specialInstructions.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-muze-dark/40 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div className="relative bg-white/95 backdrop-blur-xl backdrop-saturate-150 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-hidden animate-slide-up shadow-2xl border border-white/60">
        {/* Header Visual */}
        <div className={`relative h-56 bg-gradient-to-br ${tint} flex items-center justify-center overflow-hidden`}>
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <Icon className="w-24 h-24 text-muze-dark/30" strokeWidth={1.2} />
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white transition-colors shadow-md"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muze-dark" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-7 overflow-y-auto max-h-[calc(92vh-14rem-6rem)]">
          <h2 className="text-3xl font-bold text-muze-dark leading-tight">{item.name}</h2>
          {item.description && (
            <p className="text-muze-dark/70 mt-2 text-base leading-relaxed">{item.description}</p>
          )}
          {item.channel === 'partner_meal' ? (
            <PossibleAllergens allergens={item.possible_allergens} />
          ) : null}
          <p className="text-2xl font-bold text-muze-brown mt-3">
            {formatPriceFromDollars(item.price)}
          </p>
          {item.channel === 'partner_meal' ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muze-dark/50">Nevada sales tax included</p>
          ) : null}

          {!loading && modifierGroups.length > 0 && (
            <div className="mt-7 space-y-7">
              {modifierGroups.map(group => (
                <div key={group.id}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-muze-dark text-lg">
                      {group.display_name || group.name}
                    </h3>
                    {group.required ? (
                      <span className="text-xs text-muze-brown font-bold uppercase tracking-wider">Required</span>
                    ) : (
                      <span className="text-xs text-muze-dark/40">Optional</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {group.options?.map(option => {
                      const isSelected = selectedModifiers.some(m => m.id === option.id);
                      return (
                        <button
                          key={option.id}
                          onClick={() => toggleModifier(option, group)}
                          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? 'border-muze-gold bg-muze-gold/10'
                              : 'border-gray-200 hover:border-muze-gold/50 bg-white'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'border-muze-gold bg-muze-gold' : 'border-gray-300'
                            }`}>
                              {isSelected && <Check className="w-4 h-4 text-muze-dark" strokeWidth={3} />}
                            </span>
                            <span className="font-medium text-muze-dark">
                              {option.display_name || option.name.replace(/^\$/, '').replace(/^No /, '')}
                            </span>
                          </span>
                          {option.price_adjustment > 0 && (
                            <span className="text-muze-brown font-semibold">
                              +{formatPriceFromDollars(option.price_adjustment)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Special Instructions */}
          <div className="mt-7">
            <h3 className="font-bold text-muze-dark text-lg mb-3">Special Instructions</h3>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Any allergies or special requests?"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-muze-gold focus:outline-none transition-colors resize-none h-24 text-base"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-muze-gold/20 bg-white">
          <div className="flex items-center gap-3">
            {/* Quantity */}
            <div className="flex items-center gap-2 bg-muze-cream rounded-2xl p-1.5">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-11 h-11 rounded-xl bg-white flex items-center justify-center hover:bg-muze-gold/10 transition-colors shadow-sm"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4 text-muze-dark" />
              </button>
              <span className="w-8 text-center font-bold text-muze-dark text-lg">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-11 h-11 rounded-xl bg-white flex items-center justify-center hover:bg-muze-gold/10 transition-colors shadow-sm"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4 text-muze-dark" />
              </button>
            </div>

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              className="flex-1 py-4 px-4 rounded-2xl bg-muze-dark text-muze-gold font-bold text-base sm:text-lg hover:bg-muze-brown hover:text-white transition-colors shadow-md flex items-center justify-center gap-2"
            >
              Add to Cart · {formatPriceFromDollars(calculateTotal())}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
