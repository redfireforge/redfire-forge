/**
 * preRequestScriptRunner — Phase 3B (task 3B-1)
 *
 * Sandbox script executor for pre-request and post-response scripts.
 * Uses `new Function` with scope shadowing to prevent access to browser globals.
 *
 * Dangerous globals shadowed in "use strict" mode:
 *   window, document, globalThis, process, require, Function, constructor
 * Note: `eval` is NOT shadowed — `const eval = undefined` is a SyntaxError in
 * strict mode. eval() in strict mode has its own scope and cannot leak declarations.
 * This blocks the prototype-chain escape pattern:
 *   constructor.constructor('return process')()
 *
 * Accepted trade-off: Object.getPrototypeOf({}).constructor is still reachable
 * because shadowing Object would break destructuring/spread. Same vector exists
 * in Postman, Altair, and Insomnia. All rf.* objects are plain values — no class
 * instance references — so prototype pollution is contained to the sandbox scope.
 *
 * Default timeout: 10s (increased from original 5s to handle real OAuth flows).
 */

import type { RfContext, RfResponseContext, CollectionRunTestResult, ScriptLogEntry } from '../../../shared/types/graphql';
import { ScriptAbortError, ScriptSkipError, GraphqlAssertionError } from '../../../shared/types/graphql';

// Re-export types that callers need without re-importing from types
export type { ScriptLogEntry };

/**
 * No-op Map stub for rf.store outside the Collection Runner context.
 * get() always returns undefined; set(), delete(), clear() are silent no-ops.
 * This ensures scripts that use rf.store for cross-item communication do not
 * confuse developers with transient state when dry-run individually.
 */
export class NoOpStore extends Map<string, unknown> {
  override get(_key: string): undefined { return undefined; }
  override set(_key: string, _value: unknown): this { return this; }
  override delete(_key: string): boolean { return false; }
  override clear(): void { /* intentional no-op */ }
  override has(_key: string): boolean { return false; }
  override get size(): number { return 0; }
}
export const NO_OP_STORE = new NoOpStore();

export interface CreateRfContextParams {
  /**
   * Mutable env snapshot — getEnv reads from it; setEnv writes to it AND calls
   * persistEnv() for durable persistence. Shared across all scripts for one item
   * execution so changes from script 1 are visible in script 2.
   */
  envSnapshot: Record<string, string>;
  /** Persist env changes to React state / IDB storage */
  persistEnv: (key: string, value: string) => void;
  /**
   * Mutable collection-vars snapshot — shared across all scripts for one item.
   * These are NOT merged into the global env and NOT visible to getEnv().
   * Only accessible via getCollectionVar / setCollectionVar.
   */
  collectionVarsSnapshot: Record<string, string>;
  /**
   * Mutable headers map for the current HTTP request — shared across all pre-request
   * scripts for one item so collection.pre can set a header and item.pre can refine it.
   */
  mutableHeaders: Record<string, string>;
  /** Populated only in post-response scripts; undefined in pre-request scripts */
  response?: RfResponseContext;
  /**
   * Shared key-value store for the entire collection runner run.
   * Pass the runner's live Map from useGraphqlCollectionRunner for collection runs.
   * Pass NO_OP_STORE for standalone (non-runner) executions — get() always returns
   * undefined and set()/delete()/clear() are silent no-ops, preventing scripts
   * written for runner use from appearing to work when dry-run individually.
   */
  store: Map<string, unknown>;
  /** Read-only metadata about the current GraphQL operation */
  operation: {
    name: string | undefined;
    type: 'query' | 'mutation' | 'subscription';
    variables: Record<string, unknown>;
  };
}

export interface CreateRfContextResult {
  rf: RfContext;
  /**
   * Must be called AFTER runScript() completes (whether via success or error).
   * Awaits all pending rf.test() callbacks via Promise.allSettled and returns
   * pass/fail results. Safe to call even if runScript() threw.
   */
  resolvePendingTests: () => Promise<CollectionRunTestResult[]>;
  /** Returns a snapshot of all captured log entries (rf.log/warn/error calls) */
  getLogs: () => ScriptLogEntry[];
}

