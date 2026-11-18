import { useRef, useState, type FormEvent } from 'react';
import plusIcon from '../assets/plus.svg';

export const MAX_NAME = 60;

export function AddHabit({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const name = value.trim();
  /** Code points, matching the backend's [...name].length (UTF-16 maxLength cuts emoji early). */
  const length = (str: string) => [...str].length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.length === 0 || length(name) > MAX_NAME) {
      inputRef.current?.focus();
      return;
    }
    onAdd(name);
    setValue('');
  };

  return (
    <form className="add" onSubmit={submit}>
      <input
        ref={inputRef}
        className="add-input"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(length(next) > MAX_NAME ? [...next].slice(0, MAX_NAME).join('') : next);
        }}
        placeholder="Add a habit…"
        aria-label="New habit name"
        autoComplete="off"
        autoCorrect="on"
        autoCapitalize="sentences"
        enterKeyHint="done"
      />
      <button
        type="submit"
        className="add-button"
        aria-label="Add habit"
        // Keep focus (and the keyboard) on the input so several habits can be added in a row.
        onPointerDown={(e) => e.preventDefault()}
      >
        <img src={plusIcon} width={20} height={20} alt="" />
      </button>
    </form>
  );
}
