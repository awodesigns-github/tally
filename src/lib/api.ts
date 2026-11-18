import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

export type HabitId = Id<'habits'>;

/** One row of habits.list, as defined in the TALLY.md API contract. */
export type Habit = {
  _id: HabitId;
  _creationTime: number;
  name: string;
  streak: number;
  loggedToday: boolean;
};

export const habits = api.habits;
