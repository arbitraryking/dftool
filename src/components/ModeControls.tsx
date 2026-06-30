import { AppMode, useAppDispatch, useAppState } from '../state/appStore';

const modes: Array<{ mode: AppMode; label: string }> = [
  { mode: 'browse', label: '浏览模式' },
  { mode: 'inspect', label: '交互模式' },
  { mode: 'edit', label: '编辑模式' },
];

export function ModeControls() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="row">
      {modes.map((item) => (
        <button
          key={item.mode}
          className={state.mode === item.mode ? 'active' : undefined}
          onClick={() => dispatch({ type: 'setMode', mode: item.mode })}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
