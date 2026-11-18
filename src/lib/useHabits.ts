import { useMutation, useQuery } from 'convex/react';
import type { OptimisticLocalStore } from 'convex/browser';
import { useCallback, useEffect, useState } from 'react';
import { habits as api, type Habit, type HabitId } from './api';
import { getOwnerId, localDate } from './owner';

const TEMP_PREFIX = 'optimistic:';

export const isTempId = (id: string) => id.startsWith(TEMP_PREFIX);

/** "today" follows the local calendar: refreshed whenever the tab comes back. */
function useToday() {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setToday(localDate());
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return today;
}

const byCreation = (a: Habit, b: Habit) => a._creationTime - b._creationTime;

/** Last-known copy of each archived/deleted habit, so Undo can put it straight back. */
const snapshots = new Map<string, Habit>();

// Optimistic updates live at module level: they run when a mutation is called, never during render.

function insertOptimistic(store: OptimisticLocalStore, { ownerId, name }: { ownerId: string; name: string }) {
  const args = { ownerId, today: localDate() };
  const current = store.getQuery(api.list, args);
  if (!current) return;
  const temp: Habit = {
    _id: `${TEMP_PREFIX}${crypto.randomUUID()}` as HabitId,
    _creationTime: Date.now(),
    name: name.trim(),
    streak: 0,
    loggedToday: false,
  };
  store.setQuery(api.list, args, [...current, temp]);
}

function toggleOptimistic(
  store: OptimisticLocalStore,
  { ownerId, habitId, today }: { ownerId: string; habitId: HabitId; today: string },
) {
  const args = { ownerId, today };
  const current = store.getQuery(api.list, args);
  if (!current) return;
  store.setQuery(
    api.list,
    args,
    current.map((h) =>
      h._id === habitId
        ? { ...h, loggedToday: !h.loggedToday, streak: Math.max(0, h.streak + (h.loggedToday ? -1 : 1)) }
        : h,
    ),
  );
}

function hideOptimistic(store: OptimisticLocalStore, { ownerId, habitId }: { ownerId: string; habitId: HabitId }) {
  const args = { ownerId, today: localDate() };
  const current = store.getQuery(api.list, args);
  if (!current) return;
  store.setQuery(
    api.list,
    args,
    current.filter((h) => h._id !== habitId),
  );
}

function restoreOptimistic(store: OptimisticLocalStore, { ownerId, habitId }: { ownerId: string; habitId: HabitId }) {
  const args = { ownerId, today: localDate() };
  const current = store.getQuery(api.list, args);
  const snapshot = snapshots.get(habitId);
  if (!current || !snapshot || current.some((h) => h._id === habitId)) return;
  store.setQuery(api.list, args, [...current, snapshot].sort(byCreation));
}

export function useHabits() {
  const ownerId = getOwnerId();
  const today = useToday();
  const list = useQuery(api.list, { ownerId, today });

  const create = useMutation(api.create).withOptimisticUpdate(insertOptimistic);
  const toggle = useMutation(api.toggleToday).withOptimisticUpdate(toggleOptimistic);
  const archive = useMutation(api.archive).withOptimisticUpdate(hideOptimistic);
  const remove = useMutation(api.remove).withOptimisticUpdate(hideOptimistic);
  const restore = useMutation(api.restore).withOptimisticUpdate(restoreOptimistic);

  return {
    list,
    today,
    create: (name: string) => create({ ownerId, name }),
    toggle: (habitId: HabitId) => toggle({ ownerId, habitId, today }),
    archive: (habit: Habit) => {
      snapshots.set(habit._id, habit);
      return archive({ ownerId, habitId: habit._id });
    },
    remove: (habit: Habit) => {
      snapshots.set(habit._id, habit);
      return remove({ ownerId, habitId: habit._id });
    },
    restore: (habitId: HabitId) => restore({ ownerId, habitId }),
  };
}

type KeyState = { items: Habit[]; keys: ReadonlyMap<string, string> };

function nextKeys(prev: KeyState, items: Habit[]): KeyState {
  const keys = new Map(prev.keys);
  const ids = new Set<string>(items.map((i) => i._id));
  const vanished = prev.items.filter((p) => isTempId(p._id) && !ids.has(p._id));
  for (const item of items) {
    if (keys.has(item._id)) continue;
    const idx = isTempId(item._id) ? -1 : vanished.findIndex((t) => t.name === item.name);
    if (idx >= 0) {
      keys.set(item._id, keys.get(vanished[idx]._id) ?? item._id);
      vanished.splice(idx, 1);
    } else {
      keys.set(item._id, item._id);
    }
  }
  return { items, keys };
}

/**
 * Keeps React keys stable when an optimistic habit is swapped for the real one,
 * so the card doesn't remount (and re-animate) when the server confirms.
 */
export function useStableKeys(items: Habit[]) {
  const [state, setState] = useState<KeyState>(() => nextKeys({ items: [], keys: new Map() }, items));
  let current = state;
  if (state.items !== items) {
    current = nextKeys(state, items);
    setState(current); // derived state, updated during render (React re-renders before committing)
  }
  const { keys } = current;
  return useCallback((id: string) => keys.get(id) ?? id, [keys]);
}
