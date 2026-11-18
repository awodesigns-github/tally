/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const A = 'owner-a';
const B = 'owner-b';
const D0 = '2026-11-16';
const D1 = '2026-11-17';
const D2 = '2026-11-18';

function setup() {
  return convexTest(schema, modules);
}

async function makeHabit(t: ReturnType<typeof setup>, name = 'Read', ownerId = A) {
  return await t.mutation(api.habits.create, { ownerId, name });
}

async function logDates(t: ReturnType<typeof setup>, habitId: string, dates: string[]) {
  await t.run(async (ctx) => {
    for (const date of dates) await ctx.db.insert('logs', { habitId: habitId as never, date });
  });
}

async function countLogs(t: ReturnType<typeof setup>, date: string) {
  return await t.run(async (ctx) => (await ctx.db.query('logs').collect()).filter((l) => l.date === date).length);
}

describe('toggleToday', () => {
  test('first log sets loggedToday and streak 1', async () => {
    const t = setup();
    const id = await makeHabit(t);
    expect(await t.mutation(api.habits.toggleToday, { ownerId: A, habitId: id, today: D2 })).toEqual({
      loggedToday: true,
      streak: 1,
    });
  });

  test('second toggle same day undoes; never more than one log row', async () => {
    const t = setup();
    const id = await makeHabit(t);
    await t.mutation(api.habits.toggleToday, { ownerId: A, habitId: id, today: D2 });
    expect(await countLogs(t, D2)).toBe(1);
    const r = await t.mutation(api.habits.toggleToday, { ownerId: A, habitId: id, today: D2 });
    expect(r).toEqual({ loggedToday: false, streak: 0 });
    expect(await countLogs(t, D2)).toBe(0);
    const r3 = await t.mutation(api.habits.toggleToday, { ownerId: A, habitId: id, today: D2 });
    expect(r3).toEqual({ loggedToday: true, streak: 1 });
    expect(await countLogs(t, D2)).toBe(1);
  });

  test('legacy duplicate rows count once in list and are all removed on undo', async () => {
    const t = setup();
    const id = await makeHabit(t);
    await logDates(t, id, [D2, D2, D1]);
    const [h] = await t.query(api.habits.list, { ownerId: A, today: D2 });
    expect(h.streak).toBe(2);
    await t.mutation(api.habits.toggleToday, { ownerId: A, habitId: id, today: D2 });
    expect(await countLogs(t, D2)).toBe(0);
  });

  test('undo today keeps yesterday streak alive', async () => {
    const t = setup();
    const id = await makeHabit(t);
    await logDates(t, id, [D0, D1]);
    await t.mutation(api.habits.toggleToday, { ownerId: A, habitId: id, today: D2 });
    const r = await t.mutation(api.habits.toggleToday, { ownerId: A, habitId: id, today: D2 });
    expect(r).toEqual({ loggedToday: false, streak: 2 });
  });

  test('throws on archived or deleted habit', async () => {
    const t = setup();
    const a = await makeHabit(t, 'A');
    const d = await makeHabit(t, 'D');
    await t.mutation(api.habits.archive, { ownerId: A, habitId: a });
    await t.mutation(api.habits.remove, { ownerId: A, habitId: d });
    await expect(t.mutation(api.habits.toggleToday, { ownerId: A, habitId: a, today: D2 })).rejects.toThrow();
    await expect(t.mutation(api.habits.toggleToday, { ownerId: A, habitId: d, today: D2 })).rejects.toThrow();
  });

  test('rejects malformed today', async () => {
    const t = setup();
    const id = await makeHabit(t);
    for (const today of ['', '2026-11-31', '18/11/2026', '2026-11-18T00:00']) {
      await expect(t.mutation(api.habits.toggleToday, { ownerId: A, habitId: id, today })).rejects.toThrow();
    }
  });
});

