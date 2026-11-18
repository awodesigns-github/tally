type Props = {
  name: string;
  verb: 'archived' | 'deleted';
  onUndo: () => void;
};

export function UndoToast({ name, verb, onUndo }: Props) {
  return (
    <div className="toast">
      <p className="t-body toast-message">
        <span className="toast-name">“{name}</span>
        <span className="toast-suffix">” {verb}</span>
      </p>
      <button type="button" className="toast-undo t-habit-name" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
