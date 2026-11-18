import NumberFlow from '@number-flow/react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import archiveIcon from '../assets/archive.svg';
import checkIcon from '../assets/check.svg';
import type { Habit } from '../lib/api';

/** Press longer than this and the delete sweep starts (so a normal tap never flashes red). */
const HOLD_DELAY = 250;
/** Matches --hold-duration in index.css. */
const HOLD_DURATION = 2000;
/** Movement before a press becomes a swipe or a scroll. */
const SLOP = 8;
const ARCHIVE_DISTANCE = 0.4;
const FLICK_VELOCITY = 0.11; // px/ms

const ARCHIVE_SPRING = { type: 'spring', duration: 0.5, bounce: 0.2 } as const;
const SNAP_BACK_SPRING = { type: 'spring', duration: 0.4, bounce: 0 } as const;

type Gesture =
  | { kind: 'idle' }
  | { kind: 'pending'; id: number; x0: number; y0: number; t0: number }
  | { kind: 'swiping'; id: number; x0: number; samples: { x: number; t: number }[] };

type Props = {
  habit: Habit;
  disabled: boolean;
  celebrating: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onArchive: () => void;
};

export function HabitCard({ habit, disabled, celebrating, onToggle, onDelete, onArchive }: Props) {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture>({ kind: 'idle' });
  const timers = useRef<number[]>([]);
  const committed = useRef(false);
  const [pressed, setPressed] = useState(false);
  const [holding, setHolding] = useState(false);

  const x = useMotionValue(0);
  const actionOpacity = useTransform(x, [-56, -8], [1, 0]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const reset = () => {
    clearTimers();
    gesture.current = { kind: 'idle' };
    setPressed(false);
    setHolding(false);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || committed.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (gesture.current.kind !== 'idle') return; // ignore extra fingers
    x.stop();
    gesture.current = { kind: 'pending', id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp };
    setPressed(true);
    timers.current.push(
      window.setTimeout(() => setHolding(true), HOLD_DELAY),
      window.setTimeout(() => {
        committed.current = true;
        reset();
        navigator.vibrate?.(12);
        onDelete();
      }, HOLD_DELAY + HOLD_DURATION),
    );
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g.kind === 'idle' || e.pointerId !== g.id) return;

    if (g.kind === 'pending') {
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) {
        clearTimers();
        setPressed(false);
        setHolding(false);
        e.currentTarget.setPointerCapture(e.pointerId);
        // Start tracking from the current finger position so there's no jump.
        gesture.current = { kind: 'swiping', id: g.id, x0: e.clientX, samples: [{ x: 0, t: e.timeStamp }] };
      } else if (Math.abs(dy) > SLOP) {
        reset(); // it's a scroll
      }
      return;
    }

    const dx = e.clientX - g.x0;
    // 1:1 to the left; heavy friction to the right, where there's nothing to reveal.
    const next = dx < 0 ? dx : Math.sqrt(dx) * 2;
    x.set(next);
    g.samples.push({ x: next, t: e.timeStamp });
    if (g.samples.length > 6) g.samples.shift();
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g.kind === 'idle' || e.pointerId !== g.id) return;

    if (g.kind === 'pending') {
      const quick = e.timeStamp - g.t0 < HOLD_DELAY;
      reset();
      if (quick) onToggle();
      return;
    }

    reset();
    const width = trackRef.current?.offsetWidth ?? 358;
    const first = g.samples[0];
    const last = g.samples[g.samples.length - 1];
    const dt = Math.max(1, last.t - first.t);
    const velocity = (last.x - first.x) / dt;
    const current = x.get();

    if (current < 0 && (-current > width * ARCHIVE_DISTANCE || velocity < -FLICK_VELOCITY)) {
      committed.current = true;
      if (reduceMotion) {
        onArchive();
        return;
      }
      // Let the fly-off finish before the row leaves, so its exit fade doesn't cut the spring.
      // Fire as soon as the card clears the track edge (the overshoot is off-screen anyway).
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        onArchive();
      };
      animate(x, -width - 24, {
        ...ARCHIVE_SPRING,
        velocity: velocity * 1000,
        onUpdate: (v) => {
          if (v <= -width) finish();
        },
      }).then(finish);
    } else {
      animate(x, 0, SNAP_BACK_SPRING);
    }
  };

  const onPointerCancel = () => {
    reset();
    if (x.get() !== 0) animate(x, 0, SNAP_BACK_SPRING);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  const unit = habit.streak === 1 ? 'day' : 'days';
  const subtitle = holding
    ? 'Keep holding to delete'
    : celebrating
      ? 'One week. Keep it going'
      : habit.loggedToday
        ? 'Logged today'
        : habit.streak === 0
          ? 'Start a streak today'
          : 'Tap to log today';

  return (
    <>
      <div className="track" ref={trackRef} data-pressed={pressed && !holding}>
        <motion.div className="archive-action" style={{ opacity: actionOpacity }} aria-hidden>
          <div className="archive-action-inner">
            <img src={archiveIcon} width={20} height={20} alt="" />
            <span className="t-caption">Archive</span>
          </div>
        </motion.div>

        <motion.div className="card-x" style={{ x }}>
          <div
            className="card"
            role="button"
            tabIndex={0}
            aria-pressed={habit.loggedToday}
            aria-label={`${habit.name}, ${habit.streak} ${unit} streak${habit.loggedToday ? ', logged today' : ''}`}
            aria-description="Tap to log today. Hold to delete. Swipe left to archive."
            data-pressed={pressed && !holding}
            data-holding={holding}
            data-logged={habit.loggedToday}
            data-milestone={celebrating}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={onKeyDown}
          >
            <div className="sweep" />
            <div className="check">
              <div className="check-fill">
                <img src={checkIcon} width={16} height={16} alt="" />
              </div>
            </div>
            <div className="card-text">
              <span className="t-habit-name" dir="auto">{habit.name}</span>
              <span className="t-caption card-sub">{subtitle}</span>
            </div>
            <div className="streak">
              <span className="streak-num">
                <NumberFlow
                  className="t-streak streak-value"
                  value={habit.streak}
                  transformTiming={{ duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
                  spinTiming={{ duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
                  opacityTiming={{ duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
                />
              </span>
              <span className="t-caption streak-unit">{unit}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>{celebrating && <Milestone key="milestone" />}</AnimatePresence>
    </>
  );
}

const CONFETTI = Array.from({ length: 10 }, (_, i) => {
  const angle = (-170 + (i * 160) / 9) * (Math.PI / 180);
  const distance = 26 + ((i * 7) % 4) * 6;
  return {
    x: Math.cos(angle) * distance * 1.6,
    y: Math.sin(angle) * distance,
    color: ['#2f9e5b', '#7cc996', '#f2b84b', '#2f9e5b', '#e3f3e8'][i % 5],
    delay: (i % 3) * 0.03,
  };
});

function Milestone() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="milestone"
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
      transition={{ type: 'spring', duration: 0.45, bounce: 0.3 }}
      role="status"
    >
      <div className="milestone-badge t-caption">7-day streak</div>
      {!reduceMotion &&
        CONFETTI.map((c, i) => (
          <motion.span
            key={i}
            className="confetti"
            style={{ background: c.color }}
            initial={{ opacity: 1, x: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: 0, x: c.x, y: c.y, scale: 1 }}
            transition={{ duration: 0.6, delay: c.delay, ease: [0.23, 1, 0.32, 1] }}
          />
        ))}
    </motion.div>
  );
}
