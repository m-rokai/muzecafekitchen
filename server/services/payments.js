// Convert a dollar amount (REAL in the DB) to integer cents for Stripe.
export function dollarsToCents(dollars) {
  return Math.round(Number(dollars) * 100);
}

// One line item for the exact order total (tax included). Charging a single
// line equal to order.total guarantees the captured amount matches our trusted
// server-side total with no rounding/tax drift. Itemization is shown in our UI.
export function buildCheckoutLineItems(order) {
  return [
    {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: dollarsToCents(order.total),
        product_data: {
          name: `Muze Café — Order #${order.pickup_number}`,
        },
      },
    },
  ];
}
