export const CAFE_TIME_ZONE = 'America/Los_Angeles';
export const CAFE_OPEN_MINUTE = 8 * 60;
export const CAFE_CLOSE_MINUTE = 14 * 60;
export const PICKUP_SLOT_MINUTES = 15;
export const PICKUP_LEAD_MINUTES = 15;
export const PICKUP_SLOT_CAPACITY = 7;

const PACIFIC_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAFE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const PICKUP_LABEL = new Intl.DateTimeFormat('en-US', {
  timeZone: CAFE_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

function localParts(value) {
  const parts = Object.fromEntries(
    PACIFIC_PARTS.formatToParts(value)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  );
  return {
    ...parts,
    dateKey: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    minuteOfDay: parts.hour * 60 + parts.minute,
  };
}

function validDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export class CafeScheduleError extends Error {
  constructor(message, code = 'ORDERING_CLOSED') {
    super(message);
    this.name = 'CafeScheduleError';
    this.code = code;
    this.status = code === 'ORDERING_CLOSED' ? 403 : 400;
  }
}

export function formatPacificPickupTime(value) {
  const date = validDate(value);
  return date ? PICKUP_LABEL.format(date) : null;
}

export function getCafeOrderingStatus(now = new Date()) {
  const instant = validDate(now);
  if (!instant) throw new TypeError('A valid current time is required');
  const local = localParts(instant);
  const acceptingOrders = local.minuteOfDay >= CAFE_OPEN_MINUTE
    && local.minuteOfDay < CAFE_CLOSE_MINUTE;
  return {
    acceptingOrders,
    timeZone: CAFE_TIME_ZONE,
    opensAt: '8:00 AM',
    closesAt: '2:00 PM',
    message: acceptingOrders
      ? ''
      : 'Online orders are accepted daily from 8:00 AM to 2:00 PM Pacific.',
  };
}

export function getAvailablePickupSlots(now = new Date()) {
  const instant = validDate(now);
  if (!instant || !getCafeOrderingStatus(instant).acceptingOrders) return [];

  const today = localParts(instant).dateKey;
  const slotMs = PICKUP_SLOT_MINUTES * 60 * 1000;
  const earliestMs = instant.getTime() + PICKUP_LEAD_MINUTES * 60 * 1000;
  let candidateMs = Math.ceil(earliestMs / slotMs) * slotMs;
  const slots = [];

  for (let attempts = 0; attempts < 96; attempts += 1, candidateMs += slotMs) {
    const candidate = new Date(candidateMs);
    const local = localParts(candidate);
    if (local.dateKey !== today) break;
    if (local.minuteOfDay > CAFE_CLOSE_MINUTE) break;
    if (local.minuteOfDay >= CAFE_OPEN_MINUTE) {
      slots.push({ value: candidate.toISOString(), label: formatPacificPickupTime(candidate) });
    }
  }
  return slots;
}

export function filterAvailablePickupSlots(slots, counts = {}) {
  return slots
    .filter(slot => Number(counts[slot.value] || 0) < PICKUP_SLOT_CAPACITY)
    .map(slot => ({
      ...slot,
      remaining: PICKUP_SLOT_CAPACITY - Number(counts[slot.value] || 0),
    }));
}

export function resolveCafePickupWindow(pickupAt, now = new Date()) {
  const instant = validDate(now);
  const status = getCafeOrderingStatus(instant);
  if (!status.acceptingOrders) {
    throw new CafeScheduleError(status.message, 'ORDERING_CLOSED');
  }
  if (!pickupAt) return { pickupWindowStart: null, pickupWindowEnd: null };

  const requested = validDate(pickupAt);
  if (!requested) {
    throw new CafeScheduleError('Choose a valid pickup time.', 'PICKUP_TIME_UNAVAILABLE');
  }
  const localNow = localParts(instant);
  const localRequested = localParts(requested);
  const minimumMs = instant.getTime() + PICKUP_LEAD_MINUTES * 60 * 1000;
  const isQuarterHour = localRequested.minute % PICKUP_SLOT_MINUTES === 0
    && localRequested.second === 0
    && requested.getUTCMilliseconds() === 0;
  const isWithinPickupHours = localRequested.minuteOfDay >= CAFE_OPEN_MINUTE
    && localRequested.minuteOfDay <= CAFE_CLOSE_MINUTE;

  if (localRequested.dateKey !== localNow.dateKey
    || requested.getTime() < minimumMs
    || !isQuarterHour
    || !isWithinPickupHours) {
    throw new CafeScheduleError(
      'That pickup time is no longer available. Choose another time between 8:00 AM and 2:00 PM Pacific.',
      'PICKUP_TIME_UNAVAILABLE',
    );
  }

  return {
    pickupWindowStart: requested.toISOString(),
    pickupWindowEnd: new Date(requested.getTime() + PICKUP_SLOT_MINUTES * 60 * 1000).toISOString(),
  };
}
