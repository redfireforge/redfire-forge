import type { KeyValue } from '../types';

export interface KeyValueHeaderDiff {
  added: KeyValue[];
  removed: KeyValue[];
  modified: Array<{ key: string; from: string; to: string }>;
}

/** Diff two KeyValue header lists (ignores entries with blank keys). */
export function diffKeyValueHeaders(oldHeaders: KeyValue[], newHeaders: KeyValue[]): KeyValueHeaderDiff {
  const oldMap = new Map(oldHeaders.filter(h => h.key.trim()).map(h => [h.key, h.value]));
  const newMap = new Map(newHeaders.filter(h => h.key.trim()).map(h => [h.key, h.value]));

  const added: KeyValue[] = [];
  const removed: KeyValue[] = [];
  const modified: Array<{ key: string; from: string; to: string }> = [];

  for (const [key, value] of newMap) {
    if (!oldMap.has(key)) added.push({ key, value });
    else if (oldMap.get(key) !== value) modified.push({ key, from: oldMap.get(key)!, to: value });
  }
  for (const [key, value] of oldMap) {
    if (!newMap.has(key)) removed.push({ key, value });
  }

  return { added, removed, modified };
}