describe('list streaks', () => {
  test('gap days break the streak', async () => {
    const t = setup();
    const id = await makeHabit(t);
    await logDates(t, id, ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-14', D1, D2]);
    const [h] = await t.query(api.habits.list, { ownerId: A, today: D2 });
    expect(h).toMatchObject({ streak: 2, loggedToday: true });
  });

  test('yesterday only: streak alive, not logged today', async () => {
    const t = setup();
    const id = await makeHabit(t);
    await logDates(t, id, [D0, D1]);
    const [h] = await t.query(api.habits.list, { ownerId: A, today: D2 });
    expect(h).toMatchObject({ streak: 2, loggedToday: false });
  });

  test('last log two days ago: streak 0', async () => {
    const t = setup();
    const id = await makeHabit(t);
    await logDates(t, id, ['2026-11-15', D0]);
    const [h] = await t.query(api.habits.list, { ownerId: A, today: D2 });
    expect(h).toMatchObject({ streak: 0, loggedToday: false });
  });

  test('future log (clock moved back) ignored, not loggedToday', async () => {
    const t = setup();
    const id = await makeHabit(t);
    await logDates(t, id, ['2026-11-19', D1]);
    const [h] = await t.query(api.habits.list, { ownerId: A, today: D2 });
    expect(h).toMatchObject({ streak: 1, loggedToday: false });
  });

  test('midnight boundary: today changes between calls', async () => {
    const t = setup();
    const id = await makeHabit(t);
    await logDates(t, id, [D0]);
    expect(await t.mutation(api.habits.toggleToday, { ownerId: A, habitId: id, today: D1 })).toEqual({
      loggedToday: true,
      streak: 2,
    });
    // Clock passes midnight; same data, new today.
    let [h] = await t.query(api.habits.list, { ownerId: A, today: D2 });
    expect(h).toMatchObject({ streak: 2, loggedToday: false });
    // Tapping after midnight logs the new day, does not undo yesterday.
    expect(await t.mutation(api.habits.toggleToday, { ownerId: A, habitId: id, today: D2 })).toEqual({
      loggedToday: true,
      streak: 3,
    });
    expect(await countLogs(t, D1)).toBe(1);
    // Two midnights without logging: streak dies.
    [h] = await t.query(api.habits.list, { ownerId: A, today: '2026-11-20' });
    expect(h).toMatchObject({ streak: 0, loggedToday: false });
  });

  test('archived and deleted habits leave list; restore brings them back with streak', async () => {
    const t = setup();
    const keep = await makeHabit(t, 'Keep');
    const arch = await makeHabit(t, 'Arch');
    const del = await makeHabit(t, 'Del');
    await logDates(t, del, [D1, D2]);
    await t.mutation(api.habits.archive, { ownerId: A, habitId: arch });
    await t.mutation(api.habits.remove, { ownerId: A, habitId: del });
    let rows = await t.query(api.habits.list, { ownerId: A, today: D2 });
    expect(rows.map((r) => r._id)).toEqual([keep]);
    await t.mutation(api.habits.restore, { ownerId: A, habitId: del });
    await t.mutation(api.habits.restore, { ownerId: A, habitId: arch });
    rows = await t.query(api.habits.list, { ownerId: A, today: D2 });
    expect(rows.map((r) => r.name)).toEqual(['Keep', 'Arch', 'Del']);
    expect(rows[2]).toMatchObject({ streak: 2, loggedToday: true });
  });

  test('archived then deleted, restore clears both', async () => {
    const t = setup();
    const id = await makeHabit(t);
    await t.mutation(api.habits.archive, { ownerId: A, habitId: id });
    await t.mutation(api.habits.remove, { ownerId: A, habitId: id });
    expect(await t.query(api.habits.list, { ownerId: A, today: D2 })).toHaveLength(0);
    await t.mutation(api.habits.restore, { ownerId: A, habitId: id });
    expect(await t.query(api.habits.list, { ownerId: A, today: D2 })).toHaveLength(1);
  });

  test('list is scoped to owner, oldest first, exact shape', async () => {
    const t = setup();
    await makeHabit(t, 'First');
    await makeHabit(t, 'Other', B);
    await makeHabit(t, 'Second');
    const rows = await t.query(api.habits.list, { ownerId: A, today: D2 });
    expect(rows.map((r) => r.name)).toEqual(['First', 'Second']);
    expect(Object.keys(rows[0]).sort()).toEqual(['_creationTime', '_id', 'loggedToday', 'name', 'streak']);
    expect(await t.query(api.habits.list, { ownerId: 'nobody', today: D2 })).toEqual([]);
  });

  test('list rejects malformed today', async () => {
    const t = setup();
    await expect(t.query(api.habits.list, { ownerId: A, today: '2026-13-01' })).rejects.toThrow();
  });
});

describe('wrong owner throws on every function', () => {
  const calls = {
    toggleToday: (t: ReturnType<typeof setup>, habitId: never) =>
      t.mutation(api.habits.toggleToday, { ownerId: B, habitId, today: D2 }),
    archive: (t: ReturnType<typeof setup>, habitId: never) => t.mutation(api.habits.archive, { ownerId: B, habitId }),
    remove: (t: ReturnType<typeof setup>, habitId: never) => t.mutation(api.habits.remove, { ownerId: B, habitId }),
    restore: (t: ReturnType<typeof setup>, habitId: never) => t.mutation(api.habits.restore, { ownerId: B, habitId }),
  };
  for (const [name, call] of Object.entries(calls)) {
    test(`${name} by another owner throws and changes nothing`, async () => {
      const t = setup();
      const id = await makeHabit(t);
      await logDates(t, id, [D1]);
      if (name === 'restore') await t.mutation(api.habits.archive, { ownerId: A, habitId: id });
      await expect(call(t, id as never)).rejects.toThrow(/does not belong/);
      const habit = await t.run(async (ctx) => await ctx.db.get(id));
      expect(habit?.deletedAt).toBeUndefined();
      if (name !== 'restore') expect(habit?.archivedAt).toBeUndefined();
      else expect(habit?.archivedAt).toBeDefined();
      expect(await countLogs(t, D2)).toBe(0);
    });
  }

  test('list for another owner does not leak habits', async () => {
    const t = setup();
    await makeHabit(t);
    expect(await t.query(api.habits.list, { ownerId: B, today: D2 })).toEqual([]);
  });

  test('empty ownerId rejected', async () => {
    const t = setup();
    await expect(t.mutation(api.habits.create, { ownerId: '', name: 'x' })).rejects.toThrow();
    await expect(t.query(api.habits.list, { ownerId: '  ', today: D2 })).rejects.toThrow();
  });

  test('deleted habit id (hard-deleted) throws not found', async () => {
    const t = setup();
    const id = await makeHabit(t);
    await t.run(async (ctx) => ctx.db.delete(id));
    await expect(t.mutation(api.habits.archive, { ownerId: A, habitId: id })).rejects.toThrow(/not found/);
  });
});

describe('create validation', () => {
  test('trims the name', async () => {
    const t = setup();
    const id = await makeHabit(t, '   Drink water  ');
    const h = await t.run(async (ctx) => ctx.db.get(id));
    expect(h?.name).toBe('Drink water');
  });
  test('empty and whitespace-only throw', async () => {
    const t = setup();
    await expect(makeHabit(t, '')).rejects.toThrow();
    await expect(makeHabit(t, '    ')).rejects.toThrow();
    expect(await t.query(api.habits.list, { ownerId: A, today: D2 })).toHaveLength(0);
  });
  test('60 chars ok, 61 throws', async () => {
    const t = setup();
    await expect(makeHabit(t, 'a'.repeat(60))).resolves.toBeDefined();
    await expect(makeHabit(t, 'a'.repeat(61))).rejects.toThrow(/60/);
  });
  test('61 raw chars that trim to 60 is ok', async () => {
    const t = setup();
    await expect(makeHabit(t, `${'b'.repeat(60)} `)).resolves.toBeDefined();
  });
});
