import { buildSchema, printSchema } from 'graphql';

export type DiffLineType = 'added' | 'removed' | 'unchanged';
export interface DiffLine { type: DiffLineType; text: string }

export type SdlSplitRowKind = 'unchanged' | 'removed' | 'added' | 'modified';

export interface SdlSplitDiffRow {
  kind: SdlSplitRowKind;
  leftText?: string;
  rightText?: string;
  leftLineNum?: number;
  rightLineNum?: number;
}

export type HunkSegmentRole = 'single' | 'start' | 'middle' | 'end';

export interface AnnotatedSdlSplitDiffRow extends SdlSplitDiffRow {
  hunkRole: HunkSegmentRole;
}

export type InlineDiffSpanKind = 'same' | 'delete' | 'insert';

export interface InlineDiffSpan {
  kind: InlineDiffSpanKind;
  text: string;
}

interface LineRef {
  text: string;
  lineNum: number;
}

/** Myers O(ND) LCS diff on string arrays (lines, words, etc.). */
export function computeSequenceDiff(oldItems: string[], newItems: string[]): DiffLine[] {
  const a = oldItems;
  const b = newItems;
  const n = a.length;
  const m = b.length;

  if (n === 0 && m === 0) return [];
  if (n === 0) return b.map((text) => ({ type: 'added' as DiffLineType, text }));
  if (m === 0) return a.map((text) => ({ type: 'removed' as DiffLineType, text }));

  const max = n + m;
  const v = new Array<number>(2 * max + 1).fill(0);
  const trace: number[][] = [];

  let found = false;
  outer: for (let d = 0; d <= max; d++) {
    trace.push([...v]);
    for (let k = -d; k <= d; k += 2) {
      const idx = k + max;
      let x: number;
      if (k === -d || (k !== d && v[idx - 1] < v[idx + 1])) {
        x = v[idx + 1];
      } else {
        x = v[idx - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[idx] = x;
      if (x >= n && y >= m) { found = true; break outer; }
    }
  }

  if (!found) {
    return [
      ...a.map((text) => ({ type: 'removed' as DiffLineType, text })),
      ...b.map((text) => ({ type: 'added' as DiffLineType, text })),
    ];
  }

  const edits: DiffLine[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vd = trace[d];
    const k = x - y;
    const idx = k + max;
    let prevK: number;
    if (k === -d || (k !== d && vd[idx - 1] < vd[idx + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vd[prevK + max];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      edits.unshift({ type: 'unchanged', text: a[x - 1] });
      x--; y--;
    }
    if (d > 0) {
      if (x === prevX) {
        edits.unshift({ type: 'added', text: b[y - 1] });
        y--;
      } else {
        edits.unshift({ type: 'removed', text: a[x - 1] });
        x--;
      }
    }
  }

  return edits;
}

/** @internal exported for tests — inner-hunk alignment for multi-line replace blocks */
export function buildHunkRows(
  removed: LineRef[],
  added: LineRef[],
): SdlSplitDiffRow[] {
  if (removed.length === 0) {
    return added.map((a) => ({
      kind: 'added' as const,
      rightText: a.text,
      rightLineNum: a.lineNum,
    }));
  }
  if (added.length === 0) {
    return removed.map((r) => ({
      kind: 'removed' as const,
      leftText: r.text,
      leftLineNum: r.lineNum,
    }));
  }

  const innerEdits = computeSequenceDiff(
    removed.map((r) => r.text),
    added.map((a) => a.text),
  );

  let ri = 0;
  let ai = 0;
  const rows: SdlSplitDiffRow[] = [];
  let i = 0;

  while (i < innerEdits.length) {
    const current = innerEdits[i];

    if (current.type === 'unchanged') {
      rows.push({
        kind: 'unchanged',
        leftText: removed[ri].text,
        rightText: added[ai].text,
        leftLineNum: removed[ri].lineNum,
        rightLineNum: added[ai].lineNum,
      });
      ri++;
      ai++;
      i++;
      continue;
    }

    const remSlice: LineRef[] = [];
    const addSlice: LineRef[] = [];
    while (i < innerEdits.length && innerEdits[i].type === 'removed') {
      remSlice.push(removed[ri++]);
      i++;
    }
    while (i < innerEdits.length && innerEdits[i].type === 'added') {
      addSlice.push(added[ai++]);
      i++;
    }

    if (remSlice.length === 1 && addSlice.length === 1) {
      const left = remSlice[0];
      const right = addSlice[0];
      rows.push({
        kind: left.text === right.text ? 'unchanged' : 'modified',
        leftText: left.text,
        rightText: right.text,
        leftLineNum: left.lineNum,
        rightLineNum: right.lineNum,
      });
    } else {
      for (const r of remSlice) {
        rows.push({ kind: 'removed', leftText: r.text, leftLineNum: r.lineNum });
      }
      for (const a of addSlice) {
        rows.push({ kind: 'added', rightText: a.text, rightLineNum: a.lineNum });
      }
    }
  }

  return rows;
}

/**
 * Line-level diff using Myers' O(ND) LCS algorithm.
 * Produces an interleaved edit script (removed/added lines in context).
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  return computeSequenceDiff(oldText.split('\n'), newText.split('\n'));
}

/** Trim trailing whitespace and outer blank lines without changing semantic SDL. */
export function normalizeSdlWhitespace(sdl: string): string {
  return sdl
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Canonical SDL for side-by-side diff — re-print through graphql so snapshots saved
 * with manual indentation match introspected printSchema output.
 */
export function canonicalizeSdlForDiff(sdl: string): string {
  const trimmed = normalizeSdlWhitespace(sdl);
  if (!trimmed) return '';
  try {
    return printSchema(buildSchema(trimmed));
  } catch {
    return trimmed;
  }
}

/** Tokenize for inline diff — keeps whitespace as separate tokens. */
function tokenizeInline(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? (text ? [text] : []);
}

/** Word-level inline diff spans for modified line pairs (VS Code / IntelliJ style). */
export function computeInlineDiffSpans(oldText: string, newText: string): {
  left: InlineDiffSpan[];
  right: InlineDiffSpan[];
} {
  const oldTokens = tokenizeInline(oldText);
  const newTokens = tokenizeInline(newText);
  const edits = computeSequenceDiff(oldTokens, newTokens);

  const left: InlineDiffSpan[] = [];
  const right: InlineDiffSpan[] = [];

  for (const edit of edits) {
    if (edit.type === 'unchanged') {
      left.push({ kind: 'same', text: edit.text });
      right.push({ kind: 'same', text: edit.text });
    } else if (edit.type === 'removed') {
      left.push({ kind: 'delete', text: edit.text });
    } else {
      right.push({ kind: 'insert', text: edit.text });
    }
  }

  return { left, right };
}

/**
 * Convert a line edit script into aligned side-by-side rows (VS Code style).
 * Each row occupies one line on both sides; deletions leave a placeholder on the right,
 * additions leave a placeholder on the left. Multi-line replace blocks use inner LCS
 * so identical lines stay aligned and only true edits are highlighted.
 */
export function buildSplitDiffRows(edits: DiffLine[]): SdlSplitDiffRow[] {
  const rows: SdlSplitDiffRow[] = [];
  let leftLine = 0;
  let rightLine = 0;
  let i = 0;

  while (i < edits.length) {
    const current = edits[i];

    if (current.type === 'unchanged') {
      leftLine++;
      rightLine++;
      rows.push({
        kind: 'unchanged',
        leftText: current.text,
        rightText: current.text,
        leftLineNum: leftLine,
        rightLineNum: rightLine,
      });
      i++;
      continue;
    }

    const removedSlice: LineRef[] = [];
    const addedSlice: LineRef[] = [];

    while (i < edits.length && edits[i].type === 'removed') {
      leftLine++;
      removedSlice.push({ text: edits[i].text, lineNum: leftLine });
      i++;
    }
    while (i < edits.length && edits[i].type === 'added') {
      rightLine++;
      addedSlice.push({ text: edits[i].text, lineNum: rightLine });
      i++;
    }

    if (removedSlice.length > 0 || addedSlice.length > 0) {
      rows.push(...buildHunkRows(removedSlice, addedSlice));
    }
  }

  return rows;
}

/** Assign hunk segment roles so the connector lane can span multi-line change blocks. */
export function annotateSplitDiffHunks(rows: SdlSplitDiffRow[]): AnnotatedSdlSplitDiffRow[] {
  const annotated: AnnotatedSdlSplitDiffRow[] = rows.map((row) => ({
    ...row,
    hunkRole: 'single',
  }));

  let i = 0;
  while (i < rows.length) {
    if (rows[i].kind === 'unchanged') {
      i++;
      continue;
    }

    let j = i;
    while (j < rows.length && rows[j].kind !== 'unchanged') j++;

    const span = j - i;
    if (span === 1) {
      annotated[i].hunkRole = 'single';
    } else {
      for (let k = i; k < j; k++) {
        annotated[k].hunkRole = k === i ? 'start' : k === j - 1 ? 'end' : 'middle';
      }
    }

    i = j;
  }

  return annotated;
}

export function summarizeSplitDiffRows(rows: SdlSplitDiffRow[]) {
  let removed = 0;
  let added = 0;
  let modified = 0;
  let unchanged = 0;
  for (const row of rows) {
    switch (row.kind) {
      case 'removed': removed++; break;
      case 'added': added++; break;
      case 'modified': modified++; break;
      case 'unchanged': unchanged++; break;
    }
  }
  return { removed, added, modified, unchanged };
}

/** Full SDL diff pipeline used by the modal and golden tests. */
export function computeSdlSplitDiff(oldSdl: string, newSdl: string): {
  rows: SdlSplitDiffRow[];
  stats: ReturnType<typeof summarizeSplitDiffRows>;
  oldCanonical: string;
  newCanonical: string;
} {
  const oldCanonical = canonicalizeSdlForDiff(oldSdl);
  const newCanonical = canonicalizeSdlForDiff(newSdl);
  const rows = buildSplitDiffRows(computeLineDiff(oldCanonical, newCanonical));
  return {
    rows,
    stats: summarizeSplitDiffRows(rows),
    oldCanonical,
    newCanonical,
  };
}
