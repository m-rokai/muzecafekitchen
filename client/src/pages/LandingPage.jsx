import { ArrowRight, Coffee, MapPin, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import GradientMesh from '../components/glass/GradientMesh';
import GlassPanel from '../components/glass/GlassPanel';

const STOREFRONTS = [
  {
    href: '/cafe',
    title: 'Muze Café',
    description: 'Coffee, drinks, breakfast, and café favorites prepared by the Muze team.',
    payment: 'Secure payment through Square',
    icon: <Coffee className="w-7 h-7" />,
    tint: 'from-muze-gold/35 via-white/70 to-muze-peach/30',
  },
  {
    href: '/partner-meals',
    title: 'Weekly Partner Meals',
    description: 'Choose from this week’s partner menu and collect your meal at Muze.',
    payment: 'Secure payment through Stripe',
    icon: <UtensilsCrossed className="w-7 h-7" />,
    tint: 'from-blue-100/80 via-white/70 to-violet-100/70',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen relative px-4 py-10 sm:py-16">
      <GradientMesh />
      <main className="relative z-10 max-w-4xl mx-auto">
        <GlassPanel intensity="hero" panelClassName="px-6 py-9 sm:px-10 sm:py-12 text-center" overLight>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-muze-brown">Muze Office</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-black text-muze-dark tracking-tight">
            What would you like to order?
          </h1>
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-muze-dark/65">
            <MapPin className="w-4 h-4 text-muze-brown" />
            Every order is picked up at Muze
          </div>
        </GlassPanel>

        <div className="grid md:grid-cols-2 gap-5 mt-6">
          {STOREFRONTS.map(({ href, title, description, payment, icon, tint }) => (
            <Link
              key={href}
              to={href}
              className={`group rounded-3xl border border-white/70 bg-gradient-to-br ${tint} backdrop-blur-xl shadow-lg p-7 sm:p-8 hover:-translate-y-1 hover:shadow-xl transition-all`}
            >
              <span className="w-14 h-14 rounded-2xl bg-muze-dark text-muze-gold flex items-center justify-center shadow-md">
                {icon}
              </span>
              <h2 className="mt-6 text-2xl font-black text-muze-dark">{title}</h2>
              <p className="mt-2 text-muze-dark/70 leading-relaxed">{description}</p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muze-brown/80">{payment}</p>
              <span className="mt-6 inline-flex items-center gap-2 font-bold text-muze-dark group-hover:text-muze-brown transition-colors">
                Browse menu <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
