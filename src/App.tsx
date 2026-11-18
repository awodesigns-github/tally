import { MotionConfig } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast, Toaster } from 'sonner';
import { AddHabit } from './components/AddHabit';
import { EmptyState } from './components/EmptyState';
import { HabitList } from './components/HabitList';
import { UndoToast } from './components/UndoToast';
import type { Habit } from './lib/api';
import { claimMilestone } from './lib/storage';
import { isTempId, useHabits } from './lib/useHabits';

const MILESTONE = 7;
const CELEBRATION_MS = 3200;
const TOAST_MS = 4000;

const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

const reportError = () => toast.error("Couldn't save that. Check your connection and try again.");

export default function App() {
  const { list, today, create, toggle, archive, remove, restore } = useHabits();
  const celebration = useCelebrations();

  const onToggle = (habit: Habit) => {
    if (isTempId(habit._id)) return;
    if (!habit.loggedToday && habit.streak + 1 === MILESTONE && claimMilestone(habit._id)) {
      celebration.start(habit._id);
    } else if (habit.loggedToday) {
      celebration.stop(habit._id);
    }
    toggle(habit._id).catch(reportError);
  };

  const hideWithUndo = (habit: Habit, verb: 'archived' | 'deleted') => {
    if (isTempId(habit._id)) return;
    celebration.stop(habit._id);
    const action = verb === 'archived' ? archive : remove;
    action(habit).catch(reportError);
    toast.custom(
      (id) => (
        <UndoToast
          name={habit.name}
          verb={verb}
          onUndo={() => {
            toast.dismiss(id);
            restore(habit._id).catch(reportError);
          }}
        />
      ),
      { duration: TOAST_MS },
    );
  };

  const total = list?.length ?? 0;
  const logged = list?.filter((h) => h.loggedToday).length ?? 0;
  const summary = list === undefined ? '' : total === 0 ? '0 habits' : `${logged} of ${total} logged`;

  return (
    <MotionConfig reducedMotion="user">
      <main className="screen">
        <header className="header">
          <p className="t-caption header-date">{dateFormat.format(dateFromKey(today))}</p>
          <div className="header-row">
            <h1 className="t-title">Today</h1>
            <p className="t-caption header-summary" aria-live="polite">
              {summary}
            </p>
          </div>
        </header>

        <AddHabit onAdd={(name) => void create(name).catch(reportError)} />

        {list !== undefined && (
          <>
            <HabitList
              habits={list}
              celebrating={celebration.active}
              onToggle={onToggle}
              onDelete={(h) => hideWithUndo(h, 'deleted')}
              onArchive={(h) => hideWithUndo(h, 'archived')}
            />
            {total === 0 && <EmptyState />}
          </>
        )}
      </main>
      <Toaster
        position="bottom-center"
        offset={{ bottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        mobileOffset={{
          bottom: 'calc(16px + env(safe-area-inset-bottom))',
          left: 'max(16px, env(safe-area-inset-left))',
          right: 'max(16px, env(safe-area-inset-right))',
        }}
        swipeDirections={['bottom']}
        visibleToasts={3}
      />
    </MotionConfig>
  );
}

function dateFromKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Which habits are mid-celebration. Each one ends on its own after a few seconds. */
function useCelebrations() {
  const [active, setActive] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, number>());

  const stop = useCallback((id: string) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setActive((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const start = useCallback(
    (id: string) => {
      window.clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        window.setTimeout(() => stop(id), CELEBRATION_MS),
      );
      setActive((prev) => new Set(prev).add(id));
    },
    [stop],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);

  return { active, start, stop };
}
