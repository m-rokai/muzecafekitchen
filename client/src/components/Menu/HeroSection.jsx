import { Search } from 'lucide-react';
import GlassPanel from '../glass/GlassPanel';

/**
 * HeroSection — glass-over-mesh hero with greeting and search.
 * The "Most Popular" rail used to live here; it's now rendered as a
 * full-size grid section in MenuPage so it matches the rest of the menu.
 */
export default function HeroSection({ searchQuery, setSearchQuery }) {
  return (
    <div className="px-4 pt-6 pb-4 animate-fade-up">
      <GlassPanel
        intensity="hero"
        className="max-w-3xl mx-auto"
        panelClassName="px-6 py-7 sm:px-8 sm:py-9"
      >
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muze-brown/80">
              Muze Café
            </p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-bold text-muze-dark leading-tight">
              Order ahead,<br className="sm:hidden" /> skip the line.
            </h1>
            <p className="mt-2 text-muze-dark/70 text-sm sm:text-base">
              Pay at pickup. Your order is on its way the moment you tap.
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muze-dark/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the menu…"
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/70 border border-white/80 text-muze-dark placeholder-muze-dark/40 focus:outline-none focus:ring-2 focus:ring-muze-gold focus:border-muze-gold transition-all text-base"
            />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
