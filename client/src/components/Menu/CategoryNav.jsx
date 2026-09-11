import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Coffee, UtensilsCrossed } from 'lucide-react';
import { groupMenuCategories } from '../../utils/menuCategories';

const GROUP_ICONS = {
  food: UtensilsCrossed,
  drinks: Coffee,
};

// Separates the catalog into familiar Food and Drinks menus while retaining
// category anchors for quick navigation and keyboard access.
export default function CategoryNav({
  categories,
  selectedCategory,
  onSelectCategory,
}) {
  const [openGroup, setOpenGroup] = useState(null);
  const navRef = useRef(null);

  useEffect(() => {
    if (!openGroup) return undefined;

    function handlePointerDown(event) {
      if (!navRef.current?.contains(event.target)) setOpenGroup(null);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpenGroup(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openGroup]);

  if (!categories || categories.length === 0) return null;

  const groups = groupMenuCategories(categories);

  function handleClick(category) {
    onSelectCategory?.(category.id);
    setOpenGroup(null);
    // Scroll to anchor if it exists in the document
    const el = document.getElementById(`cat-${category.id}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 140; // header + nav offset
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  return (
    <nav ref={navRef} aria-label="Food and drink menus" className="py-2">
      <div className="mx-auto grid max-w-xl grid-cols-2 gap-2 sm:gap-3">
        {groups.map(group => {
          const GroupIcon = GROUP_ICONS[group.id];
          const active = group.categories.some(category => selectedCategory === category.id);
          const open = openGroup === group.id;

          return (
            <div key={group.id} className="relative min-w-0">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`menu-group-${group.id}`}
                onClick={() => setOpenGroup(current => current === group.id ? null : group.id)}
                className={`flex min-h-12 w-full items-center gap-2 rounded-xl px-3 py-2 text-left shadow-sm outline outline-1 transition-[color,background-color,box-shadow,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muze-gold sm:px-4 ${
                  active || open
                    ? 'bg-muze-dark text-white shadow-md outline-black/10'
                    : 'bg-white/90 text-muze-dark outline-black/5 hover:bg-white hover:shadow-md'
                }`}
              >
                <GroupIcon className={`h-5 w-5 flex-none ${active || open ? 'text-muze-gold' : 'text-muze-brown'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-tight">{group.label}</span>
                  <span className={`block truncate text-[0.65rem] leading-tight ${active || open ? 'text-white/65' : 'text-muze-dark/55'}`}>
                    {group.categories.map(category => category.name).join(' · ')}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 flex-none transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {open && (
                <div
                  id={`menu-group-${group.id}`}
                  className={`absolute top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-2xl bg-white p-2 shadow-[0_18px_50px_-18px_rgba(45,32,20,0.45)] outline outline-1 outline-black/10 ${group.id === 'drinks' ? 'right-0' : 'left-0'}`}
                >
                  <p className="px-3 pb-1.5 pt-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muze-brown/70">
                    {group.label} categories
                  </p>
                  {group.categories.map(category => {
                    const categoryActive = selectedCategory === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleClick(category)}
                        className={`flex min-h-10 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition-[color,background-color,transform] active:scale-[0.96] ${
                          categoryActive
                            ? 'bg-muze-gold/25 text-muze-dark'
                            : 'text-muze-dark/75 hover:bg-muze-cream hover:text-muze-dark'
                        }`}
                      >
                        <span>{category.name}</span>
                        {categoryActive && <Check className="h-4 w-4 text-muze-brown" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
