import { describe, expect, it } from 'vitest';
import { expandRect, pointInAnyRect, pointInRect, screenToClient } from './overlayHitTesting';

describe('overlay hit testing', () => {
  it('expands rectangles with padding', () => {
    expect(expandRect({ left: 10, top: 20, right: 30, bottom: 40 }, 6)).toEqual({
      left: 4,
      top: 14,
      right: 36,
      bottom: 46,
    });
  });

  it('detects points inside rectangle boundaries', () => {
    const rect = { left: 10, top: 20, right: 30, bottom: 40 };

    expect(pointInRect({ x: 10, y: 20 }, rect)).toBe(true);
    expect(pointInRect({ x: 30, y: 40 }, rect)).toBe(true);
    expect(pointInRect({ x: 9, y: 20 }, rect)).toBe(false);
    expect(pointInRect({ x: 30, y: 41 }, rect)).toBe(false);
  });

  it('detects points inside any rectangle', () => {
    const rects = [
      { left: 0, top: 0, right: 10, bottom: 10 },
      { left: 20, top: 20, right: 30, bottom: 30 },
    ];

    expect(pointInAnyRect({ x: 25, y: 25 }, rects)).toBe(true);
    expect(pointInAnyRect({ x: 15, y: 15 }, rects)).toBe(false);
  });

  it('converts screen coordinates to overlay client coordinates using scale factor', () => {
    expect(screenToClient({ x: 350, y: 500 }, { innerX: 100, innerY: 200, scaleFactorx: 2, scaleFactory: 2 })).toEqual({
      x: 125,
      y: 150,
    });
  });

  it('handles negative monitor coordinates', () => {
    expect(screenToClient({ x: -1750, y: 250 }, { innerX: -1920, innerY: 100, scaleFactorx: 1, scaleFactory: 1 })).toEqual({
      x: 170,
      y: 150,
    });
  });
});
