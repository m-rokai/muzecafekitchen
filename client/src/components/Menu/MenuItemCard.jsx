import { Plus, Coffee } from 'lucide-react';
import { formatPriceFromDollars } from '../../utils/formatters';

export default function MenuItemCard({ item, onClick }) {
  return (
    <div
      onClick={onClick}
      className="card-hover flex gap-4 p-4"
    >
      {/* Image or placeholder */}
      <div className="w-20 h-20 rounded-lg bg-muze-gold/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Coffee className="w-8 h-8 text-muze-gold/40" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-muze-dark truncate">{item.name}</h3>
        {item.description && (
          <p className="text-sm text-muze-brown/60 line-clamp-2 mt-1">{item.description}</p>
        )}
        <p className="text-muze-brown font-semibold mt-2">
          {formatPriceFromDollars(item.price)}
        </p>
      </div>

      {/* Add button */}
      <button
        className="self-center w-8 h-8 rounded-full bg-muze-gold text-muze-dark flex items-center justify-center hover:bg-muze-brown hover:text-white transition-colors flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}
