export function isTruthy(v: unknown): boolean {
  if (v === false || v === 0 || v === '' || v === null || v === undefined) return false;
  if (typeof v === 'number' && isNaN(v)) return false;
  return true;
}

const DOLLAR_PATH_CHAR = /[\w.[*\]-]/;

/**
 * Pre-processes custom assertion expressions to wrap `$.path` references
 * in `{{...}}` so the expression evaluator resolves them as variables.
 * Bare `$` (not followed by a function-name character) is also wrapped.
 */
export function wrapCustomExprDollarPaths(expr: string): string {
  let result = '';
  let i = 0;
  while (i < expr.length) {
    // Skip quoted strings
    if (expr[i] === '"' || expr[i] === "'") {
      const q = expr[i];
      result += q; i++;
      while (i < expr.length && expr[i] !== q) {
        if (expr[i] === '\\' && i + 1 < expr.length) { result += expr[i] + expr[i + 1]; i += 2; }
        else { result += expr[i]; i++; }
      }
      if (i < expr.length) { result += expr[i]; i++; }
      continue;
    }
    // Skip already-wrapped {{...}}
    if (expr[i] === '{' && i + 1 < expr.length && expr[i + 1] === '{') {
      let depth = 1;
      result += '{{'; i += 2;
      while (i < expr.length && depth > 0) {
        if (expr[i] === '{' && i + 1 < expr.length && expr[i + 1] === '{') { depth++; result += '{{'; i += 2; }
        else if (expr[i] === '}' && i + 1 < expr.length && expr[i + 1] === '}') { depth--; result += '}}'; i += 2; }
        else { result += expr[i]; i++; }
      }
      continue;
    }
    // $.path → {{$.path}}, bare $ → {{$}}
    if (expr[i] === '$' && (i + 1 >= expr.length || expr[i + 1] === '.' || expr[i + 1] === ')' || expr[i + 1] === ',' || /\s/.test(expr[i + 1]))) {
      if (i + 1 < expr.length && expr[i + 1] === '.') {
        let path = '$.'; let j = i + 2;
        while (j < expr.length && DOLLAR_PATH_CHAR.test(expr[j])) { path += expr[j]; j++; }
        result += `{{${path}}}`; i = j;
      } else {
        result += '{{$}}'; i++;
      }
      continue;
    }
    result += expr[i]; i++;
  }
  return result;
}
