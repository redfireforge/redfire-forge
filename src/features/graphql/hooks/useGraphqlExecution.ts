/**
 * useGraphqlExecution.ts
 *
 * React hook that manages the query / mutation execution lifecycle:
 *   - Sends a POST request to the GraphQL endpoint via httpFetch
 *   - Parses the response JSON into a GraphqlResponse
 *   - Supports request cancellation via AbortController (Escape / Cancel button)
 *   - Sprint 7 (2D): supports incremental delivery via multipart/mixed when the
 *     query contains @defer or @stream directives; updates response in real time
 *     as chunks arrive. Blocks execution if @defer/@stream is combined with
 *     file upload (incompatible multipart formats — 2D-6).
 *   - Phase 3F (APQ): optional Automatic Persisted Queries two-step flow;
 *     in-memory hash cache avoids re-hashing the same query.
 *   - Phase 3F (Dedup): optional request deduplication — detects in-flight
 *     duplicates and offers Wait/Cancel/SendAnyway choices.
 *   - Returns { status, response, execute, cancel, isDuplicate,
 *               resolveDedupChoice, apqInfo }
 *
 * Phase 1C implementation. Phase 1D will add auth-header injection from connection
 * profiles; Phase 1E will add {{var}} interpolation in header values.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphqlError, GraphqlResponse } from '../../../shared/types/graphql';
import { gqlFetch, gqlUpload } from '../utils/gqlFetch';
import { hasIncrementalDirective } from '../utils/graphqlClient';
import { parseMultipartMixed } from '../utils/multipartParser';
import { executeWithAPQ } from '../utils/apqClient';
import type { APQSendFn } from '../utils/apqClient';
import {
  buildDedupKey,
  getInFlight,
  registerInFlight,
  removeInFlight,
  handleDedupGuard,
} from '../utils/dedupExecution';
import type { DedupChoice } from '../utils/dedupExecution';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExecutionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ExecuteParams {
  endpoint: string;
  query: string;
  /** JSON string from the Variables panel — if malformed, execution still proceeds (server will reject it) */
  variables: string;
  /** Active operation name (only needed when document has multiple named operations) */
  operationName?: string;
  /** Resolved headers (enabled tab headers merged with any connection-level headers) */
  headers: Record<string, string>;
  /** Skip TLS certificate validation — for self-signed/dev endpoints (web mode: proxied via /__proxy) */
  skipTlsVerify?: boolean;
  /**
   * When present, sends the request as multipart/form-data via the upload proxy
   * instead of a standard JSON body. Used by the Files tab (2E-1/2E-2).
   */
  formData?: FormData;
  /**
   * Sprint 8 (2E-4): optional callback for file upload progress.
   * Called with `(loaded, total)` bytes as the request is being sent.
   * Only invoked when `formData` is also provided.
   */
  onUploadProgress?: (loaded: number, total: number) => void;
  // ── Phase 3F additions ──────────────────────────────────────────────────────
  /** Connection ID — required for request deduplication key isolation */
  connectionId?: string;
  /** Enable Automatic Persisted Queries two-step flow (default: false) */
  apqEnabled?: boolean;
  /** When APQ is on: use GET for hash-only query requests (default: false) */
  apqUseGet?: boolean;
  /** Enable request deduplication (default: false) */
  dedupEnabled?: boolean;
  /** Operation type — determines GET eligibility for APQ (default: 'query') */
  operationType?: 'query' | 'mutation';
  /** When true, skip the dedup check AND dedup registration (Send anyway — run alongside original) */
  _skipDedupCheck?: boolean;
  /** When true, skip only the dedup check but still register (Cancel original — replacement tracks as new dedup entry) */
  _skipDedupCheckOnly?: boolean;
}

export interface ApqInfo {
  hash: string;
  cacheHit: boolean;
  unsupported: boolean;
}

export interface UseGraphqlExecution {
  status: ExecutionStatus;
  response: GraphqlResponse | null;
  execute: (params: ExecuteParams) => void;
  cancel: () => void;
  /** true when a dedup situation is pending user choice */
  isDuplicate: boolean;
  /** APQ metadata from the last completed APQ request */
  apqInfo: ApqInfo | null;
  /** Resolve a pending dedup situation */
  resolveDedupChoice: (choice: DedupChoice) => void;
}

// ─── Helper: parse an HttpResponse into a GraphqlResponse ────────────────────

