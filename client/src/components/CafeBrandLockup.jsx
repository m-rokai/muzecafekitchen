export default function CafeBrandLockup({ compact = false, className = '' }) {
  if (compact) {
    return (
      <div
        aria-label="Cuss Worthy Café at Muze Café"
        className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}
      >
        <img
          src="/brand/cuss-worthy-mark.png"
          alt=""
          aria-hidden="true"
          className="h-10 w-10 flex-none rounded-full object-contain shadow-md outline outline-1 outline-black/10"
        />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-black tracking-tight text-muze-dark">Cuss Worthy Café</p>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muze-brown/80">at Muze</p>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-label="Cuss Worthy Café at Muze Café"
      className={`flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-[#080808] px-4 py-3 shadow-[0_12px_30px_-14px_rgba(0,0,0,0.75)] outline outline-1 outline-white/10 sm:px-5 ${className}`}
    >
      <img
        src="/brand/cuss-worthy-wordmark.png"
        alt=""
        aria-hidden="true"
        className="h-14 min-w-0 max-w-[70%] object-contain object-left sm:h-16"
      />
      <div className="flex-none border-l border-white/20 pl-4 text-right">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/55">Café partner</p>
        <p className="mt-1 text-base font-black tracking-tight text-muze-gold sm:text-lg">at Muze</p>
      </div>
    </div>
  );
}
