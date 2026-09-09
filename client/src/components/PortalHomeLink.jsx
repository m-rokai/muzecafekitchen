import { House } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PortalHomeLink({ className = '', label = 'Muze Café' }) {
  return (
    <Link
      to="/cafe"
      aria-label="Return to the Muze Café menu"
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-2 text-sm font-bold text-muze-dark/70 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-muze-dark focus:outline-none focus:ring-2 focus:ring-muze-gold ${className}`}
    >
      <House className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
