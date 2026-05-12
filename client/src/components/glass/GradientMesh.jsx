// Fixed-position warm gradient mesh that gives the liquid-glass surfaces
// something interesting to refract. Uses radial gradients in the Muze palette.
// Drifts slowly unless the user prefers reduced motion.
export default function GradientMesh() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden bg-muze-cream pointer-events-none"
    >
      <div
        className="absolute -inset-[20%] motion-safe:animate-mesh-drift"
        style={{
          backgroundImage: [
            'radial-gradient(at 18% 22%, rgba(245,184,46,0.55) 0px, transparent 45%)',  // gold
            'radial-gradient(at 82% 12%, rgba(255,217,168,0.65) 0px, transparent 50%)', // peach
            'radial-gradient(at 92% 78%, rgba(168,90,50,0.45) 0px, transparent 55%)',   // brown
            'radial-gradient(at 12% 88%, rgba(92,58,30,0.35) 0px, transparent 50%)',    // cocoa
            'radial-gradient(at 50% 55%, rgba(255,253,248,0.6) 0px, transparent 55%)',  // soft highlight
          ].join(', '),
        }}
      />
      {/* Subtle grain so the mesh has texture for the glass to grab onto */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\'/></svg>")',
        }}
      />
    </div>
  );
}
