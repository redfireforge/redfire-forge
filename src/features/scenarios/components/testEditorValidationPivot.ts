import type { ExpectedField } from '@shared/types';

/** Parses trailing `[n]` on JSONPath row keys for stable numeric ordering (exported for unit tests). */
export function trailingBracketArrayIndex(key: string): number {
  const m = key.match(/\[(\d+)\]$/);
  if (!m?.[1]) return 0;
  return parseInt(m[1], 10);
}

export interface PivotedRulesModel {
  columns: string[];
  rows: Array<{ key: string; cells: Map<string, { value: string; originalIndex: number }> }>;
  arrayPrefix: string;
}

export function buildPivotedRulesFromExpectedFields(fields: ExpectedField[]): PivotedRulesModel {
  const colSet = new Set<string>();
  const rowMap = new Map<string, Map<string, { value: string; originalIndex: number }>>();

  fields.forEach((f, originalIndex) => {
    const lastDot = f.jsonPath.lastIndexOf('.');
    const rowKey = lastDot === -1 ? '(root)' : f.jsonPath.slice(0, lastDot);
    const field = lastDot === -1 ? f.jsonPath : f.jsonPath.slice(lastDot + 1);
    colSet.add(field);
    let row = rowMap.get(rowKey);
    if (!row) {
      row = new Map();
      rowMap.set(rowKey, row);
    }
    row.set(field, { value: f.expectedValue, originalIndex });
  });

  const columns = Array.from(colSet);
  const rows = Array.from(rowMap.entries()).map(([key, cells]) => ({ key, cells }));

  const firstKey = rows[0]?.key || '';
  const bracketIdx = firstKey.lastIndexOf('[');
  const arrayPrefix = bracketIdx > 0 && rows.every((r) => /\[\d+\]$/.test(r.key))
    ? firstKey.slice(0, bracketIdx)
    : '';

  if (arrayPrefix) {
    rows.sort((a, b) => trailingBracketArrayIndex(a.key) - trailingBracketArrayIndex(b.key));
  }

  return { columns, rows, arrayPrefix };
}
