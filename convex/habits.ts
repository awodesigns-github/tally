import { ConvexError, v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { assertValidDate, currentStreakFromDescending } from './lib/streak';
import { normalizeHabitName } from './lib/habitName';

/** Upper bound on habits returned per owner (a one-screen list). */
const MAX_HABITS = 500;

function fail(message: string): never {
  throw new ConvexError(message);
}

function checkOwnerId(ownerId: string): void {
  if (ownerId.trim().length === 0 || ownerId.length > 200) fail('Invalid ownerId');
}

function checkToday(today: string): void {
  try {
    assertValidDate(today, 'today');
  } catch (e) {
    fail((e as Error).message);
  }
}

/** Loads a habit and enforces ownership. Throws if missing or not the owner's. */
async function getOwnedHabit(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
  habitId: Id<'habits'>,
): Promise<Doc<'habits'>> {
  checkOwnerId(ownerId);
  const habit = await ctx.db.get('habits', habitId);
  if (habit === null) fail('Habit not found');
  if (habit.ownerId !== ownerId) fail('Habit does not belong to this owner');
  return habit;
}

/** Streak for one habit, reading logs newest-first and stopping at the first gap. */
async function streakFor(
  ctx: QueryCtx | MutationCtx,
  habitId: Id<'habits'>,
  today: string,
): Promise<number> {
  const logs = ctx.db
    .query('logs')
    .withIndex('by_habit_date', (q) => q.eq('habitId', habitId).lte('date', today))
    .order('desc');
  async function* dates() {
    for await (const log of logs) yield log.date;
  }
  return await currentStreakFromDescending(dates(), today);
}

async function logsOn(ctx: QueryCtx | MutationCtx, habitId: Id<'habits'>, date: string) {
  return await ctx.db
    .query('logs')
    .withIndex('by_habit_date', (q) => q.eq('habitId', habitId).eq('date', date))
    .take(10);
}

export const list = query({
  args: { ownerId: v.string(), today: v.string() },
  returns: v.array(
    v.object({
      _id: v.id('habits'),
      _creationTime: v.number(),
      name: v.string(),
      streak: v.number(),
      loggedToday: v.boolean(),
    }),
  ),
  handler: async (ctx, { ownerId, today }) => {
    checkOwnerId(ownerId);
    checkToday(today);
    // by_owner orders by _creationTime within an owner: oldest first.
    const habits = await ctx.db
      .query('habits')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .take(MAX_HABITS);
    const active = habits.filter((h) => h.archivedAt === undefined && h.deletedAt === undefined);
    return await Promise.all(
      active.map(async (h) => ({
        _id: h._id,
        _creationTime: h._creationTime,
        name: h.name,
        streak: await streakFor(ctx, h._id, today),
        loggedToday: (await logsOn(ctx, h._id, today)).length > 0,
      })),
    );
  },
});

export const create = mutation({
  args: { ownerId: v.string(), name: v.string() },
  returns: v.id('habits'),
  handler: async (ctx, { ownerId, name }) => {
    checkOwnerId(ownerId);
    let clean: string;
    try {
      clean = normalizeHabitName(name);
    } catch (e) {
      fail((e as Error).message);
    }
    return await ctx.db.insert('habits', { ownerId, name: clean });
  },
});

export const toggleToday = mutation({
  args: { ownerId: v.string(), habitId: v.id('habits'), today: v.string() },
  returns: v.object({ loggedToday: v.boolean(), streak: v.number() }),
  handler: async (ctx, { ownerId, habitId, today }) => {
    checkToday(today);
    const habit = await getOwnedHabit(ctx, ownerId, habitId);
    if (habit.deletedAt !== undefined || habit.archivedAt !== undefined) {
      fail('Habit is archived or deleted');
    }
    const existing = await logsOn(ctx, habitId, today);
    let loggedToday: boolean;
    if (existing.length > 0) {
      // Undo today's log. Delete every row for the date in case of legacy duplicates.
      for (const log of existing) await ctx.db.delete('logs', log._id);
      loggedToday = false;
    } else {
      await ctx.db.insert('logs', { habitId, date: today });
      loggedToday = true;
    }
    return { loggedToday, streak: await streakFor(ctx, habitId, today) };
  },
});

export const archive = mutation({
  args: { ownerId: v.string(), habitId: v.id('habits') },
  returns: v.null(),
  handler: async (ctx, { ownerId, habitId }) => {
    const habit = await getOwnedHabit(ctx, ownerId, habitId);
    if (habit.archivedAt === undefined) {
      await ctx.db.patch('habits', habitId, { archivedAt: Date.now() });
    }
    return null;
  },
});

export const remove = mutation({
  args: { ownerId: v.string(), habitId: v.id('habits') },
  returns: v.null(),
  handler: async (ctx, { ownerId, habitId }) => {
    const habit = await getOwnedHabit(ctx, ownerId, habitId);
    // Soft delete: logs are kept so Undo (restore) brings the streak back.
    if (habit.deletedAt === undefined) {
      await ctx.db.patch('habits', habitId, { deletedAt: Date.now() });
    }
    return null;
  },
});

export const restore = mutation({
  args: { ownerId: v.string(), habitId: v.id('habits') },
  returns: v.null(),
  handler: async (ctx, { ownerId, habitId }) => {
    const habit = await getOwnedHabit(ctx, ownerId, habitId);
    if (habit.archivedAt !== undefined || habit.deletedAt !== undefined) {
      await ctx.db.patch('habits', habitId, { archivedAt: undefined, deletedAt: undefined });
    }
    return null;
  },
});
