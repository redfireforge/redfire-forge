/**
 * JSON structural diff + LCS-based line diff engine for WebSocket message comparison.
 */
import { tryParseJson } from '@shared/utils/helpers';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface JsonDiffEntry {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

export interface DiffLine {
  type: 'same' | 'added' | 'removed';
  content: string;
  leftNum?: number;
  rightNum?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  jsonEntries: JsonDiffEntry[];
  isJsonDiff: boolean;
}

// ── JSON Structural Diff ───────────────────────────────────────────────────────

const SAFE_KEY_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function walkJson(
  a: unknown,
  b: unknown,
  path: string,
  entries: JsonDiffEntry[],
): void {
  if (a === b) return;

  const aIsNull = a === null || a === undefined;
  const bIsNull = b === null || b === undefined;

  if (aIsNull && bIsNull) return;
  if (aIsNull) { entries.push({ path, type: 'added', newValue: b }); return; }
  if (bIsNull) { entries.push({ path, type: 'removed', oldValue: a }); return; }

  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);

  if (aIsArr && bIsArr) {
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      const childPath = `${path}[${i}]`;
      if (i >= a.length) {
        entries.push({ path: childPath, type: 'added', newValue: b[i] });
      } else if (i >= b.length) {
        entries.push({ path: childPath, type: 'removed', oldValue: a[i] });
      } else {
        walkJson(a[i], b[i], childPath, entries);
      }
    }
    return;
  }

  if (typeof a === 'object' && typeof b === 'object' && !aIsArr && !bIsArr) {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    for (const key of allKeys) {
      const childPath = SAFE_KEY_RE.test(key) ? `${path}.${key}` : `${path}["${key}"]`;
      if (!(key in aObj)) {
        entries.push({ path: childPath, type: 'added', newValue: bObj[key] });
      } else if (!(key in bObj)) {
        entries.push({ path: childPath, type: 'removed', oldValue: aObj[key] });
      } else {
        walkJson(aObj[key], bObj[key], childPath, entries);
      }
    }
    return;
  }

  entries.push({ path, type: 'changed', oldValue: a, newValue: b });
}

export function diffJson(a: unknown, b: unknown): JsonDiffEntry[] {
  const entries: JsonDiffEntry[] = [];
  walkJson(a, b, '$', entries);
  return entries;
}

// ── LCS Line Diff ──────────────────────────────────────────────────────────────

function computeLcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

export function diffLines(a: string, b: string): DiffLine[] {
  if (a === b) {
    return a.split('\n').map((content, i) => ({
      type: 'same' as const,
      content,
      leftNum: i + 1,
      rightNum: i + 1,
    }));
  }

  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const dp = computeLcs(aLines, bLines);

  const result: DiffLine[] = [];
  let i = aLines.length;
  let j = bLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      result.push({ type: 'same', content: aLines[i - 1], leftNum: i, rightNum: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'added', content: bLines[j - 1], rightNum: j });
      j--;
    } else {
      result.push({ type: 'removed', content: aLines[i - 1], leftNum: i });
      i--;
    }
  }

  return result.reverse();
}

// ── Composite Diff ─────────────────────────────────────────────────────────────

export function computeDiff(leftData: string, rightData: string): DiffResult {
  const leftObj = tryParseJson(leftData);
  const rightObj = tryParseJson(rightData);
  const isJsonDiff = leftObj !== undefined && rightObj !== undefined;

  const leftText = isJsonDiff ? JSON.stringify(leftObj, null, 2) : leftData;
  const rightText = isJsonDiff ? JSON.stringify(rightObj, null, 2) : rightData;

  return {
    lines: diffLines(leftText, rightText),
    jsonEntries: isJsonDiff ? diffJson(leftObj, rightObj) : [],
    isJsonDiff,
  };
}

// ── Unified Diff Formatter ─────────────────────────────────────────────────────

export function formatUnifiedDiff(
  lines: DiffLine[],
  leftLabel: string,
  rightLabel: string,
): string {
  const parts: string[] = [
    `--- ${leftLabel}`,
    `+++ ${rightLabel}`,
    '@@ @@',
  ];

  for (const line of lines) {
    switch (line.type) {
      case 'removed':
        parts.push(`-${line.content}`);
        break;
      case 'added':
        parts.push(`+${line.content}`);
        break;
      default:
        parts.push(` ${line.content}`);
    }
  }

  return parts.join('\n');
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function formatDiffValue(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
