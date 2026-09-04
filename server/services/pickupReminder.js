import * as db from '../db/database.js';
import { sendPickupReminder } from './email.js';

const REMINDER_DELAY_MINUTES = 10;

async function sendReminder(orderId) {
  const claimed = await db.claimPickupReminder(orderId);
  if (!claimed) return 'skipped';
  const order = await db.getOrder(orderId);
  if (!order?.email) return 'skipped';
  try {
    await sendPickupReminder(order);
    return 'sent';
  } catch (error) {
    await db.markPickupReminderSent(orderId, false);
    throw error;
  }
}
export async function processPickupReminders() {
  const due = await db.getOrdersAwaitingPickupReminder(REMINDER_DELAY_MINUTES);
  const results = await Promise.allSettled(due.map(row => sendReminder(row.id)));
  const sent = results.filter(result => result.status === 'fulfilled' && result.value === 'sent').length;
  const failed = results.filter(result => result.status === 'rejected').length;
  return { scanned: due.length, sent, failed };
}
