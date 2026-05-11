/**
 * Shared helpers for the Request Body Builder (adapter + sync engine).
 */

import type { MapperSource } from '../types';

const UNSAFE_PATH_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Detect which source contains a given ref by checking sampleData keys.
 */
export function findSourceForRef(ref: string, sources: MapperSource[]): string {
  for (const src of sources) {
    if (src.sampleData && typeof src.sampleData === 'object') {
      if (ref in (src.sampleData as Record<string, unknown>)) return src.id;
    }
  }
  return sources[0]?.id ?? '__unknown__';
}

/**
 * Check if a dot-separated path contains segments that would be
 * silently skipped by setByPath (prototype pollution guard).
 */
export function hasUnsafePathSegment(path: string): boolean {
  const normalized = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;
  return normalized.split('.').filter(Boolean).some(k => UNSAFE_PATH_KEYS.has(k));
}
