import { Sparkles } from 'lucide-react';
import { PARTNERS } from '../../config/partners';
import PartnerCard from './PartnerCard';

export default function PartnerCardsSection() {
  if (!PARTNERS || PARTNERS.length === 0) return null;

  return (
    <section className="mt-12 mb-6 scroll-mt-32">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-muze-brown" />
        <h2 className="text-2xl font-bold text-muze-dark">While you're here</h2>
      </div>
      <p className="text-sm text-muze-dark/60 mb-5">
        Other amenities and services in the Muze Office circle.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {PARTNERS.map((partner, i) => (
          <PartnerCard key={partner.id} partner={partner} index={i} />
        ))}
      </div>
    </section>
  );
}
