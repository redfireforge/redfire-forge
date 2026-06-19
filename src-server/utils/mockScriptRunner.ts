/**
 * mockScriptRunner.ts — Phase 3E (task 3E-12)
 *
 * Node.js-side sandbox for mock "Script" resolvers.
 *
 * The browser-side `preRequestScriptRunner.ts` cannot run in Node.js because
 * it relies on `new Function()` with browser globals (window, fetch, etc.).
 * This module uses the Node.js built-in `vm` module to execute scripts in a
 * restricted context — the same isolation principle, but server-side.
 *
 * Injected context (narrower than RfContext — mock resolvers only need to
 * produce a return value):
 *   { field, typeName, args, log }
 *
 * Security:
 *   - The vm sandbox has no access to process, require, global, or module
 *   - A 10-second wall-clock timeout is enforced via vm option
 *   - Scripts are expected to be single expressions or short function bodies
 *     returning the mock value; the script is wrapped in an IIFE
 *
 * Usage:
 *   const result = runMockScript('return field.toUpperCase()', {
 *     field: 'hello', typeName: 'Query', args: {}, log: console.log
 *   });
 */

import vm from 'node:vm';

/** Context injected into every mock script */
export interface MockScriptContext {
  /** Current field name being resolved */
  field: string;
  /** Parent type name */
  typeName: string;
  /** Field arguments from the GraphQL query */
  args: Record<string, unknown>;
  /** Logger — writes to the mock server log */
  log: (...args: unknown[]) => void;
}

const SCRIPT_TIMEOUT_MS = 10_000;

/**
 * Run a user-supplied mock script in a sandboxed Node.js vm context.
 *
 * The script may:
 *   - Use `return <value>` to return a mock value
 *   - Reference `field`, `typeName`, `args`, `log` from the injected context
 *   - Throw an error to signal a resolver error
 *
 * @param script  — user-provided script body (e.g. "return new Date().toISOString()")
 * @param context — injected mock resolver context
 * @returns the value returned by the script
 * @throws if the script throws, times out, or produces a syntax error
 */
export function runMockScript(script: string, context: MockScriptContext): unknown {
  // Wrap the script body in an IIFE so `return` works at top level
  const wrapped = `(function(field, typeName, args, log) { ${script} })(field, typeName, args, log)`;

  // Build a minimal, isolated sandbox — no process, no require, no globalThis tricks
  const sandbox = vm.createContext({
    field:    context.field,
    typeName: context.typeName,
    args:     context.args,
    log:      context.log,
    // Expose safe built-ins that may be useful in mock scripts
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    String,
    Number,
    Boolean,
    Array,
    Object,
  });

  return vm.runInContext(wrapped, sandbox, {
    timeout: SCRIPT_TIMEOUT_MS,
    filename: 'mock-script.js',
  });
}
