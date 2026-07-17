/**
 * Phase 11D - Sandboxed mock predicate parser and evaluator.
 *
 * Parses a constrained expression language into structured predicates and evaluates
 * them against call context without eval/Function or arbitrary JS execution.
 */

import { getByPath } from '../utils/jsonPath';
import type {
  GrpcMockEvaluationContext,
  GrpcMockPredicate,
} from './grpcMockRuleContracts';

export const GRPC_MOCK_FORBIDDEN_EXPRESSION_PATTERNS = [
  /\beval\b/i,
  /\bFunction\b/,
  /\bnew\s+Function\b/i,
  /=>/,
  /\bimport\b/i,
  /\brequire\b/i,
  /\b__proto__\b/,
  /\bconstructor\b/,
  /\bprototype\b/,
  /;/,
  /`/,
] as const;

export class GrpcMockPredicateParseError extends Error {
  readonly category = 'validation' as const;

  constructor(message: string) {
    super(message);
    this.name = 'GrpcMockPredicateParseError';
  }
}

export class GrpcMockPredicateSecurityError extends Error {
  readonly category = 'validation' as const;

  constructor(message: string) {
    super(message);
    this.name = 'GrpcMockPredicateSecurityError';
  }
}

type TokenKind =
  | 'ident'
  | 'string'
  | 'number'
  | 'boolean'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'eof';

interface Token {
  kind: TokenKind;
  value: string;
  position: number;
}

function stripQuotedLiteralsForSecurityScan(expression: string): string {
  return expression
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function assertExpressionIsSafe(expression: string): void {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new GrpcMockPredicateParseError('Expression cannot be empty.');
  }

  const scanTarget = stripQuotedLiteralsForSecurityScan(trimmed);
  for (const pattern of GRPC_MOCK_FORBIDDEN_EXPRESSION_PATTERNS) {
    if (pattern.test(scanTarget)) {
      throw new GrpcMockPredicateSecurityError(`Forbidden expression pattern: ${pattern}`);
    }
  }
}

function tokenizeExpression(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  const push = (kind: TokenKind, value: string, position: number) => {
    tokens.push({ kind, value, position });
  };

  while (index < expression.length) {
    const start = index;
    const ch = expression[index]!;

    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }

    if (ch === '(') {
      push('lparen', ch, start);
      index += 1;
      continue;
    }
    if (ch === ')') {
      push('rparen', ch, start);
      index += 1;
      continue;
    }

    if (ch === '"' || ch === '\'') {
      const quote = ch;
      index += 1;
      let value = '';
      while (index < expression.length && expression[index] !== quote) {
        if (expression[index] === '\\' && index + 1 < expression.length) {
          value += expression[index + 1];
          index += 2;
          continue;
        }
        value += expression[index];
        index += 1;
      }
      if (expression[index] !== quote) {
        throw new GrpcMockPredicateParseError(`Unterminated string at position ${start}.`);
      }
      index += 1;
      push('string', value, start);
      continue;
    }

    if (ch === '=' && expression[index + 1] === '=') {
      push('op', '==', start);
      index += 2;
      continue;
    }
    if (ch === '!' && expression[index + 1] === '=') {
      push('op', '!=', start);
      index += 2;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(expression[index + 1] ?? ''))) {
      let value = ch;
      index += 1;
      while (index < expression.length && /[0-9.]/.test(expression[index]!)) {
        value += expression[index];
        index += 1;
      }
      push('number', value, start);
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let value = ch;
      index += 1;
      while (index < expression.length && /[A-Za-z0-9_.\-[\]]/.test(expression[index]!)) {
        value += expression[index];
        index += 1;
      }
      const upper = value.toUpperCase();
      if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
        push('op', upper, start);
      } else if (upper === 'TRUE' || upper === 'FALSE') {
        push('boolean', upper.toLowerCase(), start);
      } else {
        push('ident', value, start);
      }
      continue;
    }

    throw new GrpcMockPredicateParseError(`Unexpected character '${ch}' at position ${start}.`);
  }

  push('eof', '', expression.length);
  return tokens;
}

function normalizePathSegment(value: string): string {
  return value.startsWith('.') ? value.slice(1) : value;
}

function assertSafePathSegment(segment: string, position: number): string {
  const normalized = normalizePathSegment(segment);
  if (
    !normalized
    || normalized.includes('__proto__')
    || normalized.includes('constructor')
    || normalized.includes('prototype')
  ) {
    throw new GrpcMockPredicateSecurityError(`Unsafe path segment at position ${position}.`);
  }
  return normalized;
}

function assertSafeMetadataKey(segment: string, position: number): string {
  const normalized = normalizePathSegment(segment);
  if (!normalized || normalized.includes('__proto__')) {
    throw new GrpcMockPredicateSecurityError(`Unsafe metadata key at position ${position}.`);
  }
  return normalized;
}

class Parser {
  private index = 0;

  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1]!;
  }

  private consume(expected?: string): Token {
    const token = this.peek();
    if (expected != null && token.value !== expected && token.kind !== expected) {
      throw new GrpcMockPredicateParseError(
        `Expected '${expected}' at position ${token.position}, found '${token.value}'.`,
      );
    }
    this.index += 1;
    return token;
  }

  parse(): GrpcMockPredicate {
    const predicate = this.parseOr();
    if (this.peek().kind !== 'eof') {
      throw new GrpcMockPredicateParseError(`Unexpected token at position ${this.peek().position}.`);
    }
    return predicate;
  }

  private parseOr(): GrpcMockPredicate {
    const predicates = [this.parseAnd()];
    while (this.peek().kind === 'op' && this.peek().value === 'OR') {
      this.consume('OR');
      predicates.push(this.parseAnd());
    }
    return predicates.length === 1 ? predicates[0]! : { kind: 'or', predicates };
  }

  private parseAnd(): GrpcMockPredicate {
    const predicates = [this.parseNot()];
    while (this.peek().kind === 'op' && this.peek().value === 'AND') {
      this.consume('AND');
      predicates.push(this.parseNot());
    }
    return predicates.length === 1 ? predicates[0]! : { kind: 'and', predicates };
  }

  private parseNot(): GrpcMockPredicate {
    if (this.peek().kind === 'op' && this.peek().value === 'NOT') {
      this.consume('NOT');
      return { kind: 'not', predicate: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): GrpcMockPredicate {
    if (this.peek().kind === 'lparen') {
      this.consume('lparen');
      const inner = this.parseOr();
      this.consume('rparen');
      return inner;
    }

    const predicate = this.parseAtomicPredicate();
    return predicate;
  }

  private parseAtomicPredicate(): GrpcMockPredicate {
    const root = this.consume('ident');

    if (root.value === 'method') {
      const operator = this.consume('op').value;
      const literal = this.parseLiteralToken();
      const base: GrpcMockPredicate = { kind: 'method_equals', method: literal };
      return operator === '==' ? base : { kind: 'not', predicate: base };
    }

    if (root.value === 'service') {
      const operator = this.consume('op').value;
      const literal = this.parseLiteralToken();
      const base: GrpcMockPredicate = { kind: 'service_equals', service: literal };
      return operator === '==' ? base : { kind: 'not', predicate: base };
    }

    if (root.value === 'request' || root.value.startsWith('request.')) {
      const pathToken = root.value === 'request' ? this.consume('ident') : root;
      const path = root.value === 'request'
        ? assertSafePathSegment(pathToken.value, pathToken.position)
        : assertSafePathSegment(root.value.slice('request.'.length), root.position);
      if (this.peek().kind === 'op' && (this.peek().value === '==' || this.peek().value === '!=')) {
        const operator = this.consume('op').value;
        const literal = this.parseLiteralToken();
        const base: GrpcMockPredicate = { kind: 'body_path_equals', path, value: literal };
        return operator === '==' ? base : { kind: 'not', predicate: base };
      }
      return { kind: 'body_path_exists', path };
    }

    if (root.value === 'metadata' || root.value.startsWith('metadata.')) {
      const keyToken = root.value === 'metadata' ? this.consume('ident') : root;
      const key = root.value === 'metadata'
        ? assertSafeMetadataKey(keyToken.value, keyToken.position)
        : assertSafeMetadataKey(root.value.slice('metadata.'.length), root.position);
      const operator = this.consume('op').value;
      const literal = this.parseLiteralToken();
      const base: GrpcMockPredicate = { kind: 'metadata_equals', key, value: literal };
      return operator === '==' ? base : { kind: 'not', predicate: base };
    }

    throw new GrpcMockPredicateParseError(`Unknown identifier '${root.value}' at position ${root.position}.`);
  }

  private parseLiteralToken(): string {
    const token = this.consume();
    if (token.kind === 'string' || token.kind === 'number' || token.kind === 'boolean') {
      return token.value;
    }
    throw new GrpcMockPredicateParseError(`Expected literal at position ${token.position}.`);
  }
}

export function parseGrpcMockPredicateExpression(expression: string): GrpcMockPredicate {
  assertExpressionIsSafe(expression);
  const tokens = tokenizeExpression(expression);
  return new Parser(tokens).parse();
}

function valueToComparableString(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

function resolveBodyPathValue(context: GrpcMockEvaluationContext, path: string): unknown {
  if (path.includes('__proto__') || path.includes('constructor') || path.includes('prototype')) {
    return undefined;
  }
  return getByPath(context.requestBody, path.startsWith('$.') ? path : `$.${path}`);
}

export function evaluateGrpcMockPredicate(
  predicate: GrpcMockPredicate,
  context: GrpcMockEvaluationContext,
): boolean {
  switch (predicate.kind) {
    case 'method_equals':
      return context.method === predicate.method;
    case 'service_equals':
      return context.service === predicate.service;
    case 'metadata_equals':
      return context.metadata[predicate.key] === predicate.value;
    case 'metadata_exists':
      return context.metadata[predicate.key] != null;
    case 'body_path_equals':
      return valueToComparableString(resolveBodyPathValue(context, predicate.path)) === predicate.value;
    case 'body_path_exists': {
      const value = resolveBodyPathValue(context, predicate.path);
      return value !== undefined && value !== null;
    }
    case 'and':
      return predicate.predicates.every((child) => evaluateGrpcMockPredicate(child, context));
    case 'or':
      return predicate.predicates.some((child) => evaluateGrpcMockPredicate(child, context));
    case 'not':
      return !evaluateGrpcMockPredicate(predicate.predicate, context);
    case 'expression':
      return evaluateGrpcMockPredicate(parseGrpcMockPredicateExpression(predicate.expression), context);
    default:
      return false;
  }
}
