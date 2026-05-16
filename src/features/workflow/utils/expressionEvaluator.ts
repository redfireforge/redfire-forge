/**
 * Expression evaluator — parses and evaluates `$fn(arg1, arg2, ...)` expressions.
 *
 * Supports:
 *  - String literals: "hello" or 'hello'
 *  - Number literals: 42, 3.14, -5
 *  - Boolean literals: true, false
 *  - Variable references: {{varName}} or bare identifiers
 *  - Nested function calls: $upper($trim(value))
 *  - Multiple arguments: $concat("a", "b", "c")
 *  - Lambda expressions: x => $upper(x), (acc, x) => $add(acc, x)
 */

import { EXPRESSION_FUNCTION_MAP } from './expressionFunctions';
import { registerEvalNode, isLambda, type EvalContext, type LambdaValue } from './lambdaUtils';

export type { EvalContext, LambdaValue };
export { isLambda, applyLambda } from './lambdaUtils';

export interface EvalResult {
  value: unknown;
  error?: string;
}

// ── Tokenizer ──

type TokenType = 'string' | 'number' | 'bool' | 'func' | 'lparen' | 'rparen' | 'comma' | 'var' | 'ident' | 'arrow' | 'lbracket' | 'rbracket' | 'dot_access';
interface Token { type: TokenType; value: string; }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue; }

    // String literal (double or single quotes)
    if (expr[i] === '"' || expr[i] === "'") {
      const q = expr[i];
      let val = '';
      i++;
      while (i < expr.length && expr[i] !== q) {
        if (expr[i] === '\\' && i + 1 < expr.length) { val += expr[i + 1]; i += 2; }
        else { val += expr[i]; i++; }
      }
      i++;
      tokens.push({ type: 'string', value: val });
      continue;
    }

    // Variable reference: {{...}}
    if (expr[i] === '{' && expr[i + 1] === '{') {
      i += 2;
      let name = '';
      while (i < expr.length && !(expr[i] === '}' && expr[i + 1] === '}')) {
        name += expr[i]; i++;
      }
      i += 2;
      tokens.push({ type: 'var', value: name.trim() });
      continue;
    }

    // Arrow operator: =>
    if (expr[i] === '=' && i + 1 < expr.length && expr[i + 1] === '>') {
      tokens.push({ type: 'arrow', value: '=>' });
      i += 2;
      continue;
    }

    // Number literal (including negative)
    if (/[0-9]/.test(expr[i]) || (expr[i] === '-' && i + 1 < expr.length && /[0-9]/.test(expr[i + 1]) && (tokens.length === 0 || tokens[tokens.length - 1].type === 'comma' || tokens[tokens.length - 1].type === 'lparen' || tokens[tokens.length - 1].type === 'lbracket'))) {
      let num = expr[i]; i++;
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i++; }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Function name: $identifier
    if (expr[i] === '$') {
      let name = '$'; i++;
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) { name += expr[i]; i++; }
      tokens.push({ type: 'func', value: name });
      continue;
    }

    // Parentheses
    if (expr[i] === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue; }
    if (expr[i] === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue; }

    // Dot — property access on function result (e.g. $fn(...).prop)
    if (expr[i] === '.' && tokens.length > 0 && tokens[tokens.length - 1].type === 'rparen') {
      i++; // consume .
      let prop = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) { prop += expr[i]; i++; }
      if (prop) tokens.push({ type: 'dot_access', value: prop });
      continue;
    }

    // Array brackets — only when not part of an ident path
    if (expr[i] === '[') { tokens.push({ type: 'lbracket', value: '[' }); i++; continue; }
    if (expr[i] === ']') { tokens.push({ type: 'rbracket', value: ']' }); i++; continue; }

    // Comma
    if (expr[i] === ',') { tokens.push({ type: 'comma', value: ',' }); i++; continue; }

    // Boolean
    if (expr.slice(i, i + 4) === 'true' && (i + 4 >= expr.length || !/[a-zA-Z0-9_]/.test(expr[i + 4]))) {
      tokens.push({ type: 'bool', value: 'true' }); i += 4; continue;
    }
    if (expr.slice(i, i + 5) === 'false' && (i + 5 >= expr.length || !/[a-zA-Z0-9_]/.test(expr[i + 5]))) {
      tokens.push({ type: 'bool', value: 'false' }); i += 5; continue;
    }

    // Bare identifier (fallback — treated as variable name)
    // Also consumes bracket notation (e.g. offers[0].offerName) so path
    // references inside function args are kept as a single token.
    if (/[a-zA-Z_]/.test(expr[i])) {
      let ident = '';
      while (i < expr.length && /[a-zA-Z0-9_.]/.test(expr[i])) { ident += expr[i]; i++; }
      while (i < expr.length && expr[i] === '[') {
        ident += expr[i]; i++;
        while (i < expr.length && expr[i] !== ']') { ident += expr[i]; i++; }
        if (i < expr.length && expr[i] === ']') { ident += expr[i]; i++; }
        if (i < expr.length && expr[i] === '.') { ident += expr[i]; i++; }
        while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) { ident += expr[i]; i++; }
      }
      tokens.push({ type: 'ident', value: ident });
      continue;
    }

    // Unknown character — skip
    i++;
  }
  return tokens;
}

