import React, { createContext, Dispatch, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { deletePoint, movePoint, NewMapPoint, addPoint, updatePoint } from '../domain/markerEditing';
import { LootTypesConfig, MapConfig, MapPoint, UserSettings } from '../domain/schemas';
import { loadInitialConfig, persistMapConfig, persistUserSettings } from '../services/configStore';

export type AppMode = 'browse' | 'inspect' | 'edit';

export type AppState = {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  runtimeError?: string;
  mode: AppMode;
  overlayVisible: boolean;
  lootTypes?: LootTypesConfig;
  maps: MapConfig[];
  settings?: UserSettings;
  selectedPointId?: string;
  editingPoint?: MapPoint | NewMapPoint;
  dirtyMapIds: string[];
  pendingImportedScreenshotsByMapId: Record<string, string[]>;
  settingsDirty: boolean;
};

export type AppAction =
  | { type: 'loaded'; lootTypes: LootTypesConfig; maps: MapConfig[]; settings: UserSettings }
  | { type: 'failed'; error: string }
  | { type: 'setRuntimeError'; error?: string }
  | { type: 'setMode'; mode: AppMode }
  | { type: 'setOverlayVisible'; visible: boolean }
  | { type: 'selectMap'; mapId: string }
  | { type: 'toggleLootType'; typeId: string; visible: boolean }
  | { type: 'selectPoint'; pointId?: string }
  | { type: 'startAddPoint'; point: NewMapPoint }
  | { type: 'startEditPoint'; point: MapPoint }
  | { type: 'closeEditor' }
  | { type: 'savePoint'; point: MapPoint | NewMapPoint; originalPointId?: string }
  | { type: 'movePoint'; pointId: string; x: number; y: number }
  | { type: 'deletePoint'; pointId: string }
  | { type: 'addPendingImportedScreenshots'; mapId: string; paths: string[] }
  | { type: 'clearPendingImportedScreenshots'; mapId: string }
  | { type: 'markMapClean'; mapId: string }
  | { type: 'markSettingsClean' };

type SyncedAction = Exclude<AppAction, { type: 'loaded' | 'failed' }>;

type SyncedActionPayload = {
  origin: string;
  action: SyncedAction;
};

const SYNC_EVENT = 'dftool://state-action';
const instanceId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const canUseTauriEvents = '__TAURI_INTERNALS__' in window;

const initialState: AppState = {
  status: 'loading',
  mode: 'browse',
  overlayVisible: false,
  maps: [],
  dirtyMapIds: [],
  pendingImportedScreenshotsByMapId: {},
  settingsDirty: false,
};

function shouldSyncAction(action: AppAction): action is SyncedAction {
  return action.type !== 'loaded' && action.type !== 'failed';
}

function markDirty(state: AppState, mapId: string): AppState {
  return state.dirtyMapIds.includes(mapId)
    ? state
    : { ...state, dirtyMapIds: [...state.dirtyMapIds, mapId] };
}

function replaceSelectedMap(state: AppState, map: MapConfig): AppState {
  return {
    ...markDirty(state, map.id),
    maps: state.maps.map((item) => (item.id === map.id ? map : item)),
  };
}

export function getSelectedMap(state: AppState): MapConfig | undefined {
  return state.maps.find((map) => map.id === state.settings?.selectedMapId) ?? state.maps[0];
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'loaded':
      return {
        ...state,
        status: 'ready',
        lootTypes: action.lootTypes,
        maps: action.maps,
        settings: action.settings,
      };
    case 'failed':
      return { ...state, status: 'error', error: action.error };
    case 'setRuntimeError':
      return { ...state, runtimeError: action.error };
    case 'setMode':
      return { ...state, mode: action.mode, selectedPointId: undefined };
    case 'setOverlayVisible':
      return { ...state, overlayVisible: action.visible };
    case 'selectMap':
      if (!state.settings) return state;
      return {
        ...state,
        selectedPointId: undefined,
        settingsDirty: true,
        settings: { ...state.settings, selectedMapId: action.mapId },
      };
    case 'toggleLootType':
      if (!state.settings) return state;
      return {
        ...state,
        settingsDirty: true,
        settings: {
          ...state.settings,
          visibleLootTypes: {
            ...state.settings.visibleLootTypes,
            [action.typeId]: action.visible,
          },
        },
      };
    case 'selectPoint':
      return { ...state, selectedPointId: action.pointId };
    case 'startAddPoint':
      return { ...state, editingPoint: action.point };
    case 'startEditPoint':
      return { ...state, editingPoint: action.point };
    case 'closeEditor':
      return { ...state, editingPoint: undefined };
    case 'savePoint': {
      const selectedMap = getSelectedMap(state);
      if (!selectedMap) return state;
      const originalPointId = action.originalPointId ?? ('id' in action.point ? action.point.id : undefined);
      const hasExistingPoint = Boolean(originalPointId && selectedMap.points.some((point) => point.id === originalPointId));
      const nextMap = hasExistingPoint && originalPointId
        ? updatePoint(selectedMap, originalPointId, action.point)
        : addPoint(selectedMap, action.point);
      return { ...replaceSelectedMap(state, nextMap), editingPoint: undefined };
    }
    case 'movePoint': {
      const selectedMap = getSelectedMap(state);
      return selectedMap ? replaceSelectedMap(state, movePoint(selectedMap, action.pointId, action)) : state;
    }
    case 'deletePoint': {
      const selectedMap = getSelectedMap(state);
      return selectedMap ? replaceSelectedMap(state, deletePoint(selectedMap, action.pointId)) : state;
    }
    case 'addPendingImportedScreenshots': {
      const existing = state.pendingImportedScreenshotsByMapId[action.mapId] ?? [];
      const paths = [...new Set([...existing, ...action.paths])];
      return {
        ...state,
        pendingImportedScreenshotsByMapId: {
          ...state.pendingImportedScreenshotsByMapId,
          [action.mapId]: paths,
        },
      };
    }
    case 'clearPendingImportedScreenshots': {
      const { [action.mapId]: _removed, ...pendingImportedScreenshotsByMapId } = state.pendingImportedScreenshotsByMapId;
      return { ...state, pendingImportedScreenshotsByMapId };
    }
    case 'markMapClean':
      return { ...state, dirtyMapIds: state.dirtyMapIds.filter((id) => id !== action.mapId) };
    case 'markSettingsClean':
      return { ...state, settingsDirty: false };
    default:
      return state;
  }
}

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<Dispatch<AppAction> | undefined>(undefined);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(reducer, initialState);

  const dispatch = useCallback<Dispatch<AppAction>>((action) => {
    baseDispatch(action);

    if (canUseTauriEvents && shouldSyncAction(action)) {
      void emit(SYNC_EVENT, { origin: instanceId, action } satisfies SyncedActionPayload);
    }
  }, []);

  useEffect(() => {
    loadInitialConfig()
      .then((config) => baseDispatch({ type: 'loaded', ...config }))
      .catch((error: unknown) => baseDispatch({ type: 'failed', error: error instanceof Error ? error.message : String(error) }));
  }, []);

  useEffect(() => {
    if (!canUseTauriEvents) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<SyncedActionPayload>(SYNC_EVENT, (event) => {
      if (!disposed && event.payload.origin !== instanceId) {
        baseDispatch(event.payload.action);
      }
    }).then((cleanup) => {
      unlisten = cleanup;
    }).catch((error: unknown) => {
      baseDispatch({ type: 'setRuntimeError', error: `同步窗口状态失败：${error instanceof Error ? error.message : String(error)}` });
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const stateValue = useMemo(() => state, [state]);

  return React.createElement(
    AppStateContext.Provider,
    { value: stateValue },
    React.createElement(AppDispatchContext.Provider, { value: dispatch }, children),
  );
}

export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (!state) throw new Error('useAppState must be used inside AppStoreProvider');
  return state;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const dispatch = useContext(AppDispatchContext);
  if (!dispatch) throw new Error('useAppDispatch must be used inside AppStoreProvider');
  return dispatch;
}

export async function saveCurrentSettings(state: AppState): Promise<void> {
  if (state.settings) {
    await persistUserSettings(state.settings);
  }
}

export async function saveCurrentMap(state: AppState): Promise<string | undefined> {
  const selectedMap = getSelectedMap(state);
  if (!selectedMap) return undefined;
  await persistMapConfig(selectedMap, state.lootTypes);
  return selectedMap.id;
}
