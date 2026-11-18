/** Pure validation for habit names. */

export const HABIT_NAME_MAX = 60;

/** Trims `raw` and returns it, or throws if empty or over 60 characters. */
export function normalizeHabitName(raw: string): string {
  const name = raw.trim();
  if (name.length === 0) throw new Error('Habit name cannot be empty');
  if ([...name].length > HABIT_NAME_MAX) {
    throw new Error(`Habit name must be at most ${HABIT_NAME_MAX} characters`);
  }
  return name;
}
