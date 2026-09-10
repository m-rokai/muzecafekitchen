import { CLOSURE } from '../config/closure';
import GradientMesh from '../components/glass/GradientMesh';
import CafeBrandLockup from '../components/CafeBrandLockup';

// Full-screen "temporarily closed" takeover shown on all customer-facing
// routes while CLOSED is true in config/closure.js. Copy lives in CLOSURE.
export default function ClosurePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <GradientMesh />

      <div className="w-full max-w-md text-center">
        <div className="backdrop-blur-xl bg-white/55 border border-white/60 rounded-3xl shadow-xl px-8 py-10 sm:px-10 sm:py-12">
          <CafeBrandLockup className="mb-7" />

          <h1 className="text-2xl sm:text-3xl font-bold text-muze-dark">
            {CLOSURE.title}
          </h1>

          <div className="mt-4 space-y-3">
            {CLOSURE.body.map((paragraph, i) => (
              <p key={i} className="text-muze-dark/70 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {CLOSURE.ctaHref && (
            <div className="mt-8">
              {CLOSURE.footerText && (
                <p className="text-sm text-muze-dark/50 mb-3">{CLOSURE.footerText}</p>
              )}
              <a
                href={CLOSURE.ctaHref}
                className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-muze-dark text-muze-gold font-semibold shadow-md hover:bg-muze-cocoa transition-colors"
              >
                {CLOSURE.ctaLabel}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
