/**
 * Utility functions for Script node — auto-detection and analysis.
 */

import { formatBytes } from '../../../shared/utils/helpers';

/**
 * Auto-detect output variable names from script code by scanning
 * for `output.xxx = ...` assignment patterns.
 * Returns a deduplicated, sorted list of variable names.
 */
export function detectOutputVariables(code: string): string[] {
  if (!code) return [];
  const pattern = /\boutput\.(\w+)\s*=/g;
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    vars.add(match[1]);
  }
  return [...vars].sort();
}

/**
 * Analyze script code for potential complexity issues.
 * Returns warnings (not errors) — purely advisory.
 */
export function analyzeScriptComplexity(code: string): string[] {
  if (!code) return [];
  const warnings: string[] = [];

  // Check for `while(true)` or `for(;;)` infinite loop patterns
  if (/\bwhile\s*\(\s*true\s*\)/.test(code) || /\bfor\s*\(\s*;\s*;\s*\)/.test(code)) {
    warnings.push('Potential infinite loop detected (while(true) or for(;;)). Ensure a break condition exists.');
  }

  // Check for deep recursion patterns (function calling itself)
  const fnMatch = code.match(/\bfunction\s+(\w+)/g);
  if (fnMatch) {
    for (const m of fnMatch) {
      const fnName = m.replace(/^function\s+/, '');
      const callPattern = new RegExp(`\\b${fnName}\\s*\\(`, 'g');
      const calls = code.match(callPattern);
      if (calls && calls.length > 1) {
        warnings.push(`Function "${fnName}" may be recursive. Ensure a base case exists to prevent stack overflow.`);
      }
    }
  }

  // Check for very long code (might be pasted minified code)
  const lines = code.split('\n');
  if (lines.some(line => line.length > 500)) {
    warnings.push('Very long line detected (>500 chars). Consider formatting the code for readability.');
  }

  // Check for eval() usage
  if (/\beval\s*\(/.test(code)) {
    warnings.push('Use of eval() detected. This is blocked in the sandbox and will cause a runtime error.');
  }

  // Check for fetch/XMLHttpRequest
  if (/\b(fetch|XMLHttpRequest)\s*\(/.test(code)) {
    warnings.push('Network access (fetch/XMLHttpRequest) is not available in the sandbox. Use HTTP nodes for API calls.');
  }

  // Check for setTimeout/setInterval
  if (/\b(setTimeout|setInterval)\s*\(/.test(code)) {
    warnings.push('setTimeout/setInterval are not available in the sandbox. Use synchronous code only.');
  }

  return warnings;
}

/** Max total byte size for all output variable values combined. */
export const MAX_OUTPUT_SIZE_BYTES = 1_048_576; // 1 MB

/**
 * Check if the combined output size exceeds the maximum.
 * Returns the total size in bytes if valid, or throws an error message string.
 */
export function validateOutputSize(outputs: Record<string, string>): { valid: boolean; totalBytes: number; error?: string } {
  let totalBytes = 0;
  for (const value of Object.values(outputs)) {
    totalBytes += new TextEncoder().encode(value).length;
  }
  if (totalBytes > MAX_OUTPUT_SIZE_BYTES) {
    return {
      valid: false,
      totalBytes,
      error: `Output size ${formatBytes(totalBytes)} exceeds maximum ${formatBytes(MAX_OUTPUT_SIZE_BYTES)}. Reduce the amount of data written to output variables.`,
    };
  }
  return { valid: true, totalBytes };
}

/**
 * Analyze script code to infer the structure that each input variable needs.
 * Scans for property access patterns like `input.varName.foo.bar` and builds
 * a skeleton JSON object with placeholder values.
 *
 * For variables with no detected property access, falls back to a name-based
 * heuristic (e.g. names containing "json" → "{}").
 */
export function inferMockInputs(code: string, inputVariables: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const varName of inputVariables) {
    if (!varName) continue;

    // Look for patterns where the parsed result is accessed:
    //   const x = JSON.parse(input.varName);  → then scan for x.prop.sub
    const parsedAliases = findParsedAliases(code, varName);

    // Check if any alias is used as an array (for-of, .map, .forEach, etc.)
    const arrayInfo = detectArrayUsage(code, parsedAliases);

    if (arrayInfo) {
      // Collect element property paths from loop/callback variables
      const elementPaths = new Set<string>();
      for (const elVar of arrayInfo.elementVars) {
        collectPropertyPaths(code, elVar, elementPaths);
      }
      if (elementPaths.size > 0) {
        // Remove built-in method names from leaf paths
        const cleanedPaths = stripBuiltinLeaves(elementPaths);
        if (cleanedPaths.size > 0) {
          result[varName] = JSON.stringify([buildSkeleton(cleanedPaths)], null, 2);
        } else {
          result[varName] = '["test"]';
        }
      } else {
        result[varName] = '["test"]';
      }
      continue;
    }

    // Collect all property paths from aliases
    const paths = new Set<string>();
    for (const alias of parsedAliases) {
      collectPropertyPaths(code, alias, paths);
    }
    // Remove array-like built-in properties that aren't real structure
    for (const p of ARRAY_METHOD_NAMES) paths.delete(p);

    // Also collect direct property access on input.varName (for non-JSON string vars)
    collectPropertyPaths(code, `input\\.${varName}`, paths);

    if (paths.size > 0) {
      // Build a skeleton object from the paths
      result[varName] = JSON.stringify(buildSkeleton(paths), null, 2);
    } else {
      // Fallback: name-based heuristic
      result[varName] = inferDefaultByName(varName);
    }
  }

  return result;
}

/** Property names that are array/string built-ins, not real object structure. */
const ARRAY_METHOD_NAMES = new Set([
  'length', 'map', 'filter', 'find', 'some', 'every', 'reduce', 'forEach',
  'slice', 'splice', 'indexOf', 'includes', 'join', 'concat', 'sort', 'reverse',
  'push', 'pop', 'shift', 'unshift', 'flat', 'flatMap', 'keys', 'values', 'entries',
  'split', 'trim', 'replace', 'match', 'search', 'toLowerCase', 'toUpperCase',
  'toString', 'valueOf', 'charAt', 'charCodeAt', 'substring', 'substr', 'startsWith',
  'endsWith', 'padStart', 'padEnd', 'repeat', 'localeCompare',
  'toFixed', 'toPrecision', 'toExponential',
]);

/**
 * Detect if any of the parsed aliases are used as arrays in the code.
 * Returns element variable names from for-of loops and callback params, or null.
 */
function detectArrayUsage(code: string, aliases: string[]): { elementVars: string[] } | null {
  const elementVars: string[] = [];

  for (const alias of aliases) {
    // for (const/let/var x of alias)
    const forOfPattern = new RegExp(
      `for\\s*\\(\\s*(?:const|let|var)\\s+(\\w+)\\s+of\\s+${alias}\\b`,
      'g',
    );
    let m: RegExpExecArray | null;
    while ((m = forOfPattern.exec(code)) !== null) {
      elementVars.push(m[1]);
    }

    // alias.map(function(x) or alias.map((x) or alias.map(x =>
    const callbackPattern = new RegExp(
      `${alias}\\.(?:map|filter|find|forEach|some|every|reduce)\\s*\\(\\s*(?:function\\s*\\(\\s*(\\w+)|\\(?(\\w+)\\)?\\s*=>)`,
      'g',
    );
    while ((m = callbackPattern.exec(code)) !== null) {
      const elVar = m[1] || m[2];
      if (elVar) elementVars.push(elVar);
    }
  }

  return elementVars.length > 0 ? { elementVars } : null;
}

/**
 * Remove property paths whose leaf (or any segment) is a built-in method name.
 * e.g. "body.split" → trimmed to "body", "length" → removed entirely.
 */
function stripBuiltinLeaves(paths: Set<string>): Set<string> {
  const cleaned = new Set<string>();
  for (const path of paths) {
    const parts = path.split('.');
    // Trim trailing built-in method segments
    while (parts.length > 0 && ARRAY_METHOD_NAMES.has(parts[parts.length - 1])) {
      parts.pop();
    }
    if (parts.length > 0) {
      cleaned.add(parts.join('.'));
    }
  }
  return cleaned;
}

/** Find local variable names that are assigned from JSON.parse(input.varName). */
function findParsedAliases(code: string, varName: string): string[] {
  const aliases: string[] = [];
  // Match: const/let/var x = JSON.parse(input.varName)
  const pattern = new RegExp(
    `(?:const|let|var)\\s+(\\w+)\\s*=\\s*JSON\\.parse\\(\\s*input\\.${varName}\\s*\\)`,
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(code)) !== null) {
    aliases.push(m[1]);
  }
  return aliases;
}

/** Collect property access paths like alias.foo.bar from code. */
function collectPropertyPaths(code: string, prefix: string, paths: Set<string>) {
  // Match prefix.prop1.prop2... (chain of .identifier)
  const pattern = new RegExp(`${prefix}\\.(\\w+(?:\\.\\w+)*)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(code)) !== null) {
    paths.add(m[1]);
  }
}

/** Build a skeleton object from dotted property paths. */
function buildSkeleton(paths: Set<string>): Record<string, unknown> {
  const root: Record<string, unknown> = {};

  for (const path of paths) {
    const parts = path.split('.');
    let current: Record<string, unknown> = root;
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i];
      if (i === parts.length - 1) {
        // Leaf — only set if not already an object from a deeper path
        if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
          current[key] = 'test';
        }
      } else {
        // Intermediate — ensure it's an object
        if (typeof current[key] !== 'object' || current[key] === null) {
          current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
      }
    }
  }

  return root;
}

/** Infer a default value from the variable name alone. */
function inferDefaultByName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('json') || lower.includes('data') || lower.includes('payload') || lower.includes('body') || lower.includes('response') || lower.includes('request'))
    return '{}';
  if (lower.includes('list') || lower.includes('array') || lower.includes('items') || lower.includes('titles') || lower.includes('posts') || lower.includes('users') || lower.includes('records') || lower.includes('results') || lower.includes('entries') || lower.includes('rows'))
    return '[]';
  if (lower.includes('count') || lower.includes('index') || lower.includes('total') || lower.includes('size') || lower.includes('page') || lower.includes('limit') || lower.includes('num') || lower.includes('timeout'))
    return '0';
  if (lower.includes('flag') || lower.includes('enabled') || lower.includes('active') || lower.includes('valid'))
    return 'false';
  return 'test';
}
