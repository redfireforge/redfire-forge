import { describe, it, expect } from 'vitest';
import { buildSchema, printSchema } from 'graphql';
import { SDL_DIFF_GOLDEN_CASES, type SdlDiffGoldenCase } from '../test-data/sdlDiffGoldenCases';
import {
  annotateSplitDiffHunks,
  buildSplitDiffRows,
  canonicalizeSdlForDiff,
  computeLineDiff,
  computeSdlSplitDiff,
  summarizeSplitDiffRows,
  type SdlSplitDiffRow,
} from './sdlLineDiff';

function rowsMatching(
  rows: SdlSplitDiffRow[],
  kind: SdlDiffGoldenCase['changedLines'][number]['kind'],
  side: 'left' | 'right',
  contains: string,
): SdlSplitDiffRow[] {
  return rows.filter((row) => {
    if (row.kind !== kind) return false;
    const text = side === 'left' ? row.leftText : row.rightText;
    return text?.includes(contains) ?? false;
  });
}

function assertGoldenCase(testCase: SdlDiffGoldenCase): void {
  const { rows, stats } = computeSdlSplitDiff(testCase.oldSdl, testCase.newSdl);

  expect(stats, `[${testCase.id}] stats`).toEqual(testCase.stats);

  const changedRowCount = stats.removed + stats.added + stats.modified;
  expect(
    rows.filter((r) => r.kind !== 'unchanged').length,
    `[${testCase.id}] changed row count matches stats sum`,
  ).toBe(changedRowCount);

  for (const line of testCase.changedLines ?? []) {
    const matches = rowsMatching(rows, line.kind, line.side, line.contains);
    expect(
      matches.length,
      `[${testCase.id}] expected ${line.kind} row on ${line.side} containing "${line.contains}"`,
    ).toBeGreaterThan(0);
  }

  for (const snippet of testCase.unchangedMustInclude ?? []) {
    const unchangedHit = rows.some(
      (row) =>
        row.kind === 'unchanged'
        && row.leftText?.includes(snippet)
        && row.rightText?.includes(snippet),
    );
    expect(unchangedHit, `[${testCase.id}] unchanged row must include "${snippet}"`).toBe(true);
  }

  // Unchanged rows must never carry delete/add-only kinds on both sides differently.
  for (const row of rows.filter((r) => r.kind === 'unchanged')) {
    expect(row.leftText, `[${testCase.id}] unchanged left`).toBe(row.rightText);
  }

  // Annotated rows preserve the same stats and kinds.
  const annotated = annotateSplitDiffHunks(rows);
  expect(summarizeSplitDiffRows(annotated), `[${testCase.id}] annotated stats`).toEqual(stats);
}

describe('SDL diff golden cases', () => {
  it.each(SDL_DIFF_GOLDEN_CASES.map((testCase) => [testCase.id, testCase] as const))(
    '%s',
    (_id, testCase) => {
      assertGoldenCase(testCase);
    },
  );
});

describe('SDL diff golden — large schema stress', () => {
  const ps = (sdl: string) => printSchema(buildSchema(sdl));

  function buildLargeSchema(entityCount: number, renameIndex?: number, newName?: string): string {
    const types = Array.from({ length: entityCount }, (_, i) => {
      const name = renameIndex === i && newName ? newName : `Entity${i}`;
      return `
        type ${name} {
          id: ID!
          name: String!
          value: Int
        }
      `;
    }).join('');
    return ps(`type Query { ping: String } ${types}`);
  }

  it('identical 30-type schema has zero edits', () => {
    const sdl = buildLargeSchema(30);
    const { stats } = computeSdlSplitDiff(sdl, sdl);
    expect(stats).toEqual({ removed: 0, added: 0, modified: 0, unchanged: 183 });
  });

  it('renaming one type in a 30-type schema touches only its type header line', () => {
    const oldSdl = buildLargeSchema(30);
    const newSdl = buildLargeSchema(30, 5, 'Entity5Renamed');
    const { stats, rows } = computeSdlSplitDiff(oldSdl, newSdl);

    expect(stats).toEqual({ removed: 0, added: 0, modified: 1, unchanged: 182 });
    expect(rowsMatching(rows, 'modified', 'left', 'type Entity5 {')).toHaveLength(1);
    expect(rowsMatching(rows, 'modified', 'right', 'type Entity5Renamed {')).toHaveLength(1);
  });

  it('completes large-schema diff within a reasonable time budget', () => {
    const oldSdl = buildLargeSchema(30);
    const newSdl = buildLargeSchema(30, 5, 'Entity5Renamed');
    const start = performance.now();
    computeSdlSplitDiff(oldSdl, newSdl);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});

describe('SDL diff golden — canonicalization invariants', () => {
  it('canonicalize is idempotent', () => {
    for (const testCase of SDL_DIFF_GOLDEN_CASES) {
      const once = canonicalizeSdlForDiff(testCase.oldSdl);
      const twice = canonicalizeSdlForDiff(once);
      expect(twice, testCase.id).toBe(once);
    }
  });

  it('without canonicalization, indented snapshots inflate edit counts', () => {
    const indented = printSchema(buildSchema('type Query { ping: String }'))
      .split('\n')
      .map((line) => (line ? `  ${line}` : line))
      .join('\n');
    const canonical = printSchema(buildSchema('type Query { ping: String }'));

    const rawStats = summarizeSplitDiffRows(
      buildSplitDiffRows(computeLineDiff(indented, canonical)),
    );
    const canonStats = computeSdlSplitDiff(indented, canonical).stats;

    expect(rawStats.removed + rawStats.added).toBeGreaterThan(0);
    expect(canonStats).toEqual({ removed: 0, added: 0, modified: 0, unchanged: 3 });
  });
});
