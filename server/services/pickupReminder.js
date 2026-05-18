// Pickup-reminder service.
//
// When an order flips to 'ready', we want to nudge the customer ~10 minutes
// later if they haven't picked it up. Two layers:
//
// 1. schedulePickupReminderAfterReady() — best-effort in-process setTimeout
//    fired when the kitchen marks the order ready. Reliable while the Fly
//    machine is up.
// 2. startPickupReminderScanner() — once-per-minute interval that catches
//    anything missed (machine restart, missed event, Fly auto-stop wake-up).
//    The DB row is the source of truth via pickup_reminder_sent.
//
// Both paths call sendReminderIfDue(), which re-reads the order, re-checks
// state under the current truth, and atomically marks pickup_reminder_sent
// so we never double-send.

import * as db from '../db/database.js';
import { sendPickupReminder } from './email.js';

const REMINDER_DELAY_MINUTES = 10;
const SCANNER_INTERVAL_MS = 60 * 1000;

async function sendReminderIfDue(orderId, io) {
  const order = db.getOrder(orderId);
  if (!order) return;
  if (order.status !== 'ready') return;
  if (order.pickup_reminder_sent) return;
  if (!order.email) {
    // Still mark so the scanner doesn't keep looking at this row.
    db.markPickupReminderSent(orderId);
    return;
  }

  // Mark first so a concurrent scan can't race us.
  db.markPickupReminderSent(orderId);

  try {
    await sendPickupReminder(order);
    if (io) io.emit('order-updated', db.getOrder(orderId));
  } catch (err) {
    console.error(`Pickup reminder failed for order ${orderId}:`, err);
  }
}

export function schedulePickupReminderAfterReady(orderId, io) {
  const delay = REMINDER_DELAY_MINUTES * 60 * 1000;
  setTimeout(() => sendReminderIfDue(orderId, io), delay).unref();
}

export function startPickupReminderScanner(io) {
  const tick = () => {
    try {
      const due = db.getOrdersAwaitingPickupReminder(REMINDER_DELAY_MINUTES);
      for (const row of due) sendReminderIfDue(row.id, io);
    } catch (err) {
      console.error('Pickup reminder scanner error:', err);
    }
  };
  // Run once on startup to handle anything queued while we were down,
  // then on the interval.
  tick();
  const handle = setInterval(tick, SCANNER_INTERVAL_MS);
  handle.unref();
  return handle;
}
