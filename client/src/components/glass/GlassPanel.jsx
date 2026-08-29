import { useEffect, useState } from 'react';
import LiquidGlass from 'liquid-glass-react';

// liquid-glass-react renders an inline-flex inner panel that sizes to content,
// so it doesn't work for full-width hero/cart surfaces. We default to a CSS
// frosted-glass treatment that scales to any size, and opt into LiquidGlass
// only when `liquid` is requested (good for small accent pills/buttons).

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  ));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

const PRESETS = {
  // CSS frosted-glass presets — controls blur, saturation, tint
  hero:   { radius: '28px', blur: 24, saturate: 160, tint: 'rgba(255,253,248,0.55)', border: 'rgba(255,255,255,0.85)', shadow: '0 20px 60px -10px rgba(45,32,20,0.25), 0 8px 30px -8px rgba(168,90,50,0.15)' },
  chrome: { radius: '20px', blur: 18, saturate: 150, tint: 'rgba(255,253,248,0.6)',  border: 'rgba(255,255,255,0.85)', shadow: '0 12px 40px -8px rgba(45,32,20,0.22), 0 4px 16px -4px rgba(168,90,50,0.12)' },
  subtle: { radius: '16px', blur: 12, saturate: 140, tint: 'rgba(255,253,248,0.65)', border: 'rgba(255,255,255,0.8)',  shadow: '0 6px 20px -6px rgba(45,32,20,0.18)' },
};

// liquid-glass-react presets (only used when liquid={true})
const LIQUID_PRESETS = {
  hero:   { displacementScale: 80, blurAmount: 0.08, saturation: 140, aberrationIntensity: 2, elasticity: 0.15, cornerRadius: 28 },
  chrome: { displacementScale: 50, blurAmount: 0.05, saturation: 130, aberrationIntensity: 1, elasticity: 0.10, cornerRadius: 20 },
  subtle: { displacementScale: 30, blurAmount: 0.03, saturation: 120, aberrationIntensity: 0, elasticity: 0.05, cornerRadius: 16 },
};

/**
 * GlassPanel — frosted glass surface that scales to its container.
 *
 * Props:
 *   intensity: 'hero' | 'chrome' | 'subtle' — visual weight of the glass
 *   className: outer wrapper classes (size + position)
 *   panelClassName: classes applied to the inner content container (padding etc)
 *   padding: passthrough for the rare LiquidGlass case
 *   onClick: click handler (passed through)
 *   liquid: opt into the liquid-glass-react refraction effect (small surfaces only)
 */
export default function GlassPanel({
  children,
  intensity = 'chrome',
  className = '',
  panelClassName = '',
  padding,
  onClick,
  liquid = false,
  style,
}) {
  const reduced = usePrefersReducedMotion();

  // Opt-in liquid-glass-react path (small accent surfaces only — auto-sized to content)
  if (liquid && !reduced) {
    const lp = LIQUID_PRESETS[intensity] || LIQUID_PRESETS.chrome;
    return (
      <div className={className} style={style}>
        <LiquidGlass
          displacementScale={lp.displacementScale}
          blurAmount={lp.blurAmount}
          saturation={lp.saturation}
          aberrationIntensity={lp.aberrationIntensity}
          elasticity={lp.elasticity}
          cornerRadius={lp.cornerRadius}
          padding={padding}
          overLight
          onClick={onClick}
        >
          <div className={panelClassName}>{children}</div>
        </LiquidGlass>
      </div>
    );
  }

  // Default: CSS frosted glass — scales to any container, zero perf cost.
  const p = PRESETS[intensity] || PRESETS.chrome;
  return (
    <div
      onClick={onClick}
      className={`${className} ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        borderRadius: p.radius,
        background: p.tint,
        backdropFilter: `blur(${p.blur}px) saturate(${p.saturate}%)`,
        WebkitBackdropFilter: `blur(${p.blur}px) saturate(${p.saturate}%)`,
        border: `1px solid ${p.border}`,
        boxShadow: p.shadow,
        ...style,
      }}
    >
      <div className={panelClassName}>{children}</div>
    </div>
  );
}
