// Uses a familiar select on narrow screens and wrapped jump links elsewhere.
// Both controls scroll the corresponding menu section into view.
export default function CategoryNav({
  categories,
  selectedCategory,
  onSelectCategory,
}) {
  if (!categories || categories.length === 0) return null;

  function handleClick(category) {
    onSelectCategory?.(category.id);
    // Scroll to anchor if it exists in the document
    const el = document.getElementById(`cat-${category.id}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 140; // header + nav offset
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  return (
    <nav aria-label="Menu categories" className="py-2 sm:py-1">
      <div className="sm:hidden">
        <label htmlFor="menu-category-jump" className="sr-only">Jump to a menu category</label>
        <select
          id="menu-category-jump"
          value={selectedCategory || ''}
          onChange={(event) => {
            const category = categories.find(item => item.id === Number(event.target.value));
            if (category) handleClick(category);
          }}
          className="h-11 w-full rounded-xl border border-muze-gold/45 bg-white/90 px-3 text-sm font-semibold text-muze-dark shadow-sm focus:border-muze-gold focus:outline-none focus:ring-2 focus:ring-muze-gold"
        >
          <option value="">Jump to a category</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </div>

      <div className="hidden flex-wrap justify-center gap-2 py-2 sm:flex">
        {categories.map(category => {
          const active = selectedCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => handleClick(category)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap shadow-sm transition-all ${
                active
                  ? 'bg-muze-dark text-muze-gold border-muze-dark shadow-md'
                  : 'bg-white text-muze-dark border-muze-gold/50 hover:bg-muze-gold/15 hover:border-muze-gold hover:shadow-md'
              }`}
            >
              {category.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
