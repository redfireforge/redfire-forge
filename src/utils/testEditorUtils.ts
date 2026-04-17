import { v4 as uuidv4 } from 'uuid';
import type { KeyValue, Scenario } from '../types';

export const emptyTest = (): Scenario => ({
  id: uuidv4(),
  name: '',
  url: '',
  method: 'GET',
  headers: [{ key: '', value: '' }],
  body: '',
  bodyType: 'none',
  bodyForm: [{ key: '', value: '' }],
  auth: { type: 'inherit' },
  validation: { mode: 'none', expectedFields: [] },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canonicalize(val: any): any {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(canonicalize);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(val).sort()) out[k] = canonicalize(val[k]);
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripPaths(obj: any, paths: string[]): any {
  if (!paths.length || obj === null || obj === undefined || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const p of paths) {
    const segments = p.replace(/^\$\.?/, '').split('.').filter(Boolean);
    if (!segments.length) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cursor: any = clone;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const bracketMatch = seg.match(/^(.+)\[(\d+)\]$/);
      if (bracketMatch) {
        cursor = cursor?.[bracketMatch[1]];
        cursor = Array.isArray(cursor) ? (cursor = [...cursor]) : cursor;
        cursor = cursor?.[Number(bracketMatch[2])];
      } else {
        if (cursor && typeof cursor === 'object' && !Array.isArray(cursor)) cursor[seg] = { ...cursor[seg] };
        cursor = cursor?.[seg];
      }
      if (!cursor || typeof cursor !== 'object') break;
    }
    if (cursor && typeof cursor === 'object') {
      const last = segments[segments.length - 1];
      delete cursor[last];
    }
  }
  return clone;
}

export function jsonEqual(a: string, b: string, excludedPaths?: string[]): boolean {
  try {
    let objA = JSON.parse(a);
    let objB = JSON.parse(b);
    if (excludedPaths?.length) {
      objA = stripPaths(objA, excludedPaths);
      objB = stripPaths(objB, excludedPaths);
    }
    return JSON.stringify(canonicalize(objA)) === JSON.stringify(canonicalize(objB));
  } catch {
    return a === b;
  }
}

export function parseQueryParams(url: string): KeyValue[] {
  try {
    const u = new URL(url);
    const params: KeyValue[] = [];
    u.searchParams.forEach((value, key) => {
      params.push({ key, value });
    });
    if (params.length === 0) params.push({ key: '', value: '' });
    return params;
  } catch {
    return [{ key: '', value: '' }];
  }
}

export function rebuildUrl(url: string, params: KeyValue[]): string {
  try {
    const u = new URL(url);
    u.search = '';
    const nonEmpty = params.filter((p) => p.key.trim());
    nonEmpty.forEach((p) => u.searchParams.set(p.key.trim(), p.value));
    return u.toString();
  } catch {
    return url;
  }
}

export function getBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

export function unwrapImport(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && '_exportMeta' in raw && 'data' in raw) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}

export function pickJsonFile(onLoad: (data: unknown) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        onLoad(JSON.parse(ev.target?.result as string));
      } catch {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
