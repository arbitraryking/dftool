import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { expandRect, HitRect, pointInAnyRect, screenToClient, WindowMetrics } from '../domain/overlayHitTesting';
import { setOverlayInteractive } from '../services/tauriApi';
import { getSelectedMap, useAppDispatch, useAppState } from '../state/appStore';

const DEVICE_MOUSE_MOVE_EVENT = 'dftool://device-mouse-move';
const MARKER_HIT_PADDING = 8;
const PANEL_HIT_PADDING = 4;

type DeviceMouseMovePayload = {
  x: number;
  y: number;
};

type TauriWindow = ReturnType<typeof getCurrentWindow>;

function getElementHitRect(element: Element, padding: number): HitRect | undefined {
  const rect = element.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return undefined;
  }

  return expandRect(
    {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    },
    padding,
  );
}

function collectHitRects(): HitRect[] {
  const markerRects = Array.from(document.querySelectorAll('.marker'))
    .map((element) => getElementHitRect(element, MARKER_HIT_PADDING))
    .filter((rect): rect is HitRect => Boolean(rect));
  const detailsRects = Array.from(document.querySelectorAll('.marker-details'))
    .map((element) => getElementHitRect(element, PANEL_HIT_PADDING))
    .filter((rect): rect is HitRect => Boolean(rect));

  return [...markerRects, ...detailsRects];
}

export function OverlayInteractivityController() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const selectedMap = getSelectedMap(state);
  const windowRef = useRef<TauriWindow | undefined>(undefined);
  const appliedInteractiveRef = useRef<boolean | undefined>(undefined);
  const desiredInteractiveRef = useRef<boolean | undefined>(undefined);
  const inFlightInteractiveRef = useRef<boolean | undefined>(undefined);
  const hitRectsRef = useRef<HitRect[]>([]);
  const hitRectsDirtyRef = useRef(true);
  const metricsRef = useRef<WindowMetrics | undefined>(undefined);
  const metricsDirtyRef = useRef(true);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) {
      return;
    }

    windowRef.current = getCurrentWindow();
  }, []);

  useEffect(() => {
    hitRectsDirtyRef.current = true;
  }, [state.mode, state.overlayVisible, state.selectedPointId, selectedMap?.id, selectedMap?.points, state.settings?.visibleLootTypes]);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) {
      return;
    }

    const markDirty = () => {
      hitRectsDirtyRef.current = true;
      metricsDirtyRef.current = true;
    };
    const observer = new MutationObserver(() => {
      hitRectsDirtyRef.current = true;
    });
    const overlayRoot = document.querySelector('.overlay-app');

    if (overlayRoot) {
      observer.observe(overlayRoot, { childList: true, subtree: true, attributes: true });
    }

    window.addEventListener('resize', markDirty);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', markDirty);
    };
  }, [state.overlayVisible]);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    async function applyInteractive(interactive: boolean) {
      desiredInteractiveRef.current = interactive;

      if (appliedInteractiveRef.current === interactive || inFlightInteractiveRef.current === interactive) {
        return;
      }

      inFlightInteractiveRef.current = interactive;

      try {
        await setOverlayInteractive(interactive);
        if (!disposed) {
          appliedInteractiveRef.current = interactive;
          dispatch({ type: 'setRuntimeError', error: undefined });
        }
      } catch (error: unknown) {
        if (!disposed) {
          const message = error instanceof Error ? error.message : String(error);
          dispatch({ type: 'setRuntimeError', error: `切换覆盖层交互模式失败：${message}` });
        }
      } finally {
        if (!disposed && inFlightInteractiveRef.current === interactive) {
          inFlightInteractiveRef.current = undefined;
        }

        if (
          !disposed &&
          desiredInteractiveRef.current !== undefined &&
          desiredInteractiveRef.current !== appliedInteractiveRef.current
        ) {
          void applyInteractive(desiredInteractiveRef.current);
        }
      }
    }

    async function refreshMetrics() {
      const overlayWindow = windowRef.current ?? getCurrentWindow();
      const scaleFactor = await overlayWindow.scaleFactor();

      if (!metricsDirtyRef.current && metricsRef.current && metricsRef.current.scaleFactor === scaleFactor) {
        return metricsRef.current;
      }

      windowRef.current = overlayWindow;
      const innerPosition = await overlayWindow.innerPosition();
      metricsRef.current = {
        innerX: innerPosition.x,
        innerY: innerPosition.y,
        scaleFactor,
      };
      metricsDirtyRef.current = false;
      return metricsRef.current;
    }

    async function isInsideInteractiveArea(payload: DeviceMouseMovePayload) {
      const metrics = await refreshMetrics();

      if (hitRectsDirtyRef.current) {
        hitRectsRef.current = collectHitRects();
        hitRectsDirtyRef.current = false;
      }

      return pointInAnyRect(screenToClient(payload, metrics), hitRectsRef.current);
    }

    if (!state.overlayVisible || state.mode === 'browse') {
      hitRectsDirtyRef.current = true;
      void applyInteractive(false);
      return;
    }

    if (state.mode === 'edit') {
      hitRectsDirtyRef.current = true;
      void applyInteractive(true);
      return;
    }

    void applyInteractive(false);
    hitRectsDirtyRef.current = true;
    metricsDirtyRef.current = true;

    void listen<DeviceMouseMovePayload>(DEVICE_MOUSE_MOVE_EVENT, (event) => {
      if (disposed) return;

      void isInsideInteractiveArea(event.payload)
        .then((inside) => applyInteractive(inside))
        .catch(() => applyInteractive(false));
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }

      unlisten = cleanup;
    }).catch((error: unknown) => {
      if (!disposed) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'setRuntimeError', error: `监听鼠标位置失败：${message}` });
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [state.mode, state.overlayVisible]);

  return null;
}
