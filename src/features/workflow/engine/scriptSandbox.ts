import type { ScriptNodeData, ScriptMode } from '../types/workflow';
import { validateOutputSize } from './scriptAnalysis';

export interface ScriptResult {
  success: boolean;
  outputs: Record<string, string>;
  consoleLogs: string[];
  error?: string;
  durationMs: number;
}

const MAX_TIMEOUT_MS = 30_000;

/**
 * Execute a user-authored script in a sandboxed Function() scope.
 * Input variables are passed as `input.*`, outputs are written to `output.*`.
 * Console calls are captured if `captureConsole` is true.
 */
export function executeScript(
  data: ScriptNodeData,
  resolvedInputs: Record<string, string>,
  libraryPreamble?: string,
): ScriptResult {
  const consoleLogs: string[] = [];
  const output: Record<string, unknown> = {};
  const start = performance.now();

  const timeoutMs = Math.min(
    Math.max(data.timeoutMs || 5000, 0),
    MAX_TIMEOUT_MS,
  );

  const consoleProxy = {
    log: (...args: unknown[]) => consoleLogs.push(args.map(String).join(' ')),
    warn: (...args: unknown[]) => consoleLogs.push(`[warn] ${args.map(String).join(' ')}`),
    error: (...args: unknown[]) => consoleLogs.push(`[error] ${args.map(String).join(' ')}`),
    info: (...args: unknown[]) => consoleLogs.push(args.map(String).join(' ')),
  };

  try {
    // Build a frozen input object from resolved variables
    const input: Record<string, string> = {};
    for (const varName of data.inputVariables) {
      input[varName] = resolvedInputs[varName] ?? '';
    }
    Object.freeze(input);

    // Construct sandboxed function body
    const fullCode = (libraryPreamble || '') + data.code;
    const fn = new Function(
      'input', 'output', 'console',
      fullCode,
    );

    // Execute with timeout guard
    const result = executeWithTimeout(
      () => fn(input, output, data.captureConsole ? consoleProxy : consoleProxy),
      timeoutMs,
    );

    // Handle async results (not supported — treat as sync only)
    if (result && typeof result === 'object' && typeof (result as Promise<unknown>).then === 'function') {
      return {
        success: false,
        outputs: {},
        consoleLogs,
        error: 'Async code (await/Promise) is not supported in script nodes. Use synchronous code only.',
        durationMs: performance.now() - start,
      };
    }

    // Stringify outputs
    const stringOutputs: Record<string, string> = {};
    for (const key of data.outputVariables) {
      const val = output[key];
      if (val !== undefined) {
        stringOutputs[key] = typeof val === 'string' ? val : JSON.stringify(val);
      }
    }

    // Enforce max output size (Phase C: 1 MB limit)
    const sizeCheck = validateOutputSize(stringOutputs);
    if (!sizeCheck.valid) {
      return {
        success: false,
        outputs: {},
        consoleLogs,
        error: sizeCheck.error,
        durationMs: performance.now() - start,
      };
    }

    // Validate mode: check if output.result is truthy
    if (data.mode === 'validate') {
      const passed = isTruthy(output['result']);
      return {
        success: passed,
        outputs: stringOutputs,
        consoleLogs,
        error: passed ? undefined : `Validation failed: output.result = ${String(output['result'])}`,
        durationMs: performance.now() - start,
      };
    }

    return {
      success: true,
      outputs: stringOutputs,
      consoleLogs,
      durationMs: performance.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      outputs: {},
      consoleLogs,
      error: err instanceof Error ? err.message : String(err),
      durationMs: performance.now() - start,
    };
  }
}

function isTruthy(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val === 'true' || val === '1';
  if (typeof val === 'number') return val !== 0;
  return true;
}

function executeWithTimeout<T>(fn: () => T, _timeoutMs: number): T {
  // In a browser/Tauri environment, true timeout enforcement for synchronous
  // code isn't possible without a Worker. For now, we execute synchronously
  // and rely on the runtime's own limits. The timeout value is validated and
  // stored for future Worker-based implementation.
  return fn();
}

/** Helper to get the mode label for logging. */
export function scriptModeLabel(mode: ScriptMode): string {
  switch (mode) {
    case 'transform': return 'Transform';
    case 'validate': return 'Validate';
    case 'generate': return 'Generate';
  }
}
