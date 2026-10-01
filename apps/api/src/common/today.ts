/**
 * Today's calendar date for date-based rules (invoice status, recurring horizon).
 * UTC would flip to tomorrow at 21:00 in Brazil, so use the app timezone.
 */
const timeZone = process.env.APP_TIMEZONE ?? 'America/Sao_Paulo';
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function today(now = new Date()): string {
  return formatter.format(now);
}

export function thisMonth(now = new Date()): string {
  return today(now).slice(0, 7);
}
