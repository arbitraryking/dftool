import { describe, expect, it } from 'vitest';
import { appendCsvValue, getImageResourcePathIssue, isSafeResourcePath, splitCsv } from './resourcePaths';

describe('resourcePaths', () => {
  it('splits and appends csv values without duplicates', () => {
    expect(splitCsv('a.png, b.png,')).toEqual(['a.png', 'b.png']);
    expect(appendCsvValue('a.png, b.png', 'c.png')).toBe('a.png, b.png, c.png');
    expect(appendCsvValue('a.png, b.png', 'b.png')).toBe('a.png, b.png');
  });

  it('accepts safe resource-relative paths', () => {
    expect(isSafeResourcePath('assets/screenshots/zero-dam/shot.png')).toBe(true);
  });

  it('rejects unsafe resource paths', () => {
    expect(isSafeResourcePath('C:\\Users\\me\\shot.png')).toBe(false);
    expect(isSafeResourcePath('/assets/screenshots/shot.png')).toBe(false);
    expect(isSafeResourcePath('assets/screenshots/../secret.png')).toBe(false);
    expect(isSafeResourcePath('assets/screenshots/./shot.png')).toBe(false);
  });

  it('reports image path issues', () => {
    expect(getImageResourcePathIssue('assets/screenshots/zero-dam/shot.png', { requireScreenshotRoot: true })).toBeUndefined();
    expect(getImageResourcePathIssue('assets/icons/diamond.svg', { requireScreenshotRoot: true })).toContain('assets/screenshots');
    expect(getImageResourcePathIssue('assets/screenshots/zero-dam/shot.txt')).toContain('只支持');
  });
});
