import { Megaphone, Search, X } from 'lucide-react';
import GlassPanel from '../glass/GlassPanel';

/**
 * HeroSection — glass-over-mesh hero with greeting and search.
 * The "Most Popular" rail used to live here; it's now rendered as a
 * full-size grid section in MenuPage so it matches the rest of the menu.
 */
export default function HeroSection({
  searchQuery,
  setSearchQuery,
  eyebrow = 'Muze Café',
  title = 'Order ahead, skip the line.',
  description = 'Pay securely online, then pick up at Muze.',
  announcement,
}) {
  const showAnnouncement = announcement?.enabled && announcement?.text;

  return (
    <div className="px-4 pt-4 pb-3 animate-fade-up">
      <GlassPanel
        intensity="hero"
        className="max-w-5xl mx-auto"
        panelClassName="px-4 py-4 sm:px-6 sm:py-5"
      >
        <div className="flex flex-col gap-4">
          {showAnnouncement && (
            <div className="flex items-start gap-3 rounded-xl border border-muze-gold/50 bg-muze-gold/20 px-4 py-3 text-muze-dark">
              <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muze-gold/35">
                <Megaphone className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-muze-brown">
                  Today at Muze
                </p>
                <p className="mt-0.5 whitespace-pre-line text-sm font-semibold leading-relaxed sm:text-base">
                  {announcement.text}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muze-brown/80">
                {eyebrow}
              </p>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-muze-dark sm:text-3xl">
                {title}
              </h1>
              <p className="mt-1 text-sm text-muze-dark/65">
                {description}
              </p>
            </div>

            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muze-dark/40" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the menu…"
                aria-label="Search the café menu"
                className="h-11 w-full rounded-xl border border-white/80 bg-white/75 pl-10 pr-10 text-sm text-muze-dark placeholder-muze-dark/40 transition-all focus:border-muze-gold focus:outline-none focus:ring-2 focus:ring-muze-gold"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear menu search"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muze-dark/50 transition-colors hover:bg-muze-dark/5 hover:text-muze-dark"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
