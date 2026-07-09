const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);

export function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinCsv(values: string[]): string {
  return values.join(', ');
}

export function appendCsvValue(value: string, next: string): string {
  const items = splitCsv(value);
  return items.includes(next) ? joinCsv(items) : joinCsv([...items, next]);
}

export function isSafeResourcePath(path: string): boolean {
  if (!path || path.trim() !== path) {
    return false;
  }

  if (path.includes('\\') || path.startsWith('/') || path.startsWith('~')) {
    return false;
  }

  if (/^[A-Za-z]:/.test(path)) {
    return false;
  }

  const parts = path.split('/');
  return parts.length > 0 && parts.every((part) => Boolean(part) && part !== '.' && part !== '..');
}

function extensionOf(path: string): string {
  const fileName = path.split('/').at(-1) ?? '';
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : '';
}

export function getImageResourcePathIssue(path: string, options: { requireScreenshotRoot?: boolean } = {}): string | undefined {
  if (!isSafeResourcePath(path)) {
    return '截图路径必须是安全的资源相对路径，不能包含绝对路径、反斜杠、. 或 ..';
  }

  if (options.requireScreenshotRoot && !path.startsWith('assets/screenshots/')) {
    return '截图路径应位于 assets/screenshots/ 目录下';
  }

  if (!IMAGE_EXTENSIONS.has(extensionOf(path))) {
    return '截图路径只支持 png、jpg、jpeg、webp、gif、svg 图片';
  }

  return undefined;
}
