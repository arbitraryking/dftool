import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getAdjacentMapId } from '../domain/mapSelection';
import { getSelectedMap, AppState, useAppDispatch, useAppState } from '../state/appStore';
import { setOverlayVisible } from '../services/tauriApi';

const canUseTauri = '__TAURI_INTERNALS__' in window;
const SHORTCUT_EVENT = 'dftool://global-shortcut';

type GlobalShortcutsProps = {
  onError?: (message: string) => void;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shortcutKey(shortcut: string): string {
  const parts = shortcut.toLowerCase().split('+');
  return parts[parts.length - 1] ?? '';
}

export function GlobalShortcuts({ onError }: GlobalShortcutsProps) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const stateRef = useRef<AppState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!canUseTauri) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<string>(SHORTCUT_EVENT, (event) => {
      if (disposed) return;

      const currentState = stateRef.current;
      const key = shortcutKey(event.payload);

      switch (key) {
        case 'pageup': {
          const selectedMap = getSelectedMap(currentState);
          if (selectedMap) {
            dispatch({ type: 'selectMap', mapId: getAdjacentMapId(currentState.maps, selectedMap.id, -1) });
          }
          break;
        }
        case 'pagedown': {
          const selectedMap = getSelectedMap(currentState);
          if (selectedMap) {
            dispatch({ type: 'selectMap', mapId: getAdjacentMapId(currentState.maps, selectedMap.id, 1) });
          }
          break;
        }
        case 'keyh': {
          const visible = !currentState.overlayVisible;
          dispatch({ type: 'setOverlayVisible', visible });
          void setOverlayVisible(visible).catch((error: unknown) => {
            dispatch({ type: 'setOverlayVisible', visible: !visible });
            onError?.(`快捷键切换覆盖层失败：${errorMessage(error)}`);
          });
          break;
        }
        case 'digit1':
          dispatch({ type: 'setMode', mode: 'browse' });
          break;
        case 'digit2':
          dispatch({ type: 'setMode', mode: 'inspect' });
          break;
        case 'digit3':
          dispatch({ type: 'setMode', mode: 'edit' });
          break;
        case 'space':
          dispatch({ type: 'setMode', mode: currentState.mode === 'browse' ? 'inspect' : 'browse' });
          break;
        case 'keye':
          dispatch({ type: 'setMode', mode: currentState.mode === 'edit' ? 'browse' : 'edit' });
          break;
      }
    }).then((cleanup) => {
      unlisten = cleanup;
    }).catch((error: unknown) => {
      onError?.(`监听全局快捷键失败：${errorMessage(error)}`);
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [dispatch, onError]);

  return null;
}
