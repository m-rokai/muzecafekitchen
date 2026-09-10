import assert from 'node:assert/strict';
import test from 'node:test';
import { generateConfirmationEmail, generateConfirmationText } from './email.js';

const order = {
  channel: 'partner_meal',
  pickup_number: 42,
  customer_name: 'Ada Lovelace',
  preorder_deadline: '2026-09-09T19:00:00.000Z',
  preorder_delivery_date: '2026-09-14',
  created_at: '2026-09-02T20:00:00Z',
  subtotal: 19,
  tax: 1.59,
  total: 20.59,
  items: [{ quantity: 1, item_name: 'Za’atar Chicken', total_price: 19 }],
};

test('partner order receipts clearly identify the preorder cutoff and Monday delivery', () => {
  const html = generateConfirmationEmail(order);
  const text = generateConfirmationText(order);
  for (const receipt of [html, text]) {
    assert.match(receipt, /Weekly meal pre-order/i);
    assert.match(receipt, /Wednesday, September 9, 2026 at 12:00 PM Pacific/);
    assert.match(receipt, /Monday, September 14, 2026/);
    assert.match(receipt, /not an immediate café order/);
    assert.match(receipt, /prices include Nevada sales tax/i);
    assert.match(receipt, /Nevada tax \(included\)/i);
    assert.match(receipt, /\$20\.59/);
  }
});

test('customer receipts include the Cuss Worthy and Muze co-brand', () => {
  const html = generateConfirmationEmail(order);
  const text = generateConfirmationText(order);

  assert.match(html, /\/brand\/cuss-worthy-wordmark\.png/);
  assert.match(html, /\/logo\.png/);
  for (const receipt of [html, text]) {
    assert.match(receipt, /Cuss Worthy Café/);
    assert.match(receipt, /Muze/);
  }
});
