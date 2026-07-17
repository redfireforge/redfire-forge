import { describe, it, expect } from 'vitest';
import {
  offsetToPosition,
  positionToOffset,
  resolveFieldInsertPosition,
  isInsideSelectionSet,
  defaultInsertInsideBlock,
} from './fieldInsertPosition';

const LESSON_TEMPLATE = `query {
  
}`;

describe('offsetToPosition / positionToOffset', () => {
  it('maps offset to line/column and back', () => {
    const text = 'ab\ncd\nef';
    const pos = offsetToPosition(text, 4);
    expect(pos).toEqual({ lineNumber: 2, column: 2 });
    expect(positionToOffset(text, pos)).toBe(4);
  });

  it('handles offset beyond text length', () => {
    expect(offsetToPosition('abc', 99)).toEqual({ lineNumber: 1, column: 4 });
  });
});

describe('defaultInsertInsideBlock', () => {
  it('uses the next line when the open brace is not at end-of-line', () => {
    const text = 'query { inline\n}';
    const open = text.indexOf('{');
    const close = text.indexOf('}');
    expect(defaultInsertInsideBlock(text, open, close)).toEqual({ lineNumber: 2, column: 3 });
  });

  it('uses short indent when the previous line has fewer than two spaces', () => {
    const text = 'query {}';
    const open = text.indexOf('{');
    const close = text.indexOf('}');
    expect(defaultInsertInsideBlock(text, open, close)).toEqual({ lineNumber: 1, column: 3 });
  });
});

