import type { SpecVersion } from '../../../shared/types';

export interface VersionChange {
  type: 'added' | 'removed' | 'modified';
  field: string;
  oldValue?: string;
  newValue?: string;
}

export function computeSpecVersionDiff(
  left: SpecVersion | undefined,
  right: SpecVersion | undefined,
): VersionChange[] {
  if (!left || !right) return [];
  const changes: VersionChange[] = [];

  if (left.method !== right.method) {
    changes.push({ type: 'modified', field: 'Method', oldValue: left.method, newValue: right.method });
  }

  if (left.url !== right.url) {
    changes.push({ type: 'modified', field: 'URL', oldValue: left.url, newValue: right.url });
  }

  const leftHeaderMap = new Map(left.headers.map(h => [h.key, h.value]));
  const rightHeaderMap = new Map(right.headers.map(h => [h.key, h.value]));

  for (const [key, val] of rightHeaderMap) {
    if (!leftHeaderMap.has(key)) {
      changes.push({ type: 'added', field: `Header: ${key}`, newValue: val });
    } else if (leftHeaderMap.get(key) !== val) {
      changes.push({ type: 'modified', field: `Header: ${key}`, oldValue: leftHeaderMap.get(key), newValue: val });
    }
  }
  for (const [key] of leftHeaderMap) {
    if (!rightHeaderMap.has(key)) {
      changes.push({ type: 'removed', field: `Header: ${key}`, oldValue: leftHeaderMap.get(key) });
    }
  }

  const leftQp = new Map((left.savedQueryParams ?? []).map(p => [p.key, p.value]));
  const rightQp = new Map((right.savedQueryParams ?? []).map(p => [p.key, p.value]));

  for (const [key, val] of rightQp) {
    if (!leftQp.has(key)) {
      changes.push({ type: 'added', field: `Query: ${key}`, newValue: val });
    } else if (leftQp.get(key) !== val) {
      changes.push({ type: 'modified', field: `Query: ${key}`, oldValue: leftQp.get(key), newValue: val });
    }
  }
  for (const [key] of leftQp) {
    if (!rightQp.has(key)) {
      changes.push({ type: 'removed', field: `Query: ${key}`, oldValue: leftQp.get(key) });
    }
  }

  const leftPp = new Map((left.savedPathParams ?? []).map(p => [p.key, p.value]));
  const rightPp = new Map((right.savedPathParams ?? []).map(p => [p.key, p.value]));

  for (const [key, val] of rightPp) {
    if (!leftPp.has(key)) {
      changes.push({ type: 'added', field: `Path: ${key}`, newValue: val });
    } else if (leftPp.get(key) !== val) {
      changes.push({ type: 'modified', field: `Path: ${key}`, oldValue: leftPp.get(key), newValue: val });
    }
  }
  for (const [key] of leftPp) {
    if (!rightPp.has(key)) {
      changes.push({ type: 'removed', field: `Path: ${key}`, oldValue: leftPp.get(key) });
    }
  }

  if (left.body !== right.body) {
    changes.push({
      type: 'modified',
      field: 'Body',
      oldValue: left.body ? `${left.body.length} chars` : '(empty)',
      newValue: right.body ? `${right.body.length} chars` : '(empty)',
    });
  }

  if (left.bodyType !== right.bodyType) {
    changes.push({
      type: 'modified',
      field: 'Body Type',
      oldValue: left.bodyType ?? '(none)',
      newValue: right.bodyType ?? '(none)',
    });
  }

  return changes;
}
