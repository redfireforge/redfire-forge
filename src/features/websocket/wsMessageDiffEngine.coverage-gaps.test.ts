import { describe, it, expect } from 'vitest';
import { computeDiff, diffJson } from './wsMessageDiffEngine';

describe('wsMessageDiffEngine — coverage gaps', () => {
  it('computeDiff handles unsafe JSON keys and array length mismatch', () => {
    const oldJson = JSON.stringify({ 'weird-key': 1, arr: [1] });
    const newJson = JSON.stringify({ 'weird-key': 2, arr: [1, 2], added: true });
    const result = computeDiff(oldJson, newJson);
    expect(result.isJsonDiff).toBe(true);
    expect(result.jsonEntries.length).toBeGreaterThan(0);
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it('diffJson uses bracket notation for unsafe keys', () => {
    const entries = diffJson({ 'bad key': 1 }, { 'bad key': 2 });
    expect(entries.some((e) => e.path.includes('["bad key"]'))).toBe(true);
  });

  it('computeDiff treats non-JSON payloads as plain text diff', () => {
    const result = computeDiff('line-a\nline-b', 'line-a\nline-c');
    expect(result.isJsonDiff).toBe(false);
    expect(result.lines.some((l) => l.type === 'removed' || l.type === 'added')).toBe(true);
  });
});