function parseHttpBody(
  status: number,
  headers: Record<string, string>,
  body: string,
  latencyMs: number,
  error?: string,
): GraphqlResponse {
  const base: GraphqlResponse = {
    httpStatus: status,
    httpHeaders: headers,
    latencyMs,
    timestamp: Date.now(),
  };
  if (status === 0 && error) {
    base.data = null;
    base.errors = [{ message: error }];
    return base;
  }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    base.data = parsed.data ?? null;
    if (Array.isArray(parsed.errors)) base.errors = parsed.errors as GraphqlError[];
    if (parsed.extensions && typeof parsed.extensions === 'object') {
      base.extensions = parsed.extensions as Record<string, unknown>;
    }
  } catch {
    const preview = body.length > 200 ? `${body.slice(0, 200)}…` : body;
    base.data = null;
    base.errors = [{ message: `Server returned a non-JSON response (HTTP ${status})`, extensions: { rawPreview: preview } }];
  }
  return base;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGraphqlExecution(): UseGraphqlExecution {
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [response, setResponse] = useState<GraphqlResponse | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [apqInfo, setApqInfo] = useState<ApqInfo | null>(null);
  const abortCtrlRef = useRef<AbortController | null>(null);

  // BUG-GQL-R13-1 fix: track mount state so async handlers don't call setState
  // after the component unmounts (prevents React warnings and subtle leaks).
  const mountedRef = useRef(true);

  // BUG-GQL-R11-15 fix: track current values in refs for synchronous reads
  // (avoids calling setResponse inside a setStatus updater)
  const statusRef = useRef(status);
  statusRef.current = status;
  const responseRef = useRef(response);
  responseRef.current = response;

  // BUG-GQL-R8-3 fix: preserve the last completed response so Cancel/Escape restores
  // it rather than showing an empty "No response yet" panel.
  const lastCompletedResponseRef = useRef<{ status: ExecutionStatus; response: GraphqlResponse | null }>({
    status: 'idle',
    response: null,
  });

  // Phase 3F: pending dedup state
  const pendingDedupRef = useRef<{
    params: ExecuteParams;
    key: string;
    promise: Promise<GraphqlResponse>;
  } | null>(null);

  // Phase 3F: current dedup key (for cleanup on cancel)
  const currentDedupKeyRef = useRef<string | null>(null);

  // Phase 3F: cancel function for an active "wait for shared promise" subscription.
  // When the user chooses "wait", we subscribe to the shared promise and store a
  // cancel function here so that (a) pressing Cancel, or (b) firing a new execute()
  // while waiting, can cleanly discard the stale wait handler without updating state.
  const waitCancelRef = useRef<(() => void) | null>(null);

  // ── Cancel ────────────────────────────────────────────────────────────────
  // BUG-GQL-R14-5 fix: guard with mountedRef for consistency with async paths.
  // Phase 3F fix: when isDuplicate=true (either undecided or waiting for a shared promise),
  // pressing Cancel must NOT abort abortCtrlRef — that controller belongs to the original
  // shared in-flight request which may have other waiters. Instead, dismiss the dedup state
  // and restore the last completed response without touching the network.
  const cancel = useCallback(() => {
    if (pendingDedupRef.current) {
      // Undecided dedup state — dismiss without aborting the shared request
      pendingDedupRef.current = null;
      setIsDuplicate(false);
      if (!mountedRef.current) return;
      setStatus(lastCompletedResponseRef.current.status);
      setResponse(lastCompletedResponseRef.current.response);
      return;
    }
    if (waitCancelRef.current) {
      // Waiting-for-shared-promise state — cancel the wait subscription and
      // restore previous state without aborting the shared request.
      waitCancelRef.current();
      waitCancelRef.current = null;
      if (!mountedRef.current) return;
      setStatus(lastCompletedResponseRef.current.status);
      setResponse(lastCompletedResponseRef.current.response);
      return;
    }
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
      if (!mountedRef.current) return;
      setStatus(lastCompletedResponseRef.current.status);
      setResponse(lastCompletedResponseRef.current.response);
    }
  }, []);

  // ── Execute ───────────────────────────────────────────────────────────────
  const execute = useCallback(
    (params: ExecuteParams) => {
      const {
        endpoint,
        query,
        variables,
        operationName,
        headers,
        skipTlsVerify,
        formData,
        onUploadProgress,
        connectionId,
        apqEnabled,
        apqUseGet,
        dedupEnabled,
        operationType = 'query',
        _skipDedupCheck = false,
        _skipDedupCheckOnly = false,
      } = params;

      if (!endpoint.trim() || !query.trim()) return;

      // ── 2D-6: @defer / @stream + file upload mutual exclusion ──────────────
      if (formData && hasIncrementalDirective(query)) {
        const errorResp: GraphqlResponse = {
          data: null,
          errors: [{
            message: 'Cannot combine @defer or @stream with file upload. ' +
                     'Remove the @defer/@stream directive or the file variable.',
          }],
          latencyMs: 0,
          httpStatus: 0,
          httpHeaders: {},
          timestamp: Date.now(),
        };
        lastCompletedResponseRef.current = { status: 'error', response: errorResp };
        setStatus('error');
        setResponse(errorResp);
        return;
      }

      // Parse variables for dedup key calculation
      let parsedVarsObj: Record<string, unknown> = {};
      try {
        const trimmed = variables.trim();
        if (trimmed && trimmed !== '{}') {
          const parsed = JSON.parse(trimmed) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            parsedVarsObj = parsed as Record<string, unknown>;
          }
        }
      } catch { /* ignore malformed JSON — server will report it */ }

      const isIncremental = !formData && hasIncrementalDirective(query);
      const isApq = !!(apqEnabled && !formData && !isIncremental);
      const isDedupActive = !!(dedupEnabled && connectionId && !formData && !isIncremental);

      // ── Phase 3F: Dedup check ──────────────────────────────────────────────
      // _skipDedupCheck:     skip detection AND registration (send alongside original — sendAnyway)
      // _skipDedupCheckOnly: skip detection only, still register (cancel original — track replacement)
      const skipDetection = _skipDedupCheck || _skipDedupCheckOnly;
      if (isDedupActive && !skipDetection) {
        const dedupKey = buildDedupKey(connectionId!, query, parsedVarsObj, operationName);
        const existing = getInFlight(dedupKey);
        if (existing) {
          // Duplicate detected — pause and wait for user's choice
          setIsDuplicate(true);
          pendingDedupRef.current = { params, key: dedupKey, promise: existing.promise };
          return;
        }
      }

      // Cancel any in-flight request before starting a new one.
      // Clean up previous dedup registration.
      // If we were waiting for a shared promise, cancel that subscription so
      // its then/catch handlers won't overwrite this new request's state.
      // Exception: _skipDedupCheck (sendAnyway) — do NOT abort abortCtrlRef because it
      // may point to the original in-flight request that we want to keep running alongside.
      if (waitCancelRef.current) {
        waitCancelRef.current();
        waitCancelRef.current = null;
      }
      if (currentDedupKeyRef.current) {
        removeInFlight(currentDedupKeyRef.current);
        currentDedupKeyRef.current = null;
      }
      if (!_skipDedupCheck) {
        abortCtrlRef.current?.abort();
      }
      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;

      // BUG-GQL-R8-3 fix: snapshot the current (completed) state so that Cancel
      // can restore it rather than showing an empty panel.
      const prevStatus = statusRef.current;
      const prevResponse = responseRef.current;
      if (prevStatus !== 'loading') {
        lastCompletedResponseRef.current = { status: prevStatus, response: prevResponse };
      }
      setResponse(null);
      setStatus('loading');
      setIsDuplicate(false);
      setApqInfo(null); // Reset APQ badge so a non-APQ run clears the previous hit/miss indicator

      const startTime = performance.now();

      const requestBody: Record<string, unknown> = {};
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      };

      if (!formData) {
        requestBody.query = query;
        try {
          const trimmed = variables.trim();
          if (trimmed && trimmed !== '{}') {
            const parsed = JSON.parse(trimmed) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              requestBody.variables = parsed;
            }
          }
        } catch { /* silently ignore */ }
        if (operationName) requestBody.operationName = operationName;
      }

      if (isIncremental) {
        requestHeaders['Accept'] = 'application/json, multipart/mixed';
      }

      // ── Phase 3F: create dedup Promise ────────────────────────────────────
      // The promise wraps the entire execution so "Wait and merge" waiters get
      // the same result when the request settles.
      let resolveExecPromise!: (r: GraphqlResponse) => void;
      let rejectExecPromise!: (err: unknown) => void;
      const execPromise = new Promise<GraphqlResponse>((res, rej) => {
        resolveExecPromise = res;
        rejectExecPromise = rej;
      });
      // Attach a no-op catch to prevent "UnhandledPromiseRejection" when the
      // request is aborted and no dedup waiter is listening on the promise.
      void execPromise.catch(() => {});

      // When _skipDedupCheck is true (Send anyway), do NOT register this request in the
      // in-flight map — the original request is still running alongside and must not be
      // overwritten. _skipDedupCheckOnly (cancel replacement) still registers normally.
      const dedupKey = (isDedupActive && !_skipDedupCheck)
        ? buildDedupKey(connectionId!, query, parsedVarsObj, operationName)
        : null;

      if (dedupKey) {
        currentDedupKeyRef.current = dedupKey;
        registerInFlight(dedupKey, { controller: ctrl, promise: execPromise });
      }

      void (async () => {
        try {
          if (formData) {
            // ── File upload path ───────────────────────────────────────────
            const result = await gqlUpload(endpoint, formData, headers, ctrl.signal, onUploadProgress);

            if (ctrl.signal.aborted) { rejectExecPromise(new Error('Aborted')); return; }
            if (result.error === 'Aborted') {
              rejectExecPromise(new Error('Aborted'));
              if (!mountedRef.current) return;
              setStatus(lastCompletedResponseRef.current.status);
              setResponse(lastCompletedResponseRef.current.response);
              return;
            }

            const latencyMs = Math.round(performance.now() - startTime);
            const gqlResponse = parseHttpBody(result.status, result.headers, result.body, latencyMs, result.error);
            const hasErrors = (gqlResponse.errors?.length ?? 0) > 0;
            const finalStatus: ExecutionStatus = !hasErrors || gqlResponse.data !== null ? 'success' : 'error';
            lastCompletedResponseRef.current = { status: finalStatus, response: gqlResponse };
            resolveExecPromise(gqlResponse);
            if (!mountedRef.current) return;
            setStatus(finalStatus);
            setResponse(gqlResponse);
            if (abortCtrlRef.current === ctrl) abortCtrlRef.current = null;
            return;
          }

          if (isIncremental) {
            // ── Incremental delivery path (Sprint 7 — 2D) ─────────────────
            let fetchUrl: string;
            let fetchBody: string;
            let fetchHeaders: Record<string, string>;

            if (skipTlsVerify) {
              fetchUrl  = '/api/graphql/query';
              fetchBody = JSON.stringify({
                endpoint,
                query,
                variables:     requestBody.variables,
                operationName: requestBody.operationName,
                headers,
                skipTlsVerify: true,
              });
              fetchHeaders = {
                'Content-Type': 'application/json',
                'Accept': requestHeaders['Accept'] ?? 'application/json, multipart/mixed',
              };
            } else {
              fetchUrl     = endpoint;
              fetchBody    = JSON.stringify(requestBody);
              fetchHeaders = requestHeaders;
            }

            let resp: Response;
            try {
              resp = await fetch(fetchUrl, {
                method: 'POST',
                headers: fetchHeaders,
                body: fetchBody,
                signal: ctrl.signal,
              });
            } catch (err) {
              if (ctrl.signal.aborted) {
                rejectExecPromise(new Error('Aborted'));
                if (!mountedRef.current) return;
                setStatus(lastCompletedResponseRef.current.status);
                setResponse(lastCompletedResponseRef.current.response);
                return;
              }
              const message = err instanceof Error ? err.message : 'Network error';
              const errorResp: GraphqlResponse = {
                httpStatus: 0, httpHeaders: {}, latencyMs: Math.round(performance.now() - startTime),
                timestamp: Date.now(), data: null, errors: [{ message }],
              };
              lastCompletedResponseRef.current = { status: 'error', response: errorResp };
              rejectExecPromise(new Error(message));
              if (!mountedRef.current) return;
              setStatus('error');
              setResponse(errorResp);
              if (abortCtrlRef.current === ctrl) abortCtrlRef.current = null;
              return;
            }

            const respHeaders: Record<string, string> = {};
            resp.headers.forEach((v, k) => { respHeaders[k] = v; });
            const contentType = resp.headers.get('content-type') ?? '';

            if (contentType.includes('multipart/mixed')) {
              let chunkIdx = 0;
              let lastChunkResp: GraphqlResponse | null = null;
              await parseMultipartMixed(resp, (chunk) => {
                if (!mountedRef.current || ctrl.signal.aborted) return;
                chunkIdx++;
                const gqlResp: GraphqlResponse = {
                  data: chunk.merged,
                  errors: chunk.errors,
                  extensions: chunk.extensions,
                  latencyMs: Math.round(performance.now() - startTime),
                  httpStatus: resp.status,
                  httpHeaders: respHeaders,
                  timestamp: Date.now(),
                  isStreaming: chunk.hasNext,
                  chunkCount: chunkIdx,
                };
                const isLast = !chunk.hasNext;
                const hasErrors = !!(gqlResp.errors && gqlResp.errors.length > 0);
                const finalStatus: ExecutionStatus = isLast
                  ? (!hasErrors || gqlResp.data !== null ? 'success' : 'error')
                  : 'loading';
                if (isLast) {
                  lastCompletedResponseRef.current = { status: finalStatus, response: gqlResp };
                  lastChunkResp = gqlResp;
                }
                setStatus(finalStatus);
                setResponse(gqlResp);
              });

              if (chunkIdx === 0 && mountedRef.current && !ctrl.signal.aborted) {
                const emptyResp: GraphqlResponse = {
                  httpStatus: resp.status, httpHeaders: respHeaders,
                  latencyMs: Math.round(performance.now() - startTime), timestamp: Date.now(),
                  data: null, errors: [{ message: `Server returned multipart/mixed but no incremental chunks were received (HTTP ${resp.status})` }],
                };
                lastCompletedResponseRef.current = { status: 'error', response: emptyResp };
                rejectExecPromise(new Error('No incremental chunks'));
                setStatus('error');
                setResponse(emptyResp);
              } else if (lastChunkResp) {
                resolveExecPromise(lastChunkResp);
              }
              if (abortCtrlRef.current === ctrl) abortCtrlRef.current = null;
              return;
            }

            // Server didn't honor multipart — fall through to single JSON parse
            const body = await resp.text().catch(() => '');
            const latencyMs = Math.round(performance.now() - startTime);
            const gqlResponse = parseHttpBody(resp.status, respHeaders, body, latencyMs);
            const hasErr2 = (gqlResponse.errors?.length ?? 0) > 0;
            const fs2: ExecutionStatus = !hasErr2 || gqlResponse.data !== null ? 'success' : 'error';
            lastCompletedResponseRef.current = { status: fs2, response: gqlResponse };
            resolveExecPromise(gqlResponse);
            if (!mountedRef.current) return;
            setStatus(fs2);
            setResponse(gqlResponse);
            if (abortCtrlRef.current === ctrl) abortCtrlRef.current = null;
            return;
          }

          // ── Standard HTTP path (queries / mutations without @defer/@stream) ──

          let gqlResponse: GraphqlResponse;

          if (isApq) {
            // ── APQ two-step flow ──────────────────────────────────────────
            // Build a sendFn that handles both GET (hash-only) and POST (full)
            const apqSendFn: APQSendFn = async (bodyFields, method) => {
              if (method === 'GET') {
                const getHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
                delete getHeaders['Content-Type'];

                if (skipTlsVerify) {
                  // TLS skip requires routing through Node.js proxy (browser can't bypass TLS)
                  const proxyParams = new URLSearchParams();
                  proxyParams.set('endpoint', endpoint);
                  for (const [k, v] of Object.entries(bodyFields)) {
                    proxyParams.set(k, JSON.stringify(v));
                  }
                  // Forward operationName for multi-operation documents
                  if (requestBody.operationName != null) {
                    proxyParams.set('operationName', String(requestBody.operationName));
                  }
                  proxyParams.set('skipTlsVerify', 'true');
                  const result = await gqlFetch(
                    `/api/graphql/query?${proxyParams.toString()}`,
                    'GET',
                    getHeaders,
                    undefined,
                    ctrl.signal,
                    false, // TLS is handled server-side by the proxy
                  );
                  return parseHttpBody(result.status, result.headers, result.body, Math.round(performance.now() - startTime), result.error);
                }

                // No TLS skip: make the APQ GET directly to the upstream endpoint.
                // This works in all environments (web, Tauri, production) since it's
                // a standard browser GET request — no proxy needed.
                let apqUrl: URL;
                try {
                  apqUrl = new URL(endpoint);
                } catch {
                  // Fallback if endpoint is not a valid absolute URL
                  apqUrl = new URL(endpoint, window.location.href);
                }
                for (const [k, v] of Object.entries(bodyFields)) {
                  apqUrl.searchParams.set(k, JSON.stringify(v));
                }
                // Forward operationName so multi-operation documents work with APQ GET
                if (requestBody.operationName != null) {
                  apqUrl.searchParams.set('operationName', String(requestBody.operationName));
                }
                const result = await gqlFetch(
                  apqUrl.toString(),
                  'GET',
                  getHeaders,
                  undefined,
                  ctrl.signal,
                  false,
                );
                return parseHttpBody(result.status, result.headers, result.body, Math.round(performance.now() - startTime), result.error);
              } else {
                // Standard POST — build the body carefully.
                // When bodyFields has no `query` (hash-only APQ step), we must NOT
                // inject requestBody.query — sending the full query in the hash-only
                // step defeats APQ's bandwidth savings and can confuse strict servers.
                // Only operationName is carried across from requestBody.
                const isHashOnly = !('query' in bodyFields);
                const fullBody: Record<string, unknown> = isHashOnly
                  ? { ...bodyFields, ...(requestBody.operationName !== undefined ? { operationName: requestBody.operationName } : {}) }
                  : { ...requestBody, ...bodyFields };
                const result = await gqlFetch(
                  endpoint,
                  'POST',
                  requestHeaders,
                  JSON.stringify(fullBody),
                  ctrl.signal,
                  skipTlsVerify,
                );
                return parseHttpBody(result.status, result.headers, result.body, Math.round(performance.now() - startTime), result.error);
              }
            };

            const apqResult = await executeWithAPQ(
              apqSendFn,
              query,
              parsedVarsObj,
              operationType,
              apqUseGet ?? false,
              ctrl.signal,
            );

            gqlResponse = {
              ...apqResult.response,
              apqHash: apqResult.hash,
              apqCacheHit: apqResult.cacheHit,
              apqUnsupported: apqResult.unsupported,
            };

            if (ctrl.signal.aborted) {
              // Reject so dedup "wait" waiters are not stuck in loading state,
              // then restore prior UI state (mirrors the other abort paths).
              rejectExecPromise(new Error('Aborted'));
              if (mountedRef.current) {
                setStatus(lastCompletedResponseRef.current.status);
                setResponse(lastCompletedResponseRef.current.response);
              }
              return;
            }
            if (!mountedRef.current) return;
            setApqInfo({ hash: apqResult.hash, cacheHit: apqResult.cacheHit, unsupported: apqResult.unsupported });
          } else {
            // ── Standard POST (no APQ) ─────────────────────────────────────
            const result = await gqlFetch(
              endpoint,
              'POST',
              requestHeaders,
              JSON.stringify(requestBody),
              ctrl.signal,
              skipTlsVerify,
            );

            if (ctrl.signal.aborted) {
              // Reject so dedup "wait" waiters are not stuck in loading state
              rejectExecPromise(new Error('Aborted'));
              return;
            }

            if (result.error === 'Aborted') {
              rejectExecPromise(new Error('Aborted'));
              if (!mountedRef.current) return;
              setStatus(lastCompletedResponseRef.current.status);
              setResponse(lastCompletedResponseRef.current.response);
              return;
            }

            gqlResponse = parseHttpBody(
              result.status,
              result.headers,
              result.body,
              Math.round(performance.now() - startTime),
              result.error,
            );
          }

          if (ctrl.signal.aborted) {
            // Reject so dedup "wait" waiters are not stuck in loading state
            rejectExecPromise(new Error('Aborted'));
            return;
          }

          const hasErrors = (gqlResponse.errors?.length ?? 0) > 0;
          const finalStatus: ExecutionStatus = !hasErrors || gqlResponse.data !== null ? 'success' : 'error';
          lastCompletedResponseRef.current = { status: finalStatus, response: gqlResponse };
          resolveExecPromise(gqlResponse);
          if (!mountedRef.current) return;
          setStatus(finalStatus);
          setResponse(gqlResponse);
          if (abortCtrlRef.current === ctrl) abortCtrlRef.current = null;
        } catch (err) {
          if (ctrl.signal.aborted) {
            // Reject so dedup "wait" waiters are not stuck in loading state
            rejectExecPromise(new Error('Aborted'));
            if (!mountedRef.current) return;
            setStatus(lastCompletedResponseRef.current.status);
            setResponse(lastCompletedResponseRef.current.response);
            return;
          }
          const latencyMs = Math.round(performance.now() - startTime);
          const message = err instanceof Error ? err.message : 'Unknown network error';
          const errorResponse: GraphqlResponse = {
            httpStatus: 0,
            httpHeaders: {},
            latencyMs,
            timestamp: Date.now(),
            data: null,
            errors: [{ message }],
          };
          lastCompletedResponseRef.current = { status: 'error', response: errorResponse };
          rejectExecPromise(err);
          if (!mountedRef.current) return;
          setStatus('error');
          setResponse(errorResponse);
          if (abortCtrlRef.current === ctrl) abortCtrlRef.current = null;
        } finally {
          // Only remove the dedup map entry if it is still OUR own promise.
          // After a 'cancel original' user choice, the replacement request re-registers
          // under the same key BEFORE this finally block runs. Without this guard the
          // original's finally would delete the replacement's registration, causing the
          // next identical send to bypass dedup detection while the replacement is in-flight.
          if (dedupKey) {
            const currentEntry = getInFlight(dedupKey);
            const stillOurs = !currentEntry || currentEntry.promise === execPromise;
            if (stillOurs) {
              removeInFlight(dedupKey);
              if (currentDedupKeyRef.current === dedupKey) {
                currentDedupKeyRef.current = null;
              }
            }
          }
        }
      })();
    },
    [],
  );

  // ── resolveDedupChoice ────────────────────────────────────────────────────
  // Called when the user makes a choice in the duplicate-in-flight badge dropdown.
  const resolveDedupChoice = useCallback(
    (choice: DedupChoice) => {
      const pending = pendingDedupRef.current;
      if (!pending) return;

      if (choice === 'wait') {
        // Subscribe to the shared promise — zero extra network calls.
        // AbortController isolation: aborting this "waiter" does NOT abort
        // the shared underlying request (other waiters remain unaffected).
        pendingDedupRef.current = null;
        setIsDuplicate(false);
        setStatus('loading');
        // Detach abortCtrlRef so the user pressing Cancel/Escape does not abort
        // the shared in-flight request.
        abortCtrlRef.current = null;

        // Generation token: cancelled = true means the user pressed Cancel or
        // fired a new execute() before the shared promise resolved. Any state
        // updates from this wait handler are ignored once cancelled.
        let cancelled = false;
        waitCancelRef.current = () => { cancelled = true; };

        void pending.promise
          .then((resp) => {
            waitCancelRef.current = null;
            if (!mountedRef.current || cancelled) return;
            const hasErrors = (resp.errors?.length ?? 0) > 0;
            const fs: ExecutionStatus = !hasErrors || resp.data !== null ? 'success' : 'error';
            lastCompletedResponseRef.current = { status: fs, response: resp };
            setStatus(fs);
            setResponse(resp);
          })
          .catch(() => {
            // Original was cancelled or errored — restore prior state
            waitCancelRef.current = null;
            if (!mountedRef.current || cancelled) return;
            setStatus(lastCompletedResponseRef.current.status);
            setResponse(lastCompletedResponseRef.current.response);
          });
        return;
      }

      if (choice === 'cancel') {
        // Abort the original request; the replacement should be tracked as a new dedup entry
        handleDedupGuard(pending.key, 'cancel');
        const savedParams = pending.params;
        pendingDedupRef.current = null;
        setIsDuplicate(false);
        // _skipDedupCheckOnly: skip detection (no duplicate in map now that original was removed)
        // but still register the new request so future identical sends are dedup-detected.
        execute({ ...savedParams, _skipDedupCheckOnly: true });
        return;
      }
      // sendAnyway: run alongside the original — skip detection AND registration
      const savedParams = pending.params;
      pendingDedupRef.current = null;
      setIsDuplicate(false);
      execute({ ...savedParams, _skipDedupCheck: true });
    },
    [execute],
  );

  // BUG-GQL-R9-4 fix: abort any in-flight request when the component unmounts.
  // BUG-GQL-R13-1 fix: also clear mountedRef so async handlers skip setState.
  useEffect(() => () => {
    mountedRef.current = false;
    abortCtrlRef.current?.abort();
    // Cancel any active wait-for-shared-promise subscription
    if (waitCancelRef.current) {
      waitCancelRef.current();
      waitCancelRef.current = null;
    }
    // Clean up dedup registration on unmount
    if (currentDedupKeyRef.current) {
      removeInFlight(currentDedupKeyRef.current);
      currentDedupKeyRef.current = null;
    }
  }, []);

  return { status, response, execute, cancel, isDuplicate, apqInfo, resolveDedupChoice };
}
