const OWNER_KEY = 'tally:ownerId';

let cached: string | null = null;

/** One random UUID per browser, kept in localStorage. Falls back to an in-memory id if storage is blocked. */
export function getOwnerId(): string {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(OWNER_KEY);
    if (stored) return (cached = stored);
    const fresh = crypto.randomUUID();
    localStorage.setItem(OWNER_KEY, fresh);
    return (cached = fresh);
  } catch {
    return (cached = crypto.randomUUID());
  }
}

/** The user's local date as YYYY-MM-DD. */
export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
