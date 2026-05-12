// Bigger horizontal-scrolling category pills. Acts as scroll-to-anchor:
// tapping a pill scrolls the corresponding category section into view.
// Falls back to the existing filter pattern if the parent doesn't pass anchors.
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
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
      <div className="flex gap-3 py-2 min-w-max">
        {categories.map(category => {
          const active = selectedCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => handleClick(category)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all border shadow-sm ${
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
    </div>
  );
}
