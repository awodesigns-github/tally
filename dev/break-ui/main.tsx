import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MotionConfig } from 'motion/react';
import '../../src/index.css';
import { HabitCard } from '../../src/components/HabitCard';
import { UndoToast } from '../../src/components/UndoToast';
import { EmptyState } from '../../src/components/EmptyState';
import * as F from './fixtures';

const STATES = ['demo', 'worst', 'empty', 'one', 'huge'] as const;
type S = (typeof STATES)[number];
const initial = (new URLSearchParams(location.search).get('data') as S) ?? 'demo';

function App() {
  const [s, setS] = useState<S>(STATES.includes(initial) ? initial : 'demo');
  const habits = s === 'empty' ? [] : F[s];
  const pick = (n: S) => {
    setS(n);
    const u = new URL(location.href);
    u.searchParams.set('data', n);
    history.replaceState(null, '', u);
  };
  return (
    <MotionConfig reducedMotion="user">
      <main className="screen">
        <ul className="list">
          {habits.map((habit, i) => (
            <li className="row" key={habit._id}>
              <HabitCard habit={habit} disabled={false} celebrating={s === 'worst' && i === 2}
                onToggle={() => {}} onDelete={() => {}} onArchive={() => {}} />
            </li>
          ))}
        </ul>
        {habits.length === 0 && <EmptyState />}
        {habits[0] && <UndoToast name={habits[0].name} verb="archived" onUndo={() => {}} />}
      </main>
      <div style={{ position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex',
        background: '#ddd', borderRadius: 8, padding: 2, font: '12px system-ui', zIndex: 99 }}>
        {STATES.map((n) => (
          <button key={n} onClick={() => pick(n)} style={{ border: 0, borderRadius: 6, padding: '4px 8px',
            background: s === n ? '#fff' : 'transparent' }}>{n}</button>
        ))}
      </div>
    </MotionConfig>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
