import { useState } from 'react';
import { ArrowUpRight, Building2 } from 'lucide-react';

export default function PartnerCard({ partner, index = 0 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const staggerDelay = `${Math.min(index, 4) * 60}ms`;

  return (
    <a
      href={partner.href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ animationDelay: staggerDelay }}
      className="animate-fade-up group flex flex-col rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      aria-label={`${partner.name} — ${partner.cta}`}
    >
      <div className={`relative aspect-[16/9] bg-gradient-to-br ${partner.accent || 'from-muze-gold/30 via-muze-cream to-muze-brown/20'} overflow-hidden`}>
        {partner.image && !imgFailed ? (
          <img
            src={partner.image}
            alt=""
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Building2 className="w-16 h-16 text-muze-dark/25" strokeWidth={1.2} />
          </div>
        )}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-sm text-[10px] font-semibold uppercase tracking-wider text-muze-brown">
          In our circle
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-bold text-muze-dark text-lg leading-tight">
          {partner.name}
        </h3>
        {partner.tagline && (
          <p className="text-sm text-muze-dark/70 mt-1.5 leading-relaxed">
            {partner.tagline}
          </p>
        )}

        <div className="mt-4 pt-3 flex items-center justify-between gap-3 border-t border-muze-gold/15">
          <span className="text-sm font-semibold text-muze-brown">
            {partner.cta}
          </span>
          <span className="w-9 h-9 rounded-full bg-muze-dark text-muze-gold flex items-center justify-center group-hover:bg-muze-brown group-hover:text-white transition-colors flex-shrink-0">
            <ArrowUpRight className="w-4 h-4" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </a>
  );
}
