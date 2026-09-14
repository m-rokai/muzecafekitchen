import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

process.env.GMAIL_USER = 'notifications@muzeoffice.com';
process.env.GMAIL_APP_PASSWORD = 'test-app-password';

const sentMessages = [];
mock.module('nodemailer', {
  defaultExport: {
    createTransport: () => ({
      sendMail: async message => {
        sentMessages.push(message);
        return { messageId: 'test-message-id' };
      },
    }),
  },
});

const { sendOrderConfirmation } = await import('./email.js');

test('copies every customer order confirmation to the records inbox without exposing it', async () => {
  const result = await sendOrderConfirmation({
    channel: 'cafe',
    pickup_number: 8,
    customer_name: 'Customer',
    email: 'customer@example.com',
    created_at: '2026-09-14T18:00:00.000Z',
    subtotal: 5,
    tax: 0.41,
    total: 5.41,
    items: [{ quantity: 1, item_name: 'Latte', total_price: 5 }],
  });

  assert.equal(result.success, true);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].to, 'customer@example.com');
  assert.equal(sentMessages[0].bcc, 'order@cussworthy.cafe');
});