/**
 * Creates a fresh RfContext for one script execution.
 * Call resolvePendingTests() after runScript() to collect rf.test() results.
 */
export function createRfContext(params: CreateRfContextParams): CreateRfContextResult {
  const {
    envSnapshot,
    persistEnv,
    collectionVarsSnapshot,
    mutableHeaders,
    response,
    store,
    operation,
  } = params;

  const _pendingTests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
  const _logs: ScriptLogEntry[] = [];

  const capture = (level: 'log' | 'warn' | 'error', args: unknown[]): void => {
    const message = args
      .map((a) => {
        if (a === null) return 'null';
        if (a === undefined) return 'undefined';
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch { return String(a); }
        }
        return String(a);
      })
      .join(' ');
    _logs.push({ level, message, timestamp: Date.now() });
  };

  const rf: RfContext = {
    getEnv: (key) => envSnapshot[key],
    setEnv: (key, value) => {
      envSnapshot[key] = value;
      persistEnv(key, value);
    },
    getCollectionVar: (key) => collectionVarsSnapshot[key],
    setCollectionVar: (key, value) => { collectionVarsSnapshot[key] = value; },
    setHeader: (name, value) => { mutableHeaders[name] = value; },
    removeHeader: (name) => { delete mutableHeaders[name]; },
    abort: (message?) => { throw new ScriptAbortError(message); },
    skip: (message?) => { throw new ScriptSkipError(message); },
    assert: (condition, message?) => {
      if (!condition) throw new GraphqlAssertionError(message);
    },
    test: (name, fn) => { _pendingTests.push({ name, fn }); },
    response,
    store,
    operation,
    log: (...args) => capture('log', args),
    warn: (...args) => capture('warn', args),
    error: (...args) => capture('error', args),
    // rf.fetch routes through the browser's native fetch (same-origin proxy in web mode,
    // or the Tauri HTTP plugin's fetch shim in desktop mode). Direct network access is
    // acceptable here: the sandbox already prevents script-level globals access; the
    // proxy handles CORS for same-origin dev-server use cases naturally.
    fetch: (url, init?) => fetch(url, init),
  };

  async function resolvePendingTests(): Promise<CollectionRunTestResult[]> {
    if (_pendingTests.length === 0) return [];
    // Wrap each fn() in an async function so synchronous throws become rejected
    // promises — Promise.allSettled only handles rejected promises, not sync throws.
    const results = await Promise.allSettled(_pendingTests.map(async (t) => t.fn()));
    return results.map((r, i) => {
      let errMsg: string | undefined;
      if (r.status === 'rejected') {
        const reason = (r as PromiseRejectedResult).reason;
        errMsg = reason instanceof Error ? reason.message : String(reason);
      }
      return { name: _pendingTests[i].name, passed: r.status === 'fulfilled', error: errMsg };
    });
  }

  return { rf, resolvePendingTests, getLogs: () => [..._logs] };
}

/**
 * Runs JavaScript source in a sandboxed async function.
 *
 * - Source becomes the FUNCTION BODY of an AsyncFunction (not string-interpolated
 *   into a wrapper template). This prevents the "}); malicious()//" injection attack
 *   that would escape string interpolation: a lone "}" without a matching "{" inside
 *   the function body is a SyntaxError, so the constructor throws before execution.
 * - Dangerous globals are shadowed via `const` declarations at the top of the body.
 * - Default timeout is 10 000ms; configurable via timeoutMs param.
 * - ScriptAbortError and ScriptSkipError propagate as-is so callers can
 *   distinguish abort/skip signals from generic runtime errors.
 * - Timeout fires as a generic Error('Script timeout after Nms').
 * - Pending rf.test() fns are NOT resolved here — the caller must call
 *   createRfContextResult.resolvePendingTests() after this function returns.
 *
 * NOTE: `eval` is intentionally NOT shadowed because `const eval = undefined`
 * is a SyntaxError in strict mode (eval is a reserved identifier). eval() in
 * strict mode has its own scope and cannot leak declarations to the outer scope.
 */
