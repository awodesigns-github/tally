/** Storage helpers that never throw (private mode, blocked site data). */

export function sessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function setSessionFlag(key: string) {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
}

const MILESTONE_KEY = 'tally:milestones';

function readMilestones(): string[] {
  try {
    const raw = localStorage.getItem(MILESTONE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Returns true the first time it's called for a habit, false after. */
export function claimMilestone(habitId: string): boolean {
  const seen = readMilestones();
  if (seen.includes(habitId)) return false;
  try {
    localStorage.setItem(MILESTONE_KEY, JSON.stringify([...seen, habitId]));
  } catch {
    /* still celebrate once this session */
  }
  return true;
}
