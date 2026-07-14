export type Point = {
  x: number;
  y: number;
};

export type HitRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type WindowMetrics = {
  innerX: number;
  innerY: number;
  scaleFactor: number;
};

export function expandRect(rect: HitRect, padding: number): HitRect {
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  };
}

export function pointInRect(point: Point, rect: HitRect): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

export function pointInAnyRect(point: Point, rects: HitRect[]): boolean {
  return rects.some((rect) => pointInRect(point, rect));
}

export function screenToClient(point: Point, metrics: WindowMetrics): Point {
  return {
    x: (point.x - metrics.innerX) / metrics.scaleFactor,
    y: (point.y - metrics.innerY) / metrics.scaleFactor,
  };
}