export async function runScript(
  source: string,
  rf: RfContext,
  timeoutMs = 10_000,
): Promise<void> {
  // Get the AsyncFunction constructor. Compared to `new Function('return async ...')()`,
  // using the constructor directly makes `source` the function BODY — not content
  // interpolated inside a string template — which prevents the "}); escape" injection.
  const AsyncFunction = (async function () {}).constructor as new (...args: string[]) => (rf: RfContext) => Promise<void>;

  const body =
    '"use strict";\n' +
    'const window = undefined, document = undefined, globalThis = undefined,\n' +
    '      process = undefined, require = undefined,\n' +
    '      Function = undefined, constructor = undefined;\n' +
    source;

  let fn: (rf: RfContext) => Promise<void>;
  try {
    fn = new AsyncFunction('rf', body);
  } catch (parseErr) {
    // Surface parse errors (including injection SyntaxErrors) as plain Errors.
    throw parseErr instanceof Error ? parseErr : new Error(String(parseErr));
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, rej) => {
    timeoutHandle = setTimeout(
      () => rej(new Error(`Script timeout after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    await Promise.race([fn(rf), timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ─── Internal execution phases ─────────────────────────────────────────────────

export type ScriptPhase = 'collection-pre' | 'item-pre' | 'item-post' | 'collection-post';

export interface PhaseScriptError {
  phase: ScriptPhase;
  isAbort: boolean;
  isSkip: boolean;
  /**
   * True when rf.assert(false, ...) throws GraphqlAssertionError.
   * Pre-request assertion failures are treated as blocking (same as rf.abort) since
   * the user explicitly called rf.assert() to gate the request.
   */
  isAssertionFailure: boolean;
  /**
   * True when the script exceeded its configured timeout.
   * For pre-request phases, a timeout is treated as blocking: if a pre-request
   * script (e.g. an OAuth token refresh) times out, the request should not be
   * sent with incomplete / missing credentials.
   */
  isTimeout: boolean;
  message: string;
}

/**
 * Runs a single script phase safely.
 * Returns null on success; returns a PhaseScriptError on abort / skip / assertion failure /
 * timeout / runtime error.
 *
 * Classification:
 *   - ScriptAbortError  → isAbort: true  (explicit rf.abort() call)
 *   - ScriptSkipError   → isSkip: true   (explicit rf.skip() call in runner)
 *   - GraphqlAssertionError → isAssertionFailure: true (explicit rf.assert(false) call)
 *   - Everything else   → generic runtime error, non-blocking in post-response
 */
export async function runPhaseScript(
  source: string | undefined,
  phase: ScriptPhase,
  rf: RfContext,
  timeoutMs: number,
): Promise<PhaseScriptError | null> {
  if (!source || !source.trim()) return null;
  try {
    await runScript(source, rf, timeoutMs);
    return null;
  } catch (err) {
    if (err instanceof ScriptAbortError) {
      return { phase, isAbort: true, isSkip: false, isAssertionFailure: false, isTimeout: false, message: err.message };
    }
    if (err instanceof ScriptSkipError) {
      return { phase, isAbort: false, isSkip: true, isAssertionFailure: false, isTimeout: false, message: err.message };
    }
    if (err instanceof GraphqlAssertionError) {
      return { phase, isAbort: false, isSkip: false, isAssertionFailure: true, isTimeout: false, message: err.message };
    }
    // Detect the timeout sentinel message produced by runScript's Promise.race.
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.startsWith('Script timeout after');
    return {
      phase,
      isAbort: false,
      isSkip: false,
      isAssertionFailure: false,
      isTimeout,
      message: msg,
    };
  }
}
