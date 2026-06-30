import { describe, expect, it } from 'vitest';
import { relativeToScreen, screenToRelative } from './markerPosition';

describe('markerPosition', () => {
  it('converts relative coordinates to screen coordinates', () => {
    expect(relativeToScreen({ x: 0.5, y: 0.25 }, { width: 1920, height: 1080 })).toEqual({
      x: 960,
      y: 270,
    });
  });

  it('converts screen coordinates to clamped relative coordinates', () => {
    expect(screenToRelative({ x: 2200, y: -10 }, { width: 2000, height: 1000 })).toEqual({
      x: 1,
      y: 0,
    });
  });
});
