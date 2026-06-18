/**
 * sdlTokenizer.test.ts — unit tests for the SDL syntax tokenizer.
 */

import { describe, it, expect } from 'vitest';
import { tokenizeSDL } from './sdlTokenizer';
import type { SdlToken } from './sdlTokenizer';

function textOf(tokens: SdlToken[]): string {
  return tokens.map((t) => t.text).join('');
}

describe('tokenizeSDL', () => {
  it('returns empty array for empty string', () => {
    expect(tokenizeSDL('')).toEqual([]);
  });

  it('preserves original text when joined', () => {
    const sdl = 'type User { id: ID! name: String }';
    expect(textOf(tokenizeSDL(sdl))).toBe(sdl);
  });

  it('classifies SDL keywords correctly', () => {
    const tokens = tokenizeSDL('type interface union enum input scalar');
    const keywords = tokens.filter((t) => t.cls === 'gql-sdl-keyword');
    expect(keywords.map((t) => t.text)).toEqual(['type', 'interface', 'union', 'enum', 'input', 'scalar']);
  });

  it('classifies PascalCase identifiers as types', () => {
    const tokens = tokenizeSDL('Order OrderItem');
    const typeTokens = tokens.filter((t) => t.cls === 'gql-sdl-type');
    expect(typeTokens.map((t) => t.text)).toContain('Order');
    expect(typeTokens.map((t) => t.text)).toContain('OrderItem');
  });

  it('classifies lowercase identifiers as fields', () => {
    const tokens = tokenizeSDL('type User { id name }');
    const fields = tokens.filter((t) => t.cls === 'gql-sdl-field');
    expect(fields.map((t) => t.text)).toContain('id');
    expect(fields.map((t) => t.text)).toContain('name');
  });

  it('classifies argument names inside parentheses', () => {
    const tokens = tokenizeSDL('(limit: Int)');
    const args = tokens.filter((t) => t.cls === 'gql-sdl-arg');
    expect(args.map((t) => t.text)).toContain('limit');
  });

  it('classifies directives starting with @', () => {
    const tokens = tokenizeSDL('@deprecated @skip');
    const dirs = tokens.filter((t) => t.cls === 'gql-sdl-directive');
    expect(dirs.map((t) => t.text)).toEqual(['@deprecated', '@skip']);
  });

  it('classifies single-line comments starting with #', () => {
    const tokens = tokenizeSDL('# this is a comment\ntype User');
    const comments = tokens.filter((t) => t.cls === 'gql-sdl-comment');
    expect(comments[0].text).toBe('# this is a comment');
  });

  it('classifies block string / doc comments', () => {
    const tokens = tokenizeSDL('"""A description""" type User');
    const comments = tokens.filter((t) => t.cls === 'gql-sdl-comment');
    expect(comments[0].text).toBe('"""A description"""');
  });

  it('classifies double-quoted strings', () => {
    const tokens = tokenizeSDL('"hello world"');
    const strings = tokens.filter((t) => t.cls === 'gql-sdl-string');
    expect(strings[0].text).toBe('"hello world"');
  });

  it('classifies numbers', () => {
    const tokens = tokenizeSDL('42 3.14');
    const nums = tokens.filter((t) => t.cls === 'gql-sdl-number');
    expect(nums.map((t) => t.text)).toEqual(['42', '3.14']);
  });

  it('classifies punctuation', () => {
    const tokens = tokenizeSDL('{} () [] : ! |');
    const puncs = tokens.filter((t) => t.cls === 'gql-sdl-punc');
    expect(puncs.map((t) => t.text)).toContain('{');
    expect(puncs.map((t) => t.text)).toContain(':');
    expect(puncs.map((t) => t.text)).toContain('!');
  });

  it('resets parenDepth correctly after closing paren', () => {
    // After closing paren, field names should be gql-sdl-field not gql-sdl-arg
    const tokens = tokenizeSDL('(limit: Int) after');
    const afterArgs = tokens.filter((t) => t.cls === 'gql-sdl-field');
    expect(afterArgs.map((t) => t.text)).toContain('after');
  });

  it('handles nested parentheses via parenDepth', () => {
    const tokens = tokenizeSDL('(a: (b: Int))');
    const args = tokens.filter((t) => t.cls === 'gql-sdl-arg');
    expect(args.map((t) => t.text)).toContain('a');
    expect(args.map((t) => t.text)).toContain('b');
  });

  it('handles block string spanning multiple lines', () => {
    const sdl = '"""\nMulti\nline\n"""';
    const tokens = tokenizeSDL(sdl);
    const block = tokens.filter((t) => t.cls === 'gql-sdl-comment');
    expect(block[0].text).toBe(sdl);
  });

  it('handles block string without closing triple quotes (EOF)', () => {
    const sdl = '"""open without close';
    const tokens = tokenizeSDL(sdl);
    const block = tokens.filter((t) => t.cls === 'gql-sdl-comment');
    expect(block[0].text).toBe(sdl);
  });

  it('handles escape sequences in double-quoted strings', () => {
    const sdl = '"he said \\"hi\\""';
    const tokens = tokenizeSDL(sdl);
    const strings = tokens.filter((t) => t.cls === 'gql-sdl-string');
    expect(strings.length).toBeGreaterThan(0);
  });

  it('handles complex type definition end-to-end', () => {
    const sdl = `
type Order {
  """The order identifier"""
  id: ID!
  items: [OrderItem!]!
  status: OrderStatus @deprecated(reason: "use state instead")
}
`.trim();
    const tokens = tokenizeSDL(sdl);
    expect(textOf(tokens)).toBe(sdl);
    expect(tokens.some((t) => t.cls === 'gql-sdl-keyword' && t.text === 'type')).toBe(true);
    expect(tokens.some((t) => t.cls === 'gql-sdl-type' && t.text === 'Order')).toBe(true);
    expect(tokens.some((t) => t.cls === 'gql-sdl-field' && t.text === 'id')).toBe(true);
  });
});
