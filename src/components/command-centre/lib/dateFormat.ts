/**
 * Single source of truth for human-readable date strings across the app.
 *
 * Rules:
 *   < 24h  → "Today, HH:mm" or "Yesterday, HH:mm"
 *   1–7 d  → "N days ago"
 *   > 7 d  → "23 May 2026"
 *
 * Accepts:
 *   - ISO date string ("2026-05-23")
 *   - ISO datetime string
 *   - Date object
 *   - Firestore-style Timestamp ({ toDate(): Date })
 *   - number (ms since epoch)
 *   - null/undefined → "—"
 *
 * Always returns the value for display. Use `fullTimestamp()` for tooltips.
 */

export type DateInput =
  | string
  | number
  | Date
  | { toDate?: () => Date }
  | null
  | undefined;

function toDate(input: DateInput): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'object' && typeof input.toDate === 'function') {
    try {
      const d = input.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  return null;
}

function isDateOnlyString(input: DateInput): boolean {
  return typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatAbsolute(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeDate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return '—';

  const now = new Date();
  const dateOnly = isDateOnlyString(input);

  if (dateOnly) {
    // Date-only inputs (no clock time) – compare by calendar day.
    const todayMidnight = startOfDay(now);
    const inputMidnight = startOfDay(d);
    const dayDiff = Math.round(
      (todayMidnight.getTime() - inputMidnight.getTime()) / 86_400_000,
    );
    if (dayDiff === 0) return 'Today';
    if (dayDiff === 1) return 'Yesterday';
    if (dayDiff === -1) return 'Tomorrow';
    if (dayDiff > 1 && dayDiff <= 7) return `${dayDiff} days ago`;
    if (dayDiff < -1 && dayDiff >= -7) return `in ${-dayDiff} days`;
    return formatAbsolute(d);
  }

  // Datetime input – use 24h cutoff for Today/Yesterday with time.
  const diffMs = now.getTime() - d.getTime();
  const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  if (diffMs >= 0 && diffMs < 86_400_000) {
    // Less than 24h ago.
    return startOfDay(d).getTime() === startOfDay(now).getTime()
      ? `Today, ${hhmm}`
      : `Yesterday, ${hhmm}`;
  }
  if (diffMs >= 86_400_000 && diffMs < 2 * 86_400_000) {
    return `Yesterday, ${hhmm}`;
  }

  const todayMidnight = startOfDay(now);
  const inputMidnight = startOfDay(d);
  const dayDiff = Math.round(
    (todayMidnight.getTime() - inputMidnight.getTime()) / 86_400_000,
  );
  if (dayDiff > 0 && dayDiff <= 7) return `${dayDiff} days ago`;
  if (dayDiff < 0 && dayDiff >= -7) return `in ${-dayDiff} days`;
  return formatAbsolute(d);
}

/**
 * Returns the ISO timestamp string suitable for a tooltip `title` attribute.
 * Returns an empty string if the input cannot be parsed.
 */
export function fullTimestamp(input: DateInput): string {
  const d = toDate(input);
  if (!d) return '';
  return d.toISOString();
}
