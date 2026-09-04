const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PACIFIC_TIME_ZONE = 'America/Los_Angeles';

function validDateOnly(value) {
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

function pacificNoon(dateOnly) {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const desired = Date.UTC(year, month - 1, day, 12);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
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
      parts.year, parts.month - 1, parts.day,
      parts.hour, parts.minute, parts.second,
    );
    candidate += desired - represented;
  }
  return new Date(candidate);
}

function formatDate(dateOnly) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${dateOnly}T00:00:00Z`));
}

export function getPartnerSchedule(deliveryValue, now = new Date()) {
  const deliveryDate = validDateOnly(String(deliveryValue || '').slice(0, 10));
  if (!deliveryDate) return null;
  const deadlineDate = addDays(deliveryDate, -5);
  const deadline = pacificNoon(deadlineDate);
  return {
    deliveryDate,
    deliveryLabel: formatDate(deliveryDate),
    deadline,
    deadlineLabel: `${formatDate(deadlineDate)} at 12:00 PM Pacific`,
    closed: now >= deadline,
  };
}
