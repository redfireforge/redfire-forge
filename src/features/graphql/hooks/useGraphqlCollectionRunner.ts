/**
 * useGraphqlCollectionRunner — Phase 3A (task 3A-8), Phase 3B scripts (task 3B-1 integration)
 *
 * Sequential collection runner with pause/abort support.
 * Emits CollectionRunEvent per item.
 *
 * Phase 3B script execution order per item:
 *   Collection pre-request → Item pre-request → HTTP → Item post-response → Collection post-response
 * Any pre-request script calling rf.abort() or rf.assert(false) blocks the request (item marked error).
 * Any pre-request script calling rf.skip() skips the item.
 * Post-response script failures are non-blocking (logged, item still marked result/error).
 */

import { useCallback, useRef, useState } from 'react';
import type {
  GraphqlCollection,
  GraphqlCollectionItem,
  CollectionRunEvent,
  CollectionRunTestResult,
  ScriptLogEntry,
  RfResponseContext,
} from '../../../shared/types/graphql';
import { executeGraphqlOperation } from '../utils/executeGraphqlOperation';
import { resolveGraphqlRequestOperationName } from '../utils/graphqlQueryParseUtils';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import {
  createRfContext,
  runPhaseScript,
  type PhaseScriptError,
} from '../utils/preRequestScriptRunner';

export interface RunnerState {
  running: boolean;
  paused: boolean;
  events: CollectionRunEvent[];
  currentItemId: string | null;
  aborted: boolean;
}

export interface UseGraphqlCollectionRunnerResult {
  state: RunnerState;
  run: (params: RunParams) => Promise<void>;
  pause: () => void;
  resume: () => void;
  abort: () => void;
  exportResults: () => string;
}

export interface RunParams {
  items: GraphqlCollectionItem[];
  endpoint: string;
  headers?: Record<string, string>;
  /** Phase 6 — inherit active tab TLS override when running from GraphQL Studio */
  skipTlsVerify?: boolean;
  tls?: GqlTlsSettings;
  /** The full collection object — needed for collection-level pre/post scripts */
  collection?: GraphqlCollection;
  /** Active environment variable snapshot (key → resolved value) */
  envVars?: Record<string, string>;
  /** Called when rf.setEnv() is called inside a script, to persist to React state */
  onEnvUpdate?: (key: string, value: string) => void;
  onItemComplete?: (event: CollectionRunEvent) => void;
  onItemExecuted?: (id: string) => void;
}

const INITIAL_STATE: RunnerState = {
  running: false,
  paused: false,
  events: [],
  currentItemId: null,
  aborted: false,
};

