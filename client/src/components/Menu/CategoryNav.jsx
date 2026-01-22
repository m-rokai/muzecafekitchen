export default function CategoryNav({ categories, selectedCategory, onSelectCategory }) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 px-4 py-3 min-w-max">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === category.id
                ? 'bg-muze-gold text-muze-dark'
                : 'bg-white/10 text-muze-gold/80 hover:bg-white/20 hover:text-muze-gold'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
}
