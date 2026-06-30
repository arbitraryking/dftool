export type RelativePoint = {
  x: number;
  y: number;
};

export type ScreenPoint = {
  x: number;
  y: number;
};

export type ScreenSize = {
  width: number;
  height: number;
};

export function clampRelative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

export function relativeToScreen(point: RelativePoint, size: ScreenSize): ScreenPoint {
  return {
    x: point.x * size.width,
    y: point.y * size.height,
  };
}

export function screenToRelative(point: ScreenPoint, size: ScreenSize): RelativePoint {
  return {
    x: clampRelative(size.width === 0 ? 0 : point.x / size.width),
    y: clampRelative(size.height === 0 ? 0 : point.y / size.height),
  };
}
