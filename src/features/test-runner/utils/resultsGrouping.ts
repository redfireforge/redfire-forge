import type { RequestResult } from '../../../shared/types';

export type GroupByLevel = 'feature' | 'group' | 'test' | 'dataRow';

export interface GroupNode {
  key: string;
  results: RequestResult[];
  children: GroupNode[];
  total: number;
  passed: number;
  failed: number;
  validationFailed: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
}

export function computeStats(results: RequestResult[]): Omit<GroupNode, 'key' | 'results' | 'children'> {
  const times = results.map((r) => r.responseTimeMs);
  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed && r.errorMessage).length,
    validationFailed: results.filter((r) => !r.passed && !r.errorMessage && r.failureDetails.length > 0).length,
    avgTime: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
    minTime: times.length ? Math.min(...times) : 0,
    maxTime: times.length ? Math.max(...times) : 0,
  };
}

export function buildGroups(results: RequestResult[], levels: GroupByLevel[]): GroupNode[] {
  if (levels.length === 0 || results.length === 0) return [];

  const [level, ...rest] = levels;
  const map = new Map<string, RequestResult[]>();

  for (const r of results) {
    let key: string;
    if (level === 'feature') key = r.featureGroupName || '(unknown feature)';
    else if (level === 'group') key = r.groupName || '(unknown group)';
    else if (level === 'dataRow') key = r.dataRowLabel || r.dataRowId || '(no data row)';
    else key = r.scenarioName;
    const arr = map.get(key);
    if (arr) arr.push(r);
    else map.set(key, [r]);
  }

  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    results: items,
    children: rest.length > 0 ? buildGroups(items, rest) : [],
    ...computeStats(items),
  }));
}
