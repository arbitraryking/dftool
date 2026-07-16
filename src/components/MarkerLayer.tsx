import { ImgHTMLAttributes, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { screenToRelative } from '../domain/markerPosition';
import { resolveResourceUrl } from '../services/tauriApi';
import { getSelectedMap, useAppDispatch, useAppState } from '../state/appStore';

type DragStart = {
  pointId: string;
  clientX: number;
  clientY: number;
};

const DRAG_THRESHOLD = 4;

type ResourceImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
};

function ResourceImage({ src, ...props }: ResourceImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(`/${src}`);

  useEffect(() => {
    let disposed = false;

    resolveResourceUrl(src)
      .then((url) => {
        if (!disposed) setResolvedSrc(url);
      })
      .catch(() => {
        if (!disposed) setResolvedSrc(`/${src}`);
      });

    return () => {
      disposed = true;
    };
  }, [src]);

  return <img src={resolvedSrc} {...props} />;
}

export function MarkerLayer() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const selectedMap = getSelectedMap(state);
  const dragStartRef = useRef<DragStart | null>(null);
  const suppressClickPointIdRef = useRef<string | null>(null);
  const typeById = useMemo(
    () => new Map(state.lootTypes?.types.map((type) => [type.id, type]) ?? []),
    [state.lootTypes],
  );

  if (!selectedMap || !state.lootTypes || !state.settings) {
    return null;
  }

  function handleLayerClick(event: PointerEvent<HTMLDivElement>) {
    if (state.mode !== 'edit' || event.target !== event.currentTarget || !selectedMap || !state.lootTypes) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    console.log(event.clientX, event.clientY)
    const position = screenToRelative(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      { width: rect.width, height: rect.height },
    );
    const firstType = state.lootTypes.types[0];

    dispatch({
      type: 'startAddPoint',
      point: {
        type: firstType?.id ?? 'unknown',
        title: '新点位',
        description: '',
        screenshots: [],
        tags: [],
        ...position,
      },
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, pointId: string) {
    if (state.mode !== 'edit') {
      return;
    }

    dragStartRef.current = {
      pointId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>, pointId: string) {
    const dragStart = dragStartRef.current;
    dragStartRef.current = null;

    if (state.mode !== 'edit' || !dragStart || dragStart.pointId !== pointId) {
      return;
    }

    const distance = Math.hypot(event.clientX - dragStart.clientX, event.clientY - dragStart.clientY);
    if (distance < DRAG_THRESHOLD) {
      return;
    }

    const layer = event.currentTarget.closest('.marker-layer');
    if (!layer) {
      return;
    }

    const rect = layer.getBoundingClientRect();
    const position = screenToRelative(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      { width: rect.width, height: rect.height },
    );
    suppressClickPointIdRef.current = pointId;
    dispatch({ type: 'movePoint', pointId, ...position });
  }

  const visiblePoints = selectedMap.points.filter(
    (point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 && (state.settings?.visibleLootTypes[point.type] ?? true),
  );

  return (
    <div className="marker-layer" onClick={handleLayerClick}>
      {visiblePoints.map((point) => {
        const type = typeById.get(point.type);
        const size = type?.defaultSize ?? 28;
        const title = `${point.title} (${type?.name ?? '未知类型'})`;

        return (
          <button
            key={point.id}
            className="marker"
            title={title}
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              width: size,
              height: size,
              color: type?.color ?? '#ffffff',
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (suppressClickPointIdRef.current === point.id) {
                suppressClickPointIdRef.current = null;
                return;
              }

              if (state.mode === 'edit') {
                dispatch({ type: 'startEditPoint', point });
              } else if (state.mode === 'inspect') {
                dispatch({ type: 'selectPoint', pointId: point.id });
              }
            }}
            onPointerDown={(event) => handlePointerDown(event, point.id)}
            onPointerUp={(event) => handlePointerUp(event, point.id)}
          >
            {type?.icon ? <ResourceImage src={type.icon} alt="" /> : <span>?</span>}
          </button>
        );
      })}
    </div>
  );
}