// ── Parser ──

export interface ASTNode {
  kind: 'literal' | 'variable' | 'call' | 'lambda' | 'array' | 'prop_access';
  value?: unknown;
  varName?: string;
  funcName?: string;
  args?: ASTNode[];
  elements?: ASTNode[];
  params?: string[];
  body?: ASTNode;
  object?: ASTNode;
  property?: string;
}

function parse(tokens: Token[]): ASTNode {
  let pos = 0;

  function isLambdaParamList(): boolean {
    let j = pos + 1;
    while (j < tokens.length) {
      if (tokens[j].type === 'rparen') {
        return j + 1 < tokens.length && tokens[j + 1].type === 'arrow';
      }
      if (tokens[j].type !== 'ident' && tokens[j].type !== 'comma') return false;
      j++;
    }
    return false;
  }

  function parseLambdaParams(): string[] {
    const params: string[] = [];
    pos++; // consume (
    while (pos < tokens.length && tokens[pos].type !== 'rparen') {
      if (tokens[pos].type === 'comma') { pos++; continue; }
      if (tokens[pos].type === 'ident') { params.push(tokens[pos].value); pos++; }
      else break;
    }
    if (pos < tokens.length) pos++; // consume )
    if (pos < tokens.length && tokens[pos].type === 'arrow') pos++; // consume =>
    return params;
  }

  function parseExpr(): ASTNode {
    if (pos >= tokens.length) return { kind: 'literal', value: '' };
    const tok = tokens[pos];

    // Lambda: single param — `x => body`
    if (tok.type === 'ident' && pos + 1 < tokens.length && tokens[pos + 1].type === 'arrow') {
      const paramName = tok.value;
      pos += 2; // consume ident + =>
      const body = parseExpr();
      return { kind: 'lambda', params: [paramName], body };
    }

    // Lambda: multi param — `(a, b) => body`
    if (tok.type === 'lparen' && isLambdaParamList()) {
      const params = parseLambdaParams();
      const body = parseExpr();
      return { kind: 'lambda', params, body };
    }

    // Array literal: [expr, expr, ...]
    if (tok.type === 'lbracket') {
      pos++; // consume [
      const elements: ASTNode[] = [];
      while (pos < tokens.length && tokens[pos].type !== 'rbracket') {
        if (tokens[pos].type === 'comma') { pos++; continue; }
        elements.push(parseExpr());
      }
      if (pos < tokens.length) pos++; // consume ]
      return { kind: 'array', elements };
    }

    // Function call
    if (tok.type === 'func') {
      const funcName = tok.value;
      pos++;
      const args: ASTNode[] = [];
      if (pos < tokens.length && tokens[pos].type === 'lparen') {
        pos++; // consume (
        while (pos < tokens.length && tokens[pos].type !== 'rparen') {
          if (tokens[pos].type === 'comma') { pos++; continue; }
          args.push(parseExpr());
        }
        if (pos < tokens.length) pos++; // consume )
      }
      let node: ASTNode = { kind: 'call', funcName, args };
      while (pos < tokens.length && tokens[pos].type === 'dot_access') {
        node = { kind: 'prop_access', object: node, property: tokens[pos].value };
        pos++;
      }
      return node;
    }

    // String literal
    if (tok.type === 'string') { pos++; return { kind: 'literal', value: tok.value }; }

    // Number literal
    if (tok.type === 'number') { pos++; return { kind: 'literal', value: parseFloat(tok.value) }; }

    // Boolean literal
    if (tok.type === 'bool') { pos++; return { kind: 'literal', value: tok.value === 'true' }; }

    // Variable reference
    if (tok.type === 'var') { pos++; return { kind: 'variable', varName: tok.value }; }

    // Bare identifier
    if (tok.type === 'ident') { pos++; return { kind: 'variable', varName: tok.value }; }

    pos++;
    return { kind: 'literal', value: '' };
  }

  return parseExpr();
}

