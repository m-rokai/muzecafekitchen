export function calculateOrderTotals(listedTotal, taxRate) {
  const listedTotalCents = Math.max(0, Math.round(Number(listedTotal || 0) * 100));
  const normalizedRate = Number.isFinite(Number(taxRate)) && Number(taxRate) >= 0
    ? Number(taxRate)
    : 0;
  const subtotalCents = listedTotalCents;
  const taxCents = Math.round(subtotalCents * normalizedRate);
  const totalCents = subtotalCents + taxCents;

  return {
    subtotal: subtotalCents / 100,
    tax: taxCents / 100,
    total: totalCents / 100,
  };
}
