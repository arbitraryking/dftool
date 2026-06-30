import { describe, expect, it } from 'vitest';
import { addPoint, deletePoint, movePoint, updatePoint } from './markerEditing';
import { mapFixture } from '../test/fixtures';

describe('markerEditing', () => {
  it('adds a point and auto-generates an id', () => {
    const result = addPoint(mapFixture, {
      type: 'diamond',
      x: 0.2,
      y: 0.3,
      title: 'new',
      description: '',
      screenshots: [],
      tags: [],
    });

    expect(result.points).toHaveLength(2);
    expect(result.points[1].id).toBe('diamond-002');
  });

  it('updates and clamps a point position', () => {
    const result = movePoint(mapFixture, 'diamond-001', { x: 2, y: -1 });

    expect(result.points[0].x).toBe(1);
    expect(result.points[0].y).toBe(0);
  });

  it('updates point metadata', () => {
    const result = updatePoint(mapFixture, 'diamond-001', { title: 'updated' });

    expect(result.points[0].title).toBe('updated');
  });

  it('deletes a point', () => {
    const result = deletePoint(mapFixture, 'diamond-001');

    expect(result.points).toHaveLength(0);
  });
});
