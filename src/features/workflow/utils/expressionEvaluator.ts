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
 */

import { EXPRESSION_FUNCTION_MAP } from './expressionFunctions';

export interface EvalContext {
  /** Resolve a variable name to its value. Returns undefined if not found. */
  resolveVariable?: (name: string) => string | undefined;
}

export interface EvalResult {
  value: unknown;
  error?: string;
}

// ── Tokenizer ──

type TokenType = 'string' | 'number' | 'bool' | 'func' | 'lparen' | 'rparen' | 'comma' | 'var' | 'ident';
interface Token { type: TokenType; value: string; }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    // Skip whitespace
    if (/\s/.test(expr[i])) { i++; continue; }

    // String literal (double or single quotes)
    if (expr[i] === '"' || expr[i] === "'") {
      const q = expr[i];
      let val = '';
      i++; // skip opening quote
      while (i < expr.length && expr[i] !== q) {
        if (expr[i] === '\\' && i + 1 < expr.length) { val += expr[i + 1]; i += 2; }
        else { val += expr[i]; i++; }
      }
      i++; // skip closing quote
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
      i += 2; // skip }}
      tokens.push({ type: 'var', value: name.trim() });
      continue;
    }

    // Number literal (including negative)
    if (/[0-9]/.test(expr[i]) || (expr[i] === '-' && i + 1 < expr.length && /[0-9]/.test(expr[i + 1]) && (tokens.length === 0 || tokens[tokens.length - 1].type === 'comma' || tokens[tokens.length - 1].type === 'lparen'))) {
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
    if (/[a-zA-Z_]/.test(expr[i])) {
      let ident = ''; 
      while (i < expr.length && /[a-zA-Z0-9_.]/.test(expr[i])) { ident += expr[i]; i++; }
      tokens.push({ type: 'ident', value: ident });
      continue;
    }

    // Unknown character — skip
    i++;
  }
  return tokens;
}

// ── Parser ──

interface ASTNode {
  kind: 'literal' | 'variable' | 'call';
  value?: unknown;
  varName?: string;
  funcName?: string;
  args?: ASTNode[];
}

function parse(tokens: Token[]): ASTNode {
  let pos = 0;

  function parseExpr(): ASTNode {
    if (pos >= tokens.length) return { kind: 'literal', value: '' };
    const tok = tokens[pos];

    // Function call
    if (tok.type === 'func') {
      const funcName = tok.value;
      pos++; // consume func name
      const args: ASTNode[] = [];
      if (pos < tokens.length && tokens[pos].type === 'lparen') {
        pos++; // consume (
        while (pos < tokens.length && tokens[pos].type !== 'rparen') {
          if (tokens[pos].type === 'comma') { pos++; continue; }
          args.push(parseExpr());
        }
        if (pos < tokens.length) pos++; // consume )
      }
      return { kind: 'call', funcName, args };
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

    default:
      return '';
  }
}

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
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
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
