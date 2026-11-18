/**
 * Pure streak logic for Tally. No Convex imports, no wall clock, no timezone.
 *
 * All dates are calendar dates as `YYYY-MM-DD` strings (the user's local
 * date, sent by the client). Arithmetic is done on the calendar fields via
 * `Date.UTC`, so the result never depends on the server's timezone.
 *
 * Rules:
 * - Current streak = number of consecutive logged dates ending on `today`,
 *   or ending on yesterday if `today` isn't logged yet. Otherwise 0.
 * - Dates after `today` are ignored (e.g. the user's clock moved backwards).
 * - Duplicate dates count once.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True if `s` is a real calendar date in strict `YYYY-MM-DD` form. */
export function isValidDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return (
    t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
  );
}

/** Throws if `s` is not a valid `YYYY-MM-DD` date. */
export function assertValidDate(s: string, label = 'date'): void {
  if (!isValidDate(s)) {
    throw new Error(`Invalid ${label}: expected YYYY-MM-DD, got "${s}"`);
  }
}

/** `date` shifted by `days` calendar days (negative goes back). */
export function addDays(date: string, days: number): string {
  assertValidDate(date);
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  const yyyy = String(t.getUTCFullYear()).padStart(4, '0');
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Incremental counter fed dates in descending order. `push` returns false
 * once the streak can't grow any more, so callers can stop reading early.
 * `YYYY-MM-DD` strings sort lexicographically in date order.
 */
class StreakCounter {
  count = 0;
  private expected: string | null = null;
  private readonly today: string;
  private readonly yesterday: string;
  private done = false;

  constructor(today: string) {
    assertValidDate(today, 'today');
    this.today = today;
    this.yesterday = addDays(today, -1);
  }

  push(date: string): boolean {
    if (this.done) return false;
    if (date > this.today) return true; // future: ignore, keep reading
    if (this.expected === null) {
      // Anchor on the most recent date at or before today.
      if (date === this.today || date === this.yesterday) {
        this.count = 1;
        this.expected = addDays(date, -1);
        return true;
      }
      this.done = true; // most recent log is older than yesterday: streak 0
      return false;
    }
    if (date > this.expected) return true; // duplicate of a counted date
    if (date === this.expected) {
      this.count += 1;
      this.expected = addDays(date, -1);
      return true;
    }
    this.done = true; // gap
    return false;
  }
}

/** Current streak from logged dates in any order (may contain duplicates). */
export function currentStreak(dates: Iterable<string>, today: string): number {
  const sorted = [...new Set(dates)].sort().reverse();
  const counter = new StreakCounter(today);
  for (const date of sorted) {
    if (!counter.push(date)) break;
  }
  return counter.count;
}

/**
 * Current streak from dates already in descending order (e.g. an index scan).
 * Stops consuming the iterable as soon as the streak is decided.
 */
export async function currentStreakFromDescending(
  datesDesc: Iterable<string> | AsyncIterable<string>,
  today: string,
): Promise<number> {
  const counter = new StreakCounter(today);
  for await (const date of datesDesc) {
    if (!counter.push(date)) break;
  }
  return counter.count;
}