describe('resolveFieldInsertPosition', () => {
  it('inserts inside braces when cursor is at document start (healthquery bug)', () => {
    const pos = resolveFieldInsertPosition(LESSON_TEMPLATE, { lineNumber: 1, column: 1 });
    expect(pos).toEqual({ lineNumber: 2, column: 3 });
  });

  it('uses cursor when already inside the selection set', () => {
    const pos = resolveFieldInsertPosition(LESSON_TEMPLATE, { lineNumber: 2, column: 3 });
    expect(pos).toEqual({ lineNumber: 2, column: 3 });
  });

  it('rejects cursor on operation keyword line before opening brace', () => {
    const pos = resolveFieldInsertPosition(LESSON_TEMPLATE, { lineNumber: 1, column: 3 });
    expect(pos).toEqual({ lineNumber: 2, column: 3 });
  });

  it('works for mutation blocks', () => {
    const text = `mutation {
  
}`;
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos).toEqual({ lineNumber: 2, column: 3 });
  });

  it('works for subscription blocks', () => {
    const text = `subscription OnEvent {
  __typename
}`;
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos.lineNumber).toBeGreaterThan(1);
  });

  it('inserts on first inner line when existing field occupies line 2', () => {
    const text = `query {
  existingField
}`;
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos).toEqual({ lineNumber: 3, column: 3 });
  });

  it('handles open brace not at end of operation line', () => {
    const text = 'query GetUser { id }';
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos.lineNumber).toBe(1);
  });

  it('falls back to cursor when no operation block exists', () => {
    const cursor = { lineNumber: 4, column: 2 };
    expect(resolveFieldInsertPosition('{ invalid', cursor)).toEqual(cursor);
  });

  it('treats cursor on opening-brace column as outside selection set', () => {
    const text = 'query { }';
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 7 });
    expect(pos).not.toEqual({ lineNumber: 1, column: 7 });
  });

  it('uses empty inner line indent when available', () => {
    const text = 'query {\n\n}';
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos).toEqual({ lineNumber: 2, column: 2 });
  });

  it('inserts before closing brace when inner lines have content only', () => {
    const text = 'query {\n  id\n}';
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos.lineNumber).toBe(3);
  });

  it('handles unbalanced braces by using end of text as close index', () => {
    const text = 'query { unclosed';
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos.lineNumber).toBeGreaterThanOrEqual(1);
  });

  it('positionToOffset handles blank lines in text', () => {
    const text = 'a\n\nc';
    expect(positionToOffset(text, { lineNumber: 3, column: 2 })).toBe(4);
  });

  it('uses close-line indent fallback when no empty inner line exists', () => {
    const text = 'query GetUser {\n  id\n  name\n}';
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos.lineNumber).toBe(4);
  });

  it('keeps cursor inside multi-line selection set', () => {
    const text = 'query {\n  id\n}';
    const cursor = { lineNumber: 2, column: 4 };
    expect(resolveFieldInsertPosition(text, cursor)).toEqual(cursor);
  });

  it('handles unclosed selection sets when resolving insert position', () => {
    const pos = resolveFieldInsertPosition('query { id', { lineNumber: 1, column: 1 });
    expect(pos.lineNumber).toBeGreaterThanOrEqual(1);
  });

  it('offsetToPosition returns line 1 column 1 for offset zero', () => {
    expect(offsetToPosition('query', 0)).toEqual({ lineNumber: 1, column: 1 });
  });

  it('offsetToPosition handles offset equal to text length', () => {
    expect(offsetToPosition('abc', 3)).toEqual({ lineNumber: 1, column: 4 });
  });

  it('offsetToPosition increments column for non-newline characters', () => {
    expect(offsetToPosition('ab', 1)).toEqual({ lineNumber: 1, column: 2 });
  });

  it('offsetToPosition starts a new line after newline', () => {
    expect(offsetToPosition('a\nb', 2)).toEqual({ lineNumber: 2, column: 1 });
  });

  it('positionToOffset handles trailing newline before next line', () => {
    expect(positionToOffset('a\n', { lineNumber: 2, column: 1 })).toBe(2);
  });

  it('handles cursor on closing-brace line by inserting before the brace', () => {
    const text = 'query {\n  id\n}';
    const closePos = { lineNumber: 3, column: 1 };
    expect(resolveFieldInsertPosition(text, closePos)).toEqual({ lineNumber: 3, column: 3 });
  });

  it('treats cursor on open-brace column as outside selection set (same line)', () => {
    const text = 'query { id }';
    const openPos = { lineNumber: 1, column: 7 };
    expect(resolveFieldInsertPosition(text, openPos)).not.toEqual(openPos);
  });

  it('returns cursor when positioned after open brace on the same line', () => {
    const text = 'query\n{\n  id\n}';
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos.lineNumber).toBeGreaterThan(1);
  });

  it('returns cursor when positioned after open brace on the same line', () => {
    const cursor = { lineNumber: 1, column: 9 };
    expect(resolveFieldInsertPosition('query { id }', cursor)).toEqual(cursor);
  });

  it('repositions when cursor sits on the open-brace column', () => {
    const pos = resolveFieldInsertPosition('query { id }', { lineNumber: 1, column: 7 });
    expect(pos).not.toEqual({ lineNumber: 1, column: 7 });
  });

  it('offsetToPosition walks multi-line text mixing newlines and characters', () => {
    expect(offsetToPosition('line1\nline2\nline3', 13)).toEqual({ lineNumber: 3, column: 2 });
  });

  it('positionToOffset pads missing intermediate lines when lineNumber exceeds file length', () => {
    expect(positionToOffset('only', { lineNumber: 4, column: 1 })).toBe(7);
  });

  it('handles nested braces when locating the selection set close', () => {
    const text = 'query { user { id } name }';
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos.lineNumber).toBeGreaterThanOrEqual(1);
  });

  it('uses short indent fallback when previous line has no indent', () => {
    const text = 'query {\nid\n}';
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos.column).toBeGreaterThanOrEqual(2);
  });

  it('inserts after open brace on same line when brace is not line-ending', () => {
    const text = 'query { inline\n}';
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos.lineNumber).toBe(2);
    expect(pos.column).toBeGreaterThan(1);
  });

  it('uses fallback indent for single-line selection blocks', () => {
    const pos = resolveFieldInsertPosition('query {}', { lineNumber: 1, column: 1 });
    expect(pos).toEqual({ lineNumber: 1, column: 3 });
  });

  it('uses close-line indent from the previous line when it has two or more spaces', () => {
    const text = 'query {\n    id\n}';
    const pos = resolveFieldInsertPosition(text, { lineNumber: 1, column: 1 });
    expect(pos).toEqual({ lineNumber: 3, column: 5 });
  });

  it('isInsideSelectionSet rejects cursor before close when outside selection bounds', () => {
    const text = 'query { id }';
    const openBrace = text.indexOf('{');
    const closeBrace = text.indexOf('}');
    expect(isInsideSelectionSet(text, openBrace, openBrace, closeBrace)).toBe(false);
    expect(isInsideSelectionSet(text, closeBrace, openBrace, closeBrace)).toBe(false);
    expect(isInsideSelectionSet(text, openBrace + 2, openBrace, closeBrace)).toBe(true);
  });
});
