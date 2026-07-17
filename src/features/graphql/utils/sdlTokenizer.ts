/**
 * sdlTokenizer.ts — GraphQL SDL syntax tokenizer.
 *
 * Extracted from GraphqlSchemaExplorer.tsx so it can be unit-tested and
 * reused independently of the React component tree.
 */

export interface SdlToken {
  text: string;
  cls?: string;
}

const SDL_KEYWORDS = new Set([
  'type', 'interface', 'union', 'enum', 'input', 'scalar', 'directive',
  'schema', 'extend', 'query', 'mutation', 'subscription', 'on', 'fragment',
  'implements', 'true', 'false', 'null', 'repeatable',
]);

const WORD_RE = /[a-zA-Z_]/;
const WORD_CONT_RE = /[a-zA-Z0-9_]/;
const NUMBER_START_RE = /[0-9]/;
const PUNCT = '{}[]():=|&!,';

/**
 * Tokenizes a GraphQL SDL string into typed tokens for CSS syntax highlighting.
 *
 * Token class values:
 *   gql-sdl-comment   — triple-quoted doc strings and # line comments
 *   gql-sdl-string    — single-quoted strings
 *   gql-sdl-directive — @directive names
 *   gql-sdl-keyword   — SDL keywords (type, query, implements…)
 *   gql-sdl-type      — PascalCase / UPPER_CASE type references and enum values
 *   gql-sdl-arg       — argument names inside parentheses
 *   gql-sdl-field     — lowercase field names
 *   gql-sdl-number    — numeric literals
 *   gql-sdl-punc      — punctuation ({, }, (, ), :, !, …)
 */
export function tokenizeSDL(sdl: string): SdlToken[] {
  const tokens: SdlToken[] = [];
  let i = 0;
  const n = sdl.length;
  let parenDepth = 0;

  while (i < n) {
    // Triple-quoted block string / doc comment """..."""
    if (sdl[i] === '"' && sdl[i + 1] === '"' && sdl[i + 2] === '"') {
      const close = sdl.indexOf('"""', i + 3);
      const end = close === -1 ? n : close + 3;
      tokens.push({ text: sdl.slice(i, end), cls: 'gql-sdl-comment' });
      i = end;
      continue;
    }

    // Single-line comment  #...
    if (sdl[i] === '#') {
      let j = i;
      while (j < n && sdl[j] !== '\n') j++;
      tokens.push({ text: sdl.slice(i, j), cls: 'gql-sdl-comment' });
      i = j;
      continue;
    }

    // Double-quoted string "..."
    if (sdl[i] === '"') {
      let j = i + 1;
      while (j < n && sdl[j] !== '"' && sdl[j] !== '\n') {
        if (sdl[j] === '\\') j++;
        j++;
      }
      tokens.push({ text: sdl.slice(i, j + 1), cls: 'gql-sdl-string' });
      i = j + 1;
      continue;
    }

    // Directive  @name
    if (sdl[i] === '@') {
      let j = i + 1;
      while (j < n && WORD_CONT_RE.test(sdl[j])) j++;
      tokens.push({ text: sdl.slice(i, j), cls: 'gql-sdl-directive' });
      i = j;
      continue;
    }

    // Word → keyword / type name / argument name / field name
    if (WORD_RE.test(sdl[i])) {
      let j = i;
      while (j < n && WORD_CONT_RE.test(sdl[j])) j++;
      const word = sdl.slice(i, j);
      let cls: string;
      if (SDL_KEYWORDS.has(word)) {
        cls = 'gql-sdl-keyword';
      } else if (/^[A-Z_]/.test(word)) {
        cls = 'gql-sdl-type';
      } else if (parenDepth > 0) {
        cls = 'gql-sdl-arg';
      } else {
        cls = 'gql-sdl-field';
      }
      tokens.push({ text: word, cls });
      i = j;
      continue;
    }

    // Number  123 / 3.14
    if (NUMBER_START_RE.test(sdl[i])) {
      let j = i;
      while (j < n && /[0-9.eE+-]/.test(sdl[j])) j++;
      tokens.push({ text: sdl.slice(i, j), cls: 'gql-sdl-number' });
      i = j;
      continue;
    }

    // Punctuation — track parenthesis depth for argument name detection
    if (PUNCT.includes(sdl[i])) {
      if (sdl[i] === '(') parenDepth++;
      else if (sdl[i] === ')') parenDepth = Math.max(0, parenDepth - 1);
      tokens.push({ text: sdl[i], cls: 'gql-sdl-punc' });
      i++;
      continue;
    }

    // Whitespace and other characters — accumulate as plain text
    let j = i;
    while (
      j < n &&
      sdl[j] !== '"' &&
      sdl[j] !== '@' &&
      sdl[j] !== '#' &&
      !WORD_CONT_RE.test(sdl[j]) &&
      !PUNCT.includes(sdl[j])
    ) {
      j++;
    }
    if (j > i) {
      tokens.push({ text: sdl.slice(i, j) });
    } else {
      tokens.push({ text: sdl[i] });
      j = i + 1;
    }
    i = j;
  }

  return tokens;
}
