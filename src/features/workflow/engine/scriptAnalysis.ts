/**
 * Utility functions for Script node — auto-detection and analysis.
 */

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
