import { useAppDispatch, useAppState } from '../state/appStore';

export function LootTypeFilters() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  if (!state.lootTypes || !state.settings) {
    return null;
  }

  return (
    <div className="panel">
      {state.lootTypes.types.map((type) => (
        <label key={type.id} className="row">
          <input
            type="checkbox"
            checked={state.settings?.visibleLootTypes[type.id] ?? type.defaultVisible}
            onChange={(event) => dispatch({ type: 'toggleLootType', typeId: type.id, visible: event.target.checked })}
            style={{ width: 'auto' }}
          />
          <span style={{ color: type.color }}>{type.name}</span>
        </label>
      ))}
    </div>
  );
}
