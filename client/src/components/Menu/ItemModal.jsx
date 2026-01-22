import { useState, useEffect } from 'react';
import { X, Minus, Plus, Coffee, Check } from 'lucide-react';
import { menuAPI } from '../../utils/api';
import { useCart } from '../../context/CartContext';
import { formatPriceFromDollars } from '../../utils/formatters';

export default function ItemModal({ item, onClose }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [modifierGroups, setModifierGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModifiers();
  }, [item.id]);

  async function loadModifiers() {
    try {
      const data = await menuAPI.getModifiers(item.id);
      setModifierGroups(data || []);
    } catch (err) {
      console.error('Failed to load modifiers:', err);
    } finally {
      setLoading(false);
    }
  }

  const toggleModifier = (modifier, group) => {
    setSelectedModifiers(prev => {
      const isSelected = prev.some(m => m.id === modifier.id);

      if (isSelected) {
        return prev.filter(m => m.id !== modifier.id);
      } else {
        // Check max selections
        const groupModifiers = prev.filter(m =>
          group.options?.some(opt => opt.id === m.id)
        );

        if (group.max_selections && groupModifiers.length >= group.max_selections) {
          // Remove oldest selection from this group
          const oldestInGroup = prev.find(m =>
            group.options?.some(opt => opt.id === m.id)
          );
          return [...prev.filter(m => m.id !== oldestInGroup?.id), modifier];
        }

        return [...prev, modifier];
      }
    });
  };

  const calculateTotal = () => {
    const basePrice = item.price * quantity;
    const modifiersPrice = selectedModifiers.reduce(
      (sum, mod) => sum + (mod.price_adjustment || 0),
      0
    ) * quantity;
    return basePrice + modifiersPrice;
  };

  const handleAddToCart = () => {
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
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
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden animate-slide-up">
        {/* Header Image */}
        <div className="relative h-48 bg-muze-gold/10 flex items-center justify-center">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Coffee className="w-16 h-16 text-muze-gold/40" />
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
          >
            <X className="w-5 h-5 text-muze-dark" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-12rem-5rem)]">
          <h2 className="text-2xl font-bold text-muze-dark">{item.name}</h2>
          {item.description && (
            <p className="text-muze-brown/70 mt-2">{item.description}</p>
          )}
          <p className="text-xl font-semibold text-muze-brown mt-2">
            {formatPriceFromDollars(item.price)}
          </p>

          {/* Modifier Groups */}
          {!loading && modifierGroups.length > 0 && (
            <div className="mt-6 space-y-6">
              {modifierGroups.map(group => (
                <div key={group.id}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-muze-dark">
                      {group.display_name || group.name}
                    </h3>
                    {group.required && (
                      <span className="text-xs text-muze-brown font-medium">Required</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {group.options?.map(option => {
                      const isSelected = selectedModifiers.some(m => m.id === option.id);
                      return (
                        <button
                          key={option.id}
                          onClick={() => toggleModifier(option, group)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-muze-gold bg-muze-gold/10'
                              : 'border-gray-200 hover:border-muze-gold/50'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-muze-gold bg-muze-gold' : 'border-gray-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-muze-dark" />}
                            </span>
                            <span className="font-medium text-muze-dark">
                              {option.display_name || option.name.replace(/^\$/, '').replace(/^No /, '')}
                            </span>
                          </span>
                          {option.price_adjustment > 0 && (
                            <span className="text-muze-brown">
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
          <div className="mt-6">
            <h3 className="font-semibold text-muze-dark mb-3">Special Instructions</h3>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Any allergies or special requests?"
              className="input resize-none h-24"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-muze-gold/20 bg-white">
          <div className="flex items-center gap-4">
            {/* Quantity */}
            <div className="flex items-center gap-3 bg-muze-cream rounded-lg p-1">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-lg bg-white flex items-center justify-center hover:bg-muze-gold/10 transition-colors"
              >
                <Minus className="w-4 h-4 text-muze-dark" />
              </button>
              <span className="w-8 text-center font-semibold text-muze-dark">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-10 h-10 rounded-lg bg-white flex items-center justify-center hover:bg-muze-gold/10 transition-colors"
              >
                <Plus className="w-4 h-4 text-muze-dark" />
              </button>
            </div>

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              className="flex-1 btn btn-primary py-4"
            >
              Add to Cart - {formatPriceFromDollars(calculateTotal())}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
