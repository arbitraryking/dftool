import { describe, expect, it } from 'vitest';
import { collectMapValidationIssues, normalizeUserSettings, parseMapConfig } from './configValidation';
import { lootTypesFixture, mapFixture } from '../test/fixtures';

describe('configValidation', () => {
  it('parses a valid map config', () => {
    expect(parseMapConfig(mapFixture).id).toBe('zero-dam');
  });

  it('reports unknown types and out-of-range coordinates', () => {
    const issues = collectMapValidationIssues(
      {
        ...mapFixture,
        points: [
          ...mapFixture.points,
          {
            id: 'bad-001',
            type: 'unknown',
            x: 1.2,
            y: -0.1,
            title: 'bad',
            description: '',
            screenshots: [],
            tags: [],
          },
        ],
      },
      lootTypesFixture,
    );

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.level)).toEqual(['warning', 'error']);
  });

  it('reports unsafe screenshot paths as warnings', () => {
    const issues = collectMapValidationIssues(
      {
        ...mapFixture,
        points: [
          {
            ...mapFixture.points[0],
            screenshots: [
              'assets/screenshots/zero-dam/valid.png',
              'assets/screenshots/zero-dam/../secret.png',
              'C:\\Users\\me\\shot.png',
              'assets/screenshots/zero-dam/shot.txt',
            ],
          },
        ],
      },
      lootTypesFixture,
    );

    expect(issues).toHaveLength(3);
    expect(issues.every((issue) => issue.level === 'warning')).toBe(true);
  });

  it('normalizes missing settings from config defaults', () => {
    const settings = normalizeUserSettings(undefined, lootTypesFixture, [mapFixture]);

    expect(settings.selectedMapId).toBe('zero-dam');
    expect(settings.visibleLootTypes).toEqual({ diamond: true, keycard: false });
  });
});