export function useGraphqlCollectionRunner(): UseGraphqlCollectionRunnerResult {
  const [state, setState] = useState<RunnerState>(INITIAL_STATE);
  const pausedRef  = useRef(false);
  const abortedRef = useRef(false);
  const resumeRef  = useRef<(() => void) | null>(null);
  // runningRef mirrors state.running synchronously so the guard in run() works
  // even inside async closures where state may be stale.
  const runningRef = useRef(false);

  const waitIfPaused = useCallback((): Promise<void> => {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => { resumeRef.current = resolve; });
  }, []);

  const run = useCallback(async ({
    items,
    endpoint,
    headers = {},
    skipTlsVerify = false,
    tls: tlsInput,
    collection,
    envVars = {},
    onEnvUpdate,
    onItemComplete,
    onItemExecuted,
  }: RunParams) => {
    const tls = tlsInput ?? (skipTlsVerify ? { skipTlsVerify: true } : {});
    // Guard against concurrent runs — calling run() while a run is in progress would
    // reset all state and corrupt the in-flight run's events. Callers should abort first.
    if (runningRef.current) return;
    runningRef.current = true;
    pausedRef.current  = false;
    abortedRef.current = false;
    setState({ running: true, paused: false, events: [], currentItemId: null, aborted: false });

    // Shared rf.store across entire run (Phase 3B spec — persistent across items)
    const runStore = new Map<string, unknown>();

    // Mutable env snapshot — shared across items so rf.setEnv changes in item 1
    // are visible to scripts in item 2 during the same run.
    const envSnapshot: Record<string, string> = { ...envVars };

    const collPre  = collection?.preRequestScript  ?? '';
    const collPost = collection?.postResponseScript ?? '';
    const collVarsBase: Record<string, string> = { ...(collection?.variables ?? {}) };

    try {
    for (const item of items) {
      if (abortedRef.current) break;
      await waitIfPaused();
      if (abortedRef.current) break;

      setState((prev) => ({ ...prev, currentItemId: item.id }));
      const startEvent: CollectionRunEvent = { type: 'start', itemId: item.id };
      setState((prev) => ({ ...prev, events: [...prev.events, startEvent] }));

      // ── Subscription guard ─────────────────────────────────────────────────
      // Subscriptions require a WebSocket/SSE transport. Running them as plain
      // HTTP POST would either hang or confusingly fail. Emit a clear error.
      if (item.operation.operationType === 'subscription') {
        const errEvent: CollectionRunEvent = {
          type: 'error',
          itemId: item.id,
          error: { phase: 'pre-script', message: 'Subscription operations cannot be executed in the Collection Runner. Use the main editor.' },
        };
        setState((prev) => ({ ...prev, events: [...prev.events, errEvent] }));
        onItemComplete?.(errEvent);
        continue;
      }

      // ── Parse variables ────────────────────────────────────────────────────
      let parsedVars: Record<string, unknown> = {};
      const rawVars = item.operation.variables ?? '';
      // Resolve {{var}} placeholders against the current envSnapshot before parsing.
      // envSnapshot is updated by rf.setEnv() so it always reflects the latest values
      // (including changes made by earlier items in this run).
      const resolvedRawVars = rawVars.replace(
        /\{\{([^}]+)\}\}/g,
        (match, key: string) => envSnapshot[key.trim()] ?? match,
      );
      if (resolvedRawVars.trim() && resolvedRawVars.trim() !== '{}') {
        try {
          parsedVars = JSON.parse(resolvedRawVars) as Record<string, unknown>;
        } catch {
          const errEvent: CollectionRunEvent = {
            type: 'error',
            itemId: item.id,
            error: { phase: 'pre-script', message: 'Variables JSON parse failure — item skipped' },
          };
          setState((prev) => ({ ...prev, events: [...prev.events, errEvent] }));
          onItemComplete?.(errEvent);
          continue;
        }
      }

      // ── Shared state for all 4 script phases for this item ─────────────────
      const mutableHeaders: Record<string, string> = { ...headers };
      // Collection-level vars snapshot — fresh per item (not shared across items)
      // to prevent item N from seeing side-effects of item N-1's setCollectionVar calls
      const collVarsSnapshot: Record<string, string> = { ...collVarsBase };
      // Item scripts use the item's configured timeout; collection scripts always use
      // the default 10s (collections have no per-script timeout field, and a short item
      // timeout should not truncate a collection-level OAuth token refresh).
      const itemTimeoutMs = item.scripts?.timeout ?? 10_000;
      const collTimeoutMs = 10_000;
      const operationMeta = {
        name: item.operation.name ?? undefined,
        // Use the stored operationType field rather than parsing the query string
        type: item.operation.operationType,
        variables: parsedVars,
      };

      const allTests: CollectionRunTestResult[] = [];
      const allLogs:  ScriptLogEntry[]          = [];
      let scriptError: PhaseScriptError | null   = null;

      const makeCtx = (resp?: RfResponseContext) =>
        createRfContext({
          envSnapshot,
          persistEnv: (k, v) => { onEnvUpdate?.(k, v); },
          collectionVarsSnapshot: collVarsSnapshot,
          mutableHeaders,
          response: resp,
          store: runStore,
          operation: operationMeta,
        });

      /**
       * Finalizes one script phase: resolve pending rf.test() callbacks, then collect
       * all captured logs (including any rf.log() calls inside test fns), then append
       * pass/fail console entries for each test result.
       * Order: script body logs → test fn body logs → pass/fail result markers.
       */
      const finalizePhase = async (ctx: ReturnType<typeof createRfContext>) => {
        const tests = await ctx.resolvePendingTests();  // runs test fns; may produce more logs
        allTests.push(...tests);
        allLogs.push(...ctx.getLogs());                 // all rf.log/warn/error calls (body + test fns)
        for (const t of tests) {
          allLogs.push({
            level: t.passed ? 'pass' : 'fail',
            message: t.passed ? `✓ ${t.name}` : `✗ ${t.name}${t.error ? ': ' + t.error : ''}`,
            timestamp: Date.now(),
          });
        }
      };

      // ── Collection pre-request script ──────────────────────────────────────
      // Collection-level scripts always run (item.scripts.enabled only gates item scripts)
      if (collPre.trim()) {
        const ctx = makeCtx();
        scriptError = await runPhaseScript(collPre, 'collection-pre', ctx.rf, collTimeoutMs);
        await finalizePhase(ctx);
      }

      // abort / skip / assertion failure / timeout all block HTTP in pre-request phases.
      // Timeout is treated as blocking because a pre-request script that times out
      // (e.g. an OAuth token refresh) must not let the request proceed without
      // the credentials it was meant to supply.
      const isPreBlocking = (e: typeof scriptError) =>
        e?.isAbort || e?.isSkip || e?.isAssertionFailure || e?.isTimeout;

      if (isPreBlocking(scriptError)) {
        const evType = scriptError!.isSkip ? 'skip' : 'error';
        const errEvent: CollectionRunEvent = {
          type: evType,
          itemId: item.id,
          tests: allTests,
          logs: allLogs,
          // Include the abort/skip/assertion/timeout reason so the UI can display it
          error: { phase: 'pre-script' as const, message: scriptError!.message },
        };
        setState((prev) => ({ ...prev, events: [...prev.events, errEvent] }));
        onItemComplete?.(errEvent);
        continue;
      }

      // Record generic runtime errors from collection pre-script but continue
      if (scriptError) {
        allLogs.push({ level: 'error', message: `[collection-pre] ${scriptError.message}`, timestamp: Date.now() });
        scriptError = null;
      }

      // ── Item pre-request script ────────────────────────────────────────────
      const itemScriptsEnabled = item.scripts?.enabled !== false;
      const itemPre = item.scripts?.preRequest;
      if (itemPre?.trim() && itemScriptsEnabled) {
        const ctx = makeCtx();
        scriptError = await runPhaseScript(itemPre, 'item-pre', ctx.rf, itemTimeoutMs);
        await finalizePhase(ctx);
      }

      if (isPreBlocking(scriptError)) {
        const evType = scriptError!.isSkip ? 'skip' : 'error';
        const errEvent: CollectionRunEvent = {
          type: evType,
          itemId: item.id,
          tests: allTests,
          logs: allLogs,
          error: { phase: 'pre-script' as const, message: scriptError!.message },
        };
        setState((prev) => ({ ...prev, events: [...prev.events, errEvent] }));
        onItemComplete?.(errEvent);
        continue;
      }

      if (scriptError) {
        allLogs.push({ level: 'error', message: `[item-pre] ${scriptError.message}`, timestamp: Date.now() });
        scriptError = null;
      }

      // ── Execute HTTP request ───────────────────────────────────────────────
      const httpStart = performance.now();
      const requestOperationName = resolveGraphqlRequestOperationName(
        item.operation.query,
        item.operation.name,
      );
      let response;
      try {
        response = await executeGraphqlOperation({
          endpoint,
          query: item.operation.query,
          variables: parsedVars,
          operationName: requestOperationName,
          headers: mutableHeaders,
          skipTlsVerify,
          tls,
        });
      } catch (e) {
        const errEvent: CollectionRunEvent = {
          type: 'error',
          itemId: item.id,
          tests: allTests,
          logs: allLogs,
          error: { phase: 'http', message: e instanceof Error ? e.message : String(e) },
        };
        setState((prev) => ({ ...prev, events: [...prev.events, errEvent] }));
        onItemComplete?.(errEvent);
        continue;
      }

      const latencyMs = Math.round(performance.now() - httpStart);

      // Build rf.response for post-response scripts
      const rfResponse: RfResponseContext = {
        httpStatus: response.httpStatus ?? 200,
        httpHeaders: response.httpHeaders ?? {},
        data: response.data,
        errors: response.errors,
        latencyMs,
      };

      // ── Item post-response script ──────────────────────────────────────────
      const itemPost = item.scripts?.postResponse;
      if (itemPost?.trim() && itemScriptsEnabled) {
        const ctx = makeCtx(rfResponse);
        const postErr = await runPhaseScript(itemPost, 'item-post', ctx.rf, itemTimeoutMs);
        await finalizePhase(ctx);
        if (postErr) {
          // Post-response failures are non-blocking — log and continue
          allLogs.push({ level: 'warn', message: `⚠ Post-script error [item-post]: ${postErr.message}`, timestamp: Date.now() });
        }
      }

      // ── Collection post-response script ────────────────────────────────────
      // Collection-level scripts always run regardless of item.scripts.enabled
      if (collPost.trim()) {
        const ctx = makeCtx(rfResponse);
        const postErr = await runPhaseScript(collPost, 'collection-post', ctx.rf, collTimeoutMs);
        await finalizePhase(ctx);
        if (postErr) {
          allLogs.push({ level: 'warn', message: `⚠ Post-script error [collection-post]: ${postErr.message}`, timestamp: Date.now() });
        }
      }

      // ── Emit result event ──────────────────────────────────────────────────
      // Treat HTTP 4xx/5xx, GraphQL errors, and failed rf.test() assertions as errors.
      const hasGqlErrors    = response.errors && response.errors.length > 0;
      const hasHttpError    = typeof response.httpStatus === 'number' && response.httpStatus >= 400;
      const failedTests     = allTests.filter((t) => !t.passed);
      const hasTestFailures = failedTests.length > 0;
      const isError = hasGqlErrors || hasHttpError || hasTestFailures;
      let errorMessage: string | undefined;
      let errorPhase: 'http' | 'post-script' = 'http';
      if (hasGqlErrors) {
        errorMessage = response.errors!.map((e) => e.message).join('; ');
        errorPhase = 'http';
      } else if (hasHttpError) {
        errorMessage = `HTTP ${response.httpStatus}`;
        errorPhase = 'http';
      } else if (hasTestFailures) {
        errorMessage = `${failedTests.length} test${failedTests.length === 1 ? '' : 's'} failed`;
        errorPhase = 'post-script';
      }
      const resultEvent: CollectionRunEvent = {
        type: isError ? 'error' : 'result',
        itemId: item.id,
        latencyMs,
        tests: allTests,
        logs: allLogs,
        ...(isError && errorMessage ? {
          error: { phase: errorPhase, message: errorMessage },
        } : {}),
      };
      setState((prev) => ({ ...prev, events: [...prev.events, resultEvent] }));
      onItemComplete?.(resultEvent);
      if (!isError) onItemExecuted?.(item.id);
    }
    } finally {
      // Always reset the running lock regardless of how the loop exits (break, throw,
      // or normal completion). Without try/finally an unexpected throw from setState,
      // onItemComplete, or a mock in tests would leave runningRef=true and silently
      // prevent any future run() call from proceeding.
      runningRef.current = false;
      setState((prev) => ({ ...prev, running: false, currentItemId: null, aborted: abortedRef.current }));
    }
  }, [waitIfPaused]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setState((prev) => ({ ...prev, paused: true }));
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setState((prev) => ({ ...prev, paused: false }));
    resumeRef.current?.();
    resumeRef.current = null;
  }, []);

  const abort = useCallback(() => {
    abortedRef.current = true;
    pausedRef.current  = false;
    resumeRef.current?.();
    resumeRef.current = null;
    setState((prev) => ({ ...prev, paused: false }));
  }, []);

  const exportResults = useCallback(() => {
    return JSON.stringify(state.events, null, 2);
  }, [state.events]);

  return { state, run, pause, resume, abort, exportResults };
}
