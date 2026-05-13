export function normalizeMapperPath(path: string): string {
  return path
    .trim()
    .replace(/^\$\.?/, '')
    .replace(/\.\[/g, '[')
    .replace(/\.{2,}/g, '.')
    .replace(/\.$/, '');
}

export function isSameMapperPath(left: string, right: string): boolean {
  return normalizeMapperPath(left) === normalizeMapperPath(right);
}

export function isMapperPathWithin(path: string, parentPath: string): boolean {
  const normalizedPath = normalizeMapperPath(path);
  const normalizedParent = normalizeMapperPath(parentPath);
  if (!normalizedParent) return normalizedPath.length > 0;
  if (normalizedPath === normalizedParent) return true;
  return normalizedPath.startsWith(`${normalizedParent}.`) || normalizedPath.startsWith(`${normalizedParent}[`);
}

export function getMapperRelativePath(path: string, parentPath: string): string | null {
  const normalizedPath = normalizeMapperPath(path);
  const normalizedParent = normalizeMapperPath(parentPath);
  if (!normalizedParent) return normalizedPath;
  if (normalizedPath === normalizedParent) return '';
  if (normalizedPath.startsWith(`${normalizedParent}.`) || normalizedPath.startsWith(`${normalizedParent}[`)) {
    return normalizedPath.slice(normalizedParent.length);
  }
  return null;
}
