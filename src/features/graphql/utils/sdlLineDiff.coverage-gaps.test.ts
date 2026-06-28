import { describe, it, expect } from 'vitest';
import {
  annotateSplitDiffHunks,
  buildHunkRows,
  buildSplitDiffRows,
  canonicalizeSdlForDiff,
  computeInlineDiffSpans,
  computeLineDiff,
  computeSdlSplitDiff,
  computeSequenceDiff,
  normalizeSdlWhitespace,
  summarizeSplitDiffRows,
} from './sdlLineDiff';

describe('sdlLineDiff — coverage gaps', () => {
  it('computeSequenceDiff returns empty for two empty arrays', () => {
    expect(computeSequenceDiff([], [])).toEqual([]);
  });

  it('computeSequenceDiff marks all new lines as added when old is empty', () => {
    expect(computeSequenceDiff([], ['a', 'b'])).toEqual([
      { type: 'added', text: 'a' },
      { type: 'added', text: 'b' },
    ]);
  });

  it('computeSequenceDiff marks all old lines as removed when new is empty', () => {
    expect(computeSequenceDiff(['a', 'b'], [])).toEqual([
      { type: 'removed', text: 'a' },
      { type: 'removed', text: 'b' },
    ]);
  });

  it('computeSequenceDiff handles completely disjoint sequences', () => {
    const diff = computeSequenceDiff(['x', 'y'], ['a', 'b']);
    expect(diff.some((d) => d.type === 'removed')).toBe(true);
    expect(diff.some((d) => d.type === 'added')).toBe(true);
  });

  it('buildHunkRows handles removed-only and added-only slices', () => {
    const removedOnly = buildHunkRows(
      [{ text: 'old', lineNum: 1 }],
      [],
    );
    expect(removedOnly).toEqual([{ kind: 'removed', leftText: 'old', leftLineNum: 1 }]);

    const addedOnly = buildHunkRows(
      [],
      [{ text: 'new', lineNum: 2 }],
    );
    expect(addedOnly).toEqual([{ kind: 'added', rightText: 'new', rightLineNum: 2 }]);
  });

  it('buildHunkRows marks single-line replace as modified or unchanged', () => {
    const modified = buildHunkRows(
      [{ text: 'name: Old', lineNum: 1 }],
      [{ text: 'name: New', lineNum: 1 }],
    );
    expect(modified[0].kind).toBe('modified');

    const unchanged = buildHunkRows(
      [{ text: 'same', lineNum: 1 }],
      [{ text: 'same', lineNum: 1 }],
    );
    expect(unchanged[0].kind).toBe('unchanged');
  });

  it('normalizeSdlWhitespace trims outer blank lines', () => {
    expect(normalizeSdlWhitespace('\n  type Query { x: String }\n\n')).toBe('type Query { x: String }');
  });

  it('canonicalizeSdlForDiff returns trimmed input when schema is invalid', () => {
    expect(canonicalizeSdlForDiff('not valid graphql !!!')).toBe('not valid graphql !!!');
    expect(canonicalizeSdlForDiff('')).toBe('');
  });

  it('computeInlineDiffSpans highlights token-level edits', () => {
    const { left, right } = computeInlineDiffSpans('query Old', 'query New');
    expect(left.some((s) => s.kind === 'delete')).toBe(true);
    expect(right.some((s) => s.kind === 'insert')).toBe(true);
  });

  it('computeInlineDiffSpans handles empty old text', () => {
    const { right } = computeInlineDiffSpans('', 'query');
    expect(right.some((s) => s.kind === 'insert')).toBe(true);
  });

  it('annotateSplitDiffHunks assigns hunk roles for change blocks', () => {
    const rows: import('./sdlLineDiff').SdlSplitDiffRow[] = [
      { kind: 'unchanged', leftText: 'a', rightText: 'a', leftLineNum: 1, rightLineNum: 1 },
      { kind: 'removed', leftText: 'b', leftLineNum: 2 },
      { kind: 'added', rightText: 'x', rightLineNum: 2 },
      { kind: 'unchanged', leftText: 'c', rightText: 'c', leftLineNum: 3, rightLineNum: 3 },
    ];
    const annotated = annotateSplitDiffHunks(rows);
    expect(annotated[1].hunkRole).toBe('start');
    expect(annotated[2].hunkRole).toBe('end');
  });

  it('summarizeSplitDiffRows counts all row kinds', () => {
    const rows = buildSplitDiffRows(computeLineDiff('a\nb', 'a\nc'));
    const stats = summarizeSplitDiffRows(rows);
    expect(stats.unchanged + stats.modified + stats.added + stats.removed).toBeGreaterThan(0);
  });

  it('computeSdlSplitDiff runs full pipeline on valid SDL', () => {
    const oldSdl = 'type Query { hello: String }';
    const newSdl = 'type Query { hello: String\n  world: String }';
    const result = computeSdlSplitDiff(oldSdl, newSdl);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.oldCanonical).toContain('Query');
  });

  it('computeSequenceDiff backtracks through Myers trace for partial overlap', () => {
    const diff = computeSequenceDiff(['keep', 'old-a', 'old-b', 'tail'], ['keep', 'new-a', 'new-b', 'tail']);
    expect(diff.filter((d) => d.type === 'unchanged').length).toBeGreaterThanOrEqual(2);
    expect(diff.some((d) => d.type === 'removed' || d.type === 'added')).toBe(true);
  });

  it('buildHunkRows expands multi-line replace blocks into removed and added rows', () => {
    const rows = buildHunkRows(
      [
        { text: 'line-a', lineNum: 1 },
        { text: 'line-b', lineNum: 2 },
      ],
      [
        { text: 'line-x', lineNum: 1 },
        { text: 'line-y', lineNum: 2 },
      ],
    );
    expect(rows.some((r) => r.kind === 'removed')).toBe(true);
    expect(rows.some((r) => r.kind === 'added')).toBe(true);
  });

  it('annotateSplitDiffHunks marks single-line hunks as single role', () => {
    const rows: import('./sdlLineDiff').SdlSplitDiffRow[] = [
      { kind: 'modified', leftText: 'a', rightText: 'b', leftLineNum: 1, rightLineNum: 1 },
    ];
    expect(annotateSplitDiffHunks(rows)[0].hunkRole).toBe('single');
  });

  it('annotateSplitDiffHunks assigns middle role for three-line change blocks', () => {
    const rows: import('./sdlLineDiff').SdlSplitDiffRow[] = [
      { kind: 'removed', leftText: 'a', leftLineNum: 1 },
      { kind: 'added', rightText: 'b', rightLineNum: 1 },
      { kind: 'removed', leftText: 'c', leftLineNum: 2 },
    ];
    const annotated = annotateSplitDiffHunks(rows);
    expect(annotated[0].hunkRole).toBe('start');
    expect(annotated[1].hunkRole).toBe('middle');
    expect(annotated[2].hunkRole).toBe('end');
  });

  it('computeInlineDiffSpans handles empty new text', () => {
    const { left } = computeInlineDiffSpans('query Old', '');
    expect(left.some((s) => s.kind === 'delete')).toBe(true);
  });
});
