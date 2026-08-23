import { describe, expect, it } from 'vitest';
import { isTruthy, wrapCustomExprDollarPaths } from './validatorCustomExpression';

describe('isTruthy', () => {
  it('returns false for canonical falsy primitives', () => {
    expect(isTruthy(false)).toBe(false);
    expect(isTruthy(0)).toBe(false);
    expect(isTruthy('')).toBe(false);
    expect(isTruthy(null)).toBe(false);
    expect(isTruthy(undefined)).toBe(false);
  });

  it('returns false for NaN', () => {
    expect(isTruthy(Number.NaN)).toBe(false);
  });

  it('returns true for common truthy values', () => {
    expect(isTruthy(true)).toBe(true);
    expect(isTruthy(1)).toBe(true);
    expect(isTruthy(-1)).toBe(true);
    expect(isTruthy(Number.POSITIVE_INFINITY)).toBe(true);
    expect(isTruthy('0')).toBe(true);
    expect(isTruthy({})).toBe(true);
    expect(isTruthy([])).toBe(true);
    expect(isTruthy(Symbol('x'))).toBe(true);
    expect(isTruthy(() => {})).toBe(true);
  });
});

describe('wrapCustomExprDollarPaths', () => {
  it('returns empty string unchanged', () => {
    expect(wrapCustomExprDollarPaths('')).toBe('');
  });

  it('wraps $.path segments as {{$.path}}', () => {
    expect(wrapCustomExprDollarPaths('$.foo')).toBe('{{$.foo}}');
    expect(wrapCustomExprDollarPaths('before $.bar after')).toBe('before {{$.bar}} after');
  });

  it('allows path chars matching DOLLAR_PATH_CHAR (word, dot, brackets, *, hyphen)', () => {
    expect(wrapCustomExprDollarPaths('$.items[0].name')).toBe('{{$.items[0].name}}');
    expect(wrapCustomExprDollarPaths('$.tags[*]')).toBe('{{$.tags[*]}}');
    expect(wrapCustomExprDollarPaths('$.field-name')).toBe('{{$.field-name}}');
  });

  it('stops path capture when next char is not part of path', () => {
    expect(wrapCustomExprDollarPaths('$.a $.b')).toBe('{{$.a}} {{$.b}}');
    expect(wrapCustomExprDollarPaths('$.x)')).toBe('{{$.x}})');
    expect(wrapCustomExprDollarPaths('$.x,')).toBe('{{$.x}},');
    expect(wrapCustomExprDollarPaths('$.x\n')).toBe('{{$.x}}\n');
  });

  it('wraps bare $ when followed by whitespace, comma, closing paren, or EOF', () => {
    expect(wrapCustomExprDollarPaths('$')).toBe('{{$}}');
    expect(wrapCustomExprDollarPaths('$ ')).toBe('{{$}} ');
    expect(wrapCustomExprDollarPaths('$,')).toBe('{{$}},');
    expect(wrapCustomExprDollarPaths('$)')).toBe('{{$}})');
    expect(wrapCustomExprDollarPaths('$\t')).toBe('{{$}}\t');
  });

  it('does not wrap $ when followed by a non-trigger character', () => {
    expect(wrapCustomExprDollarPaths('$foo')).toBe('$foo');
    expect(wrapCustomExprDollarPaths('$eq($.x, 1)')).toBe('$eq({{$.x}}, 1)');
  });

  it('does not transform $. references inside single-quoted strings', () => {
    expect(wrapCustomExprDollarPaths("'$.stay'")).toBe("'$.stay'");
    expect(wrapCustomExprDollarPaths("'a$.b'")).toBe("'a$.b'");
  });

  it('does not transform $. references inside double-quoted strings', () => {
    expect(wrapCustomExprDollarPaths('"$ignore.me"')).toBe('"$ignore.me"');
  });

  it('handles escapes inside quoted strings', () => {
    expect(wrapCustomExprDollarPaths('"a\\"b$.wrap"')).toBe('"a\\"b$.wrap"');
    expect(wrapCustomExprDollarPaths("'x\\\\y$.wrap'")).toBe("'x\\\\y$.wrap'");
  });

  it('handles non-escaped characters inside quoted strings', () => {
    expect(wrapCustomExprDollarPaths('"plain"')).toBe('"plain"');
  });

  it('handles unterminated quoted strings without throwing', () => {
    expect(wrapCustomExprDollarPaths('"no close')).toBe('"no close');
    expect(wrapCustomExprDollarPaths("'still open")).toBe("'still open");
  });

  it('preserves blocks already wrapped in {{ }} without double-wrapping paths inside', () => {
    expect(wrapCustomExprDollarPaths('{{$.already}}')).toBe('{{$.already}}');
    expect(wrapCustomExprDollarPaths('pre {{$.x}} post')).toBe('pre {{$.x}} post');
  });

  it('handles nested {{ }} blocks with correct depth tracking', () => {
    expect(wrapCustomExprDollarPaths('{{ outer {{ inner }} }}')).toBe(
      '{{ outer {{ inner }} }}',
    );
    expect(wrapCustomExprDollarPaths('a{{{{}}}}b')).toBe('a{{{{}}}}b');
  });

  it('handles incomplete closing braces without throwing', () => {
    expect(wrapCustomExprDollarPaths('{{ $.foo')).toBe('{{ $.foo');
  });

  it('mixes quoted, nested braces, and $. wrapping in one expression', () => {
    const expr = '\'$.in.quote\' + $.out + {{ nest $.skip }}';
    expect(wrapCustomExprDollarPaths(expr)).toBe(
      "'$.in.quote' + {{$.out}} + {{ nest $.skip }}",
    );
  });

  it('copies plain text between special constructs', () => {
    expect(wrapCustomExprDollarPaths('1 + 2')).toBe('1 + 2');
    expect(wrapCustomExprDollarPaths('no dollar signs')).toBe('no dollar signs');
  });
});
