export function calculateOrderTotals(listedTotal, taxRate, { taxIncluded = false } = {}) {
  const listedTotalCents = Math.max(0, Math.round(Number(listedTotal || 0) * 100));
  const normalizedRate = Number.isFinite(Number(taxRate)) && Number(taxRate) >= 0
    ? Number(taxRate)
    : 0;
  const subtotalCents = taxIncluded
    ? Math.round(listedTotalCents / (1 + normalizedRate))
    : listedTotalCents;
  const taxCents = taxIncluded
    ? listedTotalCents - subtotalCents
    : Math.round(subtotalCents * normalizedRate);
  const totalCents = taxIncluded ? listedTotalCents : subtotalCents + taxCents;

  return {
    subtotal: subtotalCents / 100,
    tax: taxCents / 100,
    total: totalCents / 100,
  };
}
