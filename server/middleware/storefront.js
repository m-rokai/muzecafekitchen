function unavailable(res) {
  return res.status(410).json({
    message: 'This menu is no longer available. Please order from Muze Café.',
    code: 'STOREFRONT_UNAVAILABLE',
  });
}

export function requireCafeQuery(req, res, next) {
  const channel = req.query.channel;
  if (channel === 'partner_meal') return unavailable(res);
  if (channel !== undefined && channel !== 'cafe') {
    return res.status(400).json({ message: 'Invalid storefront channel' });
  }
  return next();
}

// Reject requests from retired clients before identity, catalog, or payment work.
export function rejectRetiredStorefront(req, res, next) {
  if (req.body?.channel === 'partner_meal') return unavailable(res);
  return next();
}
