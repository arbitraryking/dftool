import { useAppDispatch, useAppState } from '../state/appStore';

export function MapSelector() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  return (
    <label>
      选择地图
      <select
        value={state.settings?.selectedMapId ?? ''}
        onChange={(event) => dispatch({ type: 'selectMap', mapId: event.target.value })}
      >
        {state.maps.map((map) => (
          <option key={map.id} value={map.id}>
            {map.name}
          </option>
        ))}
      </select>
    </label>
  );
}
