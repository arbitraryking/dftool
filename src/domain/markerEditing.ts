import { MapConfig, MapPoint } from './schemas';
import { clampRelative } from './markerPosition';

export type NewMapPoint = Omit<MapPoint, 'id'> & {
  id?: string;
};

export function createPointId(type: string, existingIds: string[]): string {
  const normalizedType = type.trim() || 'point';
  let index = existingIds.length + 1;
  let candidate = `${normalizedType}-${String(index).padStart(3, '0')}`;

  while (existingIds.includes(candidate)) {
    index += 1;
    candidate = `${normalizedType}-${String(index).padStart(3, '0')}`;
  }

  return candidate;
}

export function addPoint(map: MapConfig, point: NewMapPoint): MapConfig {
  const id = point.id?.trim() || createPointId(point.type, map.points.map((item) => item.id));
  const nextPoint: MapPoint = {
    ...point,
    id,
    x: clampRelative(point.x),
    y: clampRelative(point.y),
  };

  return {
    ...map,
    points: [...map.points, nextPoint],
  };
}

export function updatePoint(map: MapConfig, pointId: string, patch: Partial<Omit<MapPoint, 'id'>>): MapConfig {
  return {
    ...map,
    points: map.points.map((point) =>
      point.id === pointId
        ? {
            ...point,
            ...patch,
            x: patch.x === undefined ? point.x : clampRelative(patch.x),
            y: patch.y === undefined ? point.y : clampRelative(patch.y),
          }
        : point,
    ),
  };
}

export function movePoint(map: MapConfig, pointId: string, position: { x: number; y: number }): MapConfig {
  return updatePoint(map, pointId, position);
}

export function deletePoint(map: MapConfig, pointId: string): MapConfig {
  return {
    ...map,
    points: map.points.filter((point) => point.id !== pointId),
  };
}