// ── Evaluator ──

function evalNode(node: ASTNode, ctx: EvalContext): unknown {
  switch (node.kind) {
    case 'literal':
      return node.value;

    case 'variable': {
      const name = node.varName ?? '';
      return ctx.resolveVariable?.(name) ?? `{{${name}}}`;
    }

    case 'call': {
      const fn = EXPRESSION_FUNCTION_MAP.get(node.funcName ?? '');
      if (!fn) return `{{${node.funcName ?? ''}}}`;
      const args = (node.args ?? []).map((a) => evalNode(a, ctx));
      try { return fn.evaluate(...args); }
      catch (e) { return `[Error: ${e instanceof Error ? e.message : String(e)}]`; }
    }

    case 'array':
      return (node.elements ?? []).map((el) => evalNode(el, ctx));

    case 'lambda':
      return { __type: 'lambda', params: node.params!, body: node.body!, closureCtx: ctx } as LambdaValue;

    case 'prop_access': {
      const obj = evalNode(node.object!, ctx);
      if (obj != null && typeof obj === 'object' && node.property) {
        return (obj as Record<string, unknown>)[node.property];
      }
      return undefined;
    }

    default:
      return '';
  }
}

registerEvalNode(evalNode);

/**
 * Evaluate an expression string.
 * @param expr - Expression like `$upper("hello")` or `$concat({{name}}, " suffix")`
 * @param ctx  - Context for resolving variable references
 */
export function evaluateExpression(expr: string, ctx: EvalContext = {}): EvalResult {
  try {
    const trimmed = expr.trim();
    if (!trimmed) return { value: '' };
    const tokens = tokenize(trimmed);
    const ast = parse(tokens);
    const value = evalNode(ast, ctx);
    return { value };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Format an expression result as a display string.
 */
export function formatExpressionResult(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') {
    if (isLambda(value)) return `[Lambda: (${value.params.join(', ')}) => ...]`;
    try {
      return JSON.stringify(value, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      );
    } catch { return String(value); }
  }
  return String(value);
}

/**
 * Build a template string from a function and arg values for insertion.
 * E.g. buildExpressionTemplate("$upper", ["{{name}}"]) → "{{$upper({{name}})}}"
 */
export function buildExpressionTemplate(funcName: string, argValues: string[]): string {
  const inner = argValues.length > 0 ? `${funcName}(${argValues.join(', ')})` : `${funcName}()`;
  return `{{${inner}}}`;
}
