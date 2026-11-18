import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  habits: defineTable({
    // Random per-browser UUID from localStorage. There are no accounts.
    ownerId: v.string(),
    name: v.string(),
    // Set by `habits.archive`; cleared by `habits.restore`.
    archivedAt: v.optional(v.number()),
    // Soft delete set by `habits.remove` so Undo can call `habits.restore`.
    deletedAt: v.optional(v.number()),
  }).index('by_owner', ['ownerId']),

  logs: defineTable({
    habitId: v.id('habits'),
    // The user's local date, `YYYY-MM-DD`. At most one log per habit per date.
    date: v.string(),
  }).index('by_habit_date', ['habitId', 'date']),
});
