import { describe, it, expect } from 'vitest';
import { buildSchema, printSchema } from 'graphql';
import { readFileSync } from 'fs';
import {
  annotateSplitDiffHunks,
  buildHunkRows,
  buildSplitDiffRows,
  canonicalizeSdlForDiff,
  computeInlineDiffSpans,
  computeLineDiff,
  computeSequenceDiff,
  summarizeSplitDiffRows,
} from './sdlLineDiff';

describe('canonicalizeSdlForDiff', () => {
  it('aligns manually indented snapshots with printSchema introspection output', () => {
    const serverFile = readFileSync(
      new URL('../../../../docker/graphql/server.js', import.meta.url),
      'utf8',
    );
    const rawNew = serverFile.match(/const typeDefs = \/\* GraphQL \*\/ `([\s\S]*?)`;/)![1];
    const canonicalNew = printSchema(buildSchema(rawNew));
    const canonicalOld = printSchema(buildSchema(
      canonicalNew.replace('  user(id: ID!): User', '  user(id: ID!): User\n  users: [User!]!')
        .replace('  email: String!', ''),
    ));
    const indentedBaseline = canonicalOld
      .split('\n')
      .map((line) => (line ? `  ${line}` : line))
      .join('\n');

    const withoutCanon = summarizeSplitDiffRows(buildSplitDiffRows(computeLineDiff(indentedBaseline, canonicalNew)));
    expect(withoutCanon.removed + withoutCanon.added).toBeGreaterThan(2);

    const stats = summarizeSplitDiffRows(buildSplitDiffRows(computeLineDiff(
      canonicalizeSdlForDiff(indentedBaseline),
      canonicalizeSdlForDiff(canonicalNew),
    )));
    expect(stats).toEqual({ removed: 1, added: 1, modified: 0, unchanged: 45 });
  });
});

describe('computeLineDiff', () => {
  it('returns unchanged lines for identical text', () => {
    const lines = computeLineDiff('a\nb', 'a\nb');
    expect(lines.every((l) => l.type === 'unchanged')).toBe(true);
  });

  it('detects a single-line replacement', () => {
    const lines = computeLineDiff('old', 'new');
    expect(lines).toEqual([
      { type: 'removed', text: 'old' },
      { type: 'added', text: 'new' },
    ]);
  });
});

describe('computeSequenceDiff', () => {
  it('diffs token arrays for inline highlighting', () => {
    const edits = computeSequenceDiff(['foo', 'bar'], ['foo', 'baz']);
    expect(edits).toEqual([
      { type: 'unchanged', text: 'foo' },
      { type: 'removed', text: 'bar' },
      { type: 'added', text: 'baz' },
    ]);
  });
});

describe('computeInlineDiffSpans', () => {
  it('marks changed words on left and right separately', () => {
    const { left, right } = computeInlineDiffSpans('  users: [User]', '  user(id: ID!): User');
    expect(left.some((s) => s.kind === 'delete')).toBe(true);
    expect(right.some((s) => s.kind === 'insert')).toBe(true);
    expect(left.some((s) => s.kind === 'same')).toBe(true);
    expect(right.some((s) => s.kind === 'same')).toBe(true);
  });
});

describe('buildSplitDiffRows', () => {
  it('pairs a single-line replacement as modified on one aligned row', () => {
    const edits = computeLineDiff(
      'type Query {\n  users: [User]\n}',
      'type Query {\n  user(id: ID!): User\n}',
    );
    const rows = buildSplitDiffRows(edits);
    const modified = rows.find((r) => r.kind === 'modified');
    expect(modified).toBeDefined();
    expect(modified?.leftText).toContain('users');
    expect(modified?.rightText).toContain('user(id');
  });

  it('aligns pure deletions on the left with empty right slot', () => {
    const rows = buildSplitDiffRows(computeLineDiff('line-a', 'line-b'));
    expect(rows).toEqual([
      expect.objectContaining({ kind: 'modified', leftText: 'line-a', rightText: 'line-b' }),
    ]);
  });

  it('emits separate removed and added rows for unequal blocks', () => {
    const rows = buildSplitDiffRows([
      { type: 'removed', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'added', text: 'x' },
    ]);
    expect(rows).toEqual([
      expect.objectContaining({ kind: 'removed', leftText: 'a' }),
      expect.objectContaining({ kind: 'removed', leftText: 'b' }),
      expect.objectContaining({ kind: 'added', rightText: 'x' }),
    ]);
  });

  it('aligns unchanged lines inside a multi-line replace block', () => {
    const rows = buildSplitDiffRows(computeLineDiff(
      'type Query {\n  health: String\n  users: [User!]!\n}',
      'type Query {\n  health: String\n}',
    ));
    expect(rows.filter((r) => r.kind === 'unchanged').length).toBe(3);
    expect(rows.filter((r) => r.kind === 'removed').length).toBe(1);
    expect(rows.filter((r) => r.kind === 'added').length).toBe(0);
  });

  it('highlights only the lines that actually changed in a schema hunk', () => {
    const old = [
      'type Query {',
      '  health: String',
      '  user(id: ID!): User',
      '  users: [User!]!',
      '}',
      'type User {',
      '  id: ID!',
      '  name: String!',
      '}',
    ].join('\n');
    const neu = [
      'type Query {',
      '  health: String',
      '  user(id: ID!): User',
      '}',
      'type User {',
      '  id: ID!',
      '  name: String!',
      '  email: String!',
      '}',
    ].join('\n');
    const stats = summarizeSplitDiffRows(buildSplitDiffRows(computeLineDiff(old, neu)));
    expect(stats).toEqual({ removed: 1, added: 1, modified: 0, unchanged: 8 });
  });
});

describe('buildHunkRows', () => {
  it('preserves unchanged lines inside a multi-line replace hunk', () => {
    const rows = buildHunkRows(
      [
        { text: '  name: String', lineNum: 1 },
        { text: '  age: Int', lineNum: 2 },
      ],
      [
        { text: '  name: String', lineNum: 1 },
        { text: '  age: Float', lineNum: 2 },
      ],
    );
    expect(rows[0]).toMatchObject({ kind: 'unchanged', leftText: '  name: String', rightText: '  name: String' });
    expect(rows[1]).toMatchObject({ kind: 'modified', leftText: '  age: Int', rightText: '  age: Float' });
  });
});

describe('annotateSplitDiffHunks', () => {
  it('marks single-line changes as single hunk segments', () => {
    const rows = annotateSplitDiffHunks(buildSplitDiffRows([
      { type: 'removed', text: 'old' },
      { type: 'added', text: 'new' },
    ]));
    expect(rows).toEqual([
      expect.objectContaining({ kind: 'modified', hunkRole: 'single' }),
    ]);
  });

  it('marks multi-line change blocks with start, middle, and end roles', () => {
    const rows = annotateSplitDiffHunks(buildSplitDiffRows([
      { type: 'removed', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'removed', text: 'c' },
      { type: 'added', text: 'x' },
    ]));
    expect(rows.map((r) => r.kind)).toEqual(['removed', 'removed', 'removed', 'added']);
    expect(rows.map((r) => r.hunkRole)).toEqual(['start', 'middle', 'middle', 'end']);
  });

  it('leaves unchanged rows as single segments', () => {
    const rows = annotateSplitDiffHunks(buildSplitDiffRows([
      { type: 'unchanged', text: 'same' },
    ]));
    expect(rows[0].hunkRole).toBe('single');
  });
});
