import { MapConfig } from './schemas';

export function getAdjacentMapId(maps: MapConfig[], selectedMapId: string, direction: -1 | 1): string {
  if (maps.length === 0) {
    return '';
  }

  const selectedIndex = maps.findIndex((map) => map.id === selectedMapId);
  const currentIndex = selectedIndex === -1 ? 0 : selectedIndex;
  const nextIndex = (currentIndex + direction + maps.length) % maps.length;
  return maps[nextIndex].id;
}
