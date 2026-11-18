import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import type { Habit } from '../lib/api';
import { sessionFlag, setSessionFlag } from '../lib/storage';
import { isTempId, useStableKeys } from '../lib/useHabits';
import { HabitCard } from './HabitCard';

const ENTERED_KEY = 'tally:entered';
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Non-uniform stagger from the Figma motion notes; later cards keep the 120ms cap moving by 20ms. */
const STAGGER = [0, 0.05, 0.09, 0.12];
const staggerDelay = (i: number) => STAGGER[i] ?? Math.min(0.12 + (i - 3) * 0.02, 0.2);

// Module-level on purpose: the entrance belongs to the page session, not to a component instance.
const staggerThisLoad = !sessionFlag(ENTERED_KEY);
let listHasRendered = false;

type Props = {
  habits: Habit[];
  celebrating: ReadonlySet<string>;
  onToggle: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
};

export function HabitList({ habits, celebrating, onToggle, onDelete, onArchive }: Props) {
  const reduceMotion = useReducedMotion();
  const keyFor = useStableKeys(habits);

  // The first-load stagger runs once per browser session. Cards rendered on that
  // first pass stagger; cards that mount later (add, undo) get a plain entrance.
  const onFirstPass = !listHasRendered;
  useEffect(() => {
    listHasRendered = true;
    setSessionFlag(ENTERED_KEY);
  }, []);

  const rise = reduceMotion ? 0 : 8;

  return (
    <ul className="list">
      <AnimatePresence mode="popLayout">
        {habits.map((habit, i) => {
          const animateIn = !onFirstPass || staggerThisLoad;
          return (
            <motion.li
              key={keyFor(habit._id)}
              className="row"
              layout="position"
              initial={animateIn ? { opacity: 0, y: rise } : false}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  duration: onFirstPass ? 0.3 : 0.25,
                  ease: EASE_OUT,
                  delay: onFirstPass ? staggerDelay(i) : 0,
                },
              }}
              exit={{
                opacity: 0,
                scale: reduceMotion ? 1 : 0.96,
                transition: { duration: 0.2, ease: EASE_OUT },
              }}
              transition={{ layout: { type: 'spring', duration: 0.45, bounce: 0 } }}
            >
              <HabitCard
                habit={habit}
                disabled={isTempId(habit._id)}
                celebrating={celebrating.has(habit._id)}
                onToggle={() => onToggle(habit)}
                onDelete={() => onDelete(habit)}
                onArchive={() => onArchive(habit)}
              />
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
