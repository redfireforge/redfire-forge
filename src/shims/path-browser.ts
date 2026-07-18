// Minimal browser shim for Node's `path` — only the members that offline
// OpenAPI tooling (openapi-format) touches at module load / during in-memory
// sort. No filesystem access is implied; these are pure string operations.

export const sep = '/';
export const delimiter = ':';

export function dirname(p: string): string {
  if (typeof p !== 'string' || p.length === 0) return '.';
  const norm = p.replace(/\/+$/, '');
  const idx = norm.lastIndexOf('/');
  if (idx < 0) return '.';
  if (idx === 0) return '/';
  return norm.slice(0, idx);
}

export function basename(p: string, ext?: string): string {
  if (typeof p !== 'string') return '';
  const base = p.replace(/\/+$/, '').split('/').pop() ?? '';
  if (ext && base.endsWith(ext)) return base.slice(0, base.length - ext.length);
  return base;
}

export function extname(p: string): string {
  if (typeof p !== 'string') return '';
  const base = basename(p);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot) : '';
}

export function join(...parts: string[]): string {
  return parts
    .filter(part => typeof part === 'string' && part.length > 0)
    .join('/')
    .replace(/\/{2,}/g, '/');
}

export function resolve(...parts: string[]): string {
  const joined = join(...parts);
  return joined.startsWith('/') ? joined : `/${joined}`;
}

export function isAbsolute(p: string): boolean {
  return typeof p === 'string' && p.startsWith('/');
}

const pathShim = { sep, delimiter, dirname, basename, extname, join, resolve, isAbsolute };
export default pathShim;
