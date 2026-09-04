const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PACIFIC_TIME_ZONE = 'America/Los_Angeles';

export function validDateOnly(value) {
  if (!DATE_ONLY_PATTERN.test(value || '')) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

function addDays(dateOnly, days) {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextMonday(dateOnly) {
  const day = new Date(`${dateOnly}T00:00:00Z`).getUTCDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  return addDays(dateOnly, daysUntilMonday);
}

function zonedDateTimeToUtc(dateOnly, hour, timeZone = PACIFIC_TIME_ZONE) {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, 0, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  let candidate = desired;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidate))
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, Number(part.value)]),
    );
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    candidate += desired - represented;
  }
  return new Date(candidate);
}

export function deliveryDateFromSource({ sourceMenuDate = null, sourceCutoff = null } = {}) {
  const cutoffDate = validDateOnly(String(sourceCutoff || '').slice(0, 10));
  if (cutoffDate) return nextMonday(cutoffDate);

  const menuDate = validDateOnly(sourceMenuDate);
  if (!menuDate) throw new Error('Partner menu did not include a valid weekly schedule');
  return nextMonday(menuDate);
}

export function partnerScheduleForDelivery(deliveryDate) {
  const normalizedDeliveryDate = validDateOnly(String(deliveryDate || '').slice(0, 10));
  if (!normalizedDeliveryDate) throw new Error('Partner delivery date is invalid');
  if (new Date(`${normalizedDeliveryDate}T00:00:00Z`).getUTCDay() !== 1) {
    throw new Error('Partner delivery date must be a Monday');
  }
  const deadlineDate = addDays(normalizedDeliveryDate, -5);
  return {
    deliveryDate: normalizedDeliveryDate,
    deadlineDate,
    deadline: zonedDateTimeToUtc(deadlineDate, 12),
  };
}

export function formatPartnerDeliveryDate(dateOnly) {
  const normalized = validDateOnly(String(dateOnly || '').slice(0, 10));
  if (!normalized) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${normalized}T00:00:00Z`));
}

export function formatPartnerDeadline(deadline) {
  const date = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(date.valueOf())) return '';
  return `${new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: PACIFIC_TIME_ZONE,
  }).format(date)} Pacific`;
}
