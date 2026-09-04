export default function PossibleAllergens({ allergens = [], compact = false }) {
  const labels = Array.isArray(allergens)
    ? [...new Set(allergens.filter(value => typeof value === 'string' && value.trim()))]
    : [];

  return (
    <div className={compact ? 'mt-3' : 'mt-4'} role="note" aria-label="Possible allergen information">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muze-dark/55">
        Possible allergens
      </p>
      {labels.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {labels.map(label => (
            <span
              key={label}
              className="rounded-full border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900"
            >
              {label}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-muze-dark/55">
          No FDA major allergens identified in listed ingredients
        </p>
      )}
    </div>
  );
}
