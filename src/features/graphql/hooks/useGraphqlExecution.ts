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
import type { GraphqlResponse } from '../../../shared/types/graphql';
import { gqlRequiresTlsProxy, serializeGqlTlsForProxy, type GqlTlsSettings } from '../../../shared/types/gqlTls';
import { getProxyBase } from '../utils/graphqlProxyTransports';
import { gqlFetch, gqlUpload } from '../utils/gqlFetch';
import { normalizeGraphqlEndpoint } from '../utils/graphqlEndpointUtils';
import { hasIncrementalDirective } from '../utils/graphqlClient';
import { parseMultipartMixed } from '../utils/multipartParser';
import { executeWithAPQ } from '../utils/apqClient';
import {
  buildDedupKey,
  getInFlight,
  registerInFlight,
  removeInFlight,
  handleDedupGuard,
} from '../utils/dedupExecution';
import type { DedupChoice } from '../utils/dedupExecution';
import {
  apqInfoFromResponse,
  parseHttpBody,
  stampRequestHeaders,
  type RequestStampInput,
} from '../utils/graphqlExecutionResponseParsing';
import { notifyExecutionCompleted } from '../utils/graphqlExecutionNotify';
import { buildApqSendFn } from '../utils/graphqlExecutionApqSend';
import type {
  ApqInfo,
  ExecuteParams,
  ExecutionStatus,
  UseGraphqlExecution,
} from './useGraphqlExecutionTypes';

export type {
  ApqInfo,
  ExecuteParams,
  ExecutionStatus,
  UseGraphqlExecution,
} from './useGraphqlExecutionTypes';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGraphqlExecution(): UseGraphqlExecution {
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [response, setResponse] = useState<GraphqlResponse | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateSourceTabId, setDuplicateSourceTabId] = useState<string | null>(null);
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
  const apqInfoRef = useRef(apqInfo);
  apqInfoRef.current = apqInfo;

  // BUG-GQL-R8-3 fix: preserve the last completed response so Cancel/Escape restores
  // it rather than showing an empty "No response yet" panel.
  // Phase 6D: include apqInfo so cancel also restores the connection-bar APQ badge.
  const lastCompletedResponseRef = useRef<{
    status: ExecutionStatus;
    response: GraphqlResponse | null;
    apqInfo: ApqInfo | null;
  }>({
    status: 'idle',
    response: null,
    apqInfo: null,
  });

  const rememberCompletedSnapshot = (
    status: ExecutionStatus,
    snapshotResponse: GraphqlResponse | null,
    snapshotApqInfo?: ApqInfo | null,
  ) => {
    lastCompletedResponseRef.current = {
      status,
      response: snapshotResponse,
      apqInfo: snapshotApqInfo !== undefined ? snapshotApqInfo : apqInfoRef.current,
    };
  };

  const restoreCompletedSnapshot = () => {
    const snap = lastCompletedResponseRef.current;
    setStatus(snap.status);
    setResponse(snap.response);
    setApqInfo(snap.apqInfo);
  };

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

  const clearDuplicateState = () => {
    setIsDuplicate(false);
    setDuplicateSourceTabId(null);
  };

  /** Apply an external completed result (batch execution) without triggering history callbacks. */
  const applyResult = useCallback((nextStatus: ExecutionStatus, nextResponse: GraphqlResponse | null) => {
    if (!mountedRef.current) return;
    abortCtrlRef.current = null;
    pendingDedupRef.current = null;
    if (waitCancelRef.current) {
      waitCancelRef.current();
      waitCancelRef.current = null;
    }
    clearDuplicateState();
    rememberCompletedSnapshot(nextStatus, nextResponse, null);
    setApqInfo(null);
    setStatus(nextStatus);
    setResponse(nextResponse);
  }, []);

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
      clearDuplicateState();
      if (!mountedRef.current) return;
      restoreCompletedSnapshot();
      return;
    }
    if (waitCancelRef.current) {
      // Waiting-for-shared-promise state — cancel the wait subscription and
      // restore previous state without aborting the shared request.
      waitCancelRef.current();
      waitCancelRef.current = null;
      if (!mountedRef.current) return;
      restoreCompletedSnapshot();
      return;
    }
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
      if (!mountedRef.current) return;
      restoreCompletedSnapshot();
    }
  }, []);

  // ── Execute ───────────────────────────────────────────────────────────────
  const execute = useCallback(
    (params: ExecuteParams) => {
      const {
        endpoint: endpointRaw,
        query,
        variables,
        operationName,
        headers,
        skipTlsVerify,
        tls: tlsInput,
        formData,
        onUploadProgress,
        connectionId,
        apqEnabled,
        apqUseGet,
        dedupEnabled,
        operationType = 'query',
        _skipDedupCheck = false,
        _skipDedupCheckOnly = false,
        sourceTabId,
        authSentStamp,
        onExecutionStarted,
      } = params;

      const tls: GqlTlsSettings = tlsInput ?? (skipTlsVerify ? { skipTlsVerify: true } : {});
      const endpoint = normalizeGraphqlEndpoint(endpointRaw);
      if (!endpoint || !query.trim()) return;

      // ── 2D-6: @defer / @stream + file upload mutual exclusion ──────────────
      if (formData && hasIncrementalDirective(query)) {
        const errorResp = stampRequestHeaders({
          data: null,
          errors: [{
            message: 'Cannot combine @defer or @stream with file upload. ' +
                     'Remove the @defer/@stream directive or the file variable.',
          }],
          latencyMs: 0,
          httpStatus: 0,
          httpHeaders: {},
          timestamp: Date.now(),
        }, headers, authSentStamp);
        rememberCompletedSnapshot('error', errorResp, null);
        setStatus('error');
        setResponse(errorResp);
        notifyExecutionCompleted(params, 'error', errorResp, null);
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
          setDuplicateSourceTabId(sourceTabId ?? null);
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
        rememberCompletedSnapshot(prevStatus, prevResponse, apqInfoRef.current);
      }
      if (sourceTabId && onExecutionStarted && !_skipDedupCheck) {
        onExecutionStarted(sourceTabId);
      }
      setResponse(null);
      setStatus('loading');
      clearDuplicateState();
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

      // Upload sends `headers` as-is (multipart); JSON requests use the enriched requestHeaders map.
      const outgoingHeaders = formData ? headers : requestHeaders;
      const requestStamp: RequestStampInput | undefined = formData
        ? undefined
        : { method: 'POST', body: { ...requestBody } };
      const stampResponse = (response: GraphqlResponse): GraphqlResponse =>
        stampRequestHeaders(response, outgoingHeaders, authSentStamp, requestStamp);

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
            const result = await gqlUpload(endpoint, formData, headers, ctrl.signal, onUploadProgress, tls);

            if (ctrl.signal.aborted) { rejectExecPromise(new Error('Aborted')); return; }
            if (result.error === 'Aborted') {
              rejectExecPromise(new Error('Aborted'));
              if (!mountedRef.current) return;
              restoreCompletedSnapshot();
              return;
            }

            const latencyMs = Math.round(performance.now() - startTime);
            const gqlResponse = stampResponse(
              parseHttpBody(result.status, result.headers, result.body, latencyMs, result.error),
            );
            const hasErrors = (gqlResponse.errors?.length ?? 0) > 0;
            const finalStatus: ExecutionStatus = !hasErrors || gqlResponse.data !== null ? 'success' : 'error';
            rememberCompletedSnapshot(finalStatus, gqlResponse);
            resolveExecPromise(gqlResponse);
            notifyExecutionCompleted(params, finalStatus, gqlResponse, null);
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

            if (gqlRequiresTlsProxy(tls)) {
              fetchUrl  = `${getProxyBase()}/api/graphql/query`;
              fetchBody = JSON.stringify({
                endpoint,
                query,
                variables:     requestBody.variables,
                operationName: requestBody.operationName,
                headers,
                ...serializeGqlTlsForProxy(tls),
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
                restoreCompletedSnapshot();
                return;
              }
              const message = err instanceof Error ? err.message : 'Network error';
              const errorResp = stampResponse({
                httpStatus: 0, httpHeaders: {}, latencyMs: Math.round(performance.now() - startTime),
                timestamp: Date.now(), data: null, errors: [{ message }],
              });
              rememberCompletedSnapshot('error', errorResp, null);
              rejectExecPromise(new Error(message));
              notifyExecutionCompleted(params, 'error', errorResp, null);
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
              // Object holder — TS cannot track `let` assignments inside the parse callback.
              const lastChunk: { resp: GraphqlResponse | null } = { resp: null };
              await parseMultipartMixed(resp, (chunk) => {
                if (!mountedRef.current || ctrl.signal.aborted) return;
                chunkIdx++;
                const gqlResp: GraphqlResponse = stampResponse({
                  data: chunk.merged,
                  errors: chunk.errors,
                  extensions: chunk.extensions,
                  latencyMs: Math.round(performance.now() - startTime),
                  httpStatus: resp.status,
                  httpHeaders: respHeaders,
                  timestamp: Date.now(),
                  isStreaming: chunk.hasNext,
                  chunkCount: chunkIdx,
                });
                const isLast = !chunk.hasNext;
                const hasErrors = !!(gqlResp.errors && gqlResp.errors.length > 0);
                const finalStatus: ExecutionStatus = isLast
                  ? (!hasErrors || gqlResp.data !== null ? 'success' : 'error')
                  : 'loading';
                if (isLast) {
                  rememberCompletedSnapshot(finalStatus, gqlResp);
                  lastChunk.resp = gqlResp;
                }
                setStatus(finalStatus);
                setResponse(gqlResp);
              });

              if (chunkIdx === 0 && mountedRef.current && !ctrl.signal.aborted) {
                const emptyResp = stampResponse({
                  httpStatus: resp.status, httpHeaders: respHeaders,
                  latencyMs: Math.round(performance.now() - startTime), timestamp: Date.now(),
                  data: null, errors: [{ message: `Server returned multipart/mixed but no incremental chunks were received (HTTP ${resp.status})` }],
                });
                rememberCompletedSnapshot('error', emptyResp, null);
                rejectExecPromise(new Error('No incremental chunks'));
                notifyExecutionCompleted(params, 'error', emptyResp, null);
                setStatus('error');
                setResponse(emptyResp);
              } else {
                const finalChunk: GraphqlResponse | null = lastChunk.resp;
                if (finalChunk) {
                  resolveExecPromise(finalChunk);
                  const lastStatus: ExecutionStatus =
                    !(finalChunk.errors?.length ?? 0) || finalChunk.data !== null ? 'success' : 'error';
                  notifyExecutionCompleted(params, lastStatus, finalChunk, null);
                }
              }
              if (abortCtrlRef.current === ctrl) abortCtrlRef.current = null;
              return;
            }

            // Server didn't honor multipart — fall through to single JSON parse
            const body = await resp.text().catch(() => '');
            const latencyMs = Math.round(performance.now() - startTime);
            const gqlResponse = stampResponse(
              parseHttpBody(resp.status, respHeaders, body, latencyMs),
            );
            const hasErr2 = (gqlResponse.errors?.length ?? 0) > 0;
            const fs2: ExecutionStatus = !hasErr2 || gqlResponse.data !== null ? 'success' : 'error';
            rememberCompletedSnapshot(fs2, gqlResponse);
            resolveExecPromise(gqlResponse);
            notifyExecutionCompleted(params, fs2, gqlResponse, null);
            if (!mountedRef.current) return;
            setStatus(fs2);
            setResponse(gqlResponse);
            if (abortCtrlRef.current === ctrl) abortCtrlRef.current = null;
            return;
          }

          // ── Standard HTTP path (queries / mutations without @defer/@stream) ──

          let gqlResponse: GraphqlResponse;
          let completedApqInfo: ApqInfo | null = null;

          if (isApq) {
            const apqSendFn = buildApqSendFn({
              endpoint,
              tls,
              headers,
              requestHeaders,
              requestBody,
              startTime,
              signal: ctrl.signal,
            });

            const apqResult = await executeWithAPQ(
              apqSendFn,
              query,
              parsedVarsObj,
              operationType,
              apqUseGet ?? false,
              ctrl.signal,
            );

            gqlResponse = stampResponse({
              ...apqResult.response,
              apqHash: apqResult.hash,
              apqCacheHit: apqResult.cacheHit,
              apqUnsupported: apqResult.unsupported,
            });

            if (ctrl.signal.aborted) {
              // Reject so dedup "wait" waiters are not stuck in loading state,
              // then restore prior UI state (mirrors the other abort paths).
              rejectExecPromise(new Error('Aborted'));
              if (mountedRef.current) {
                restoreCompletedSnapshot();
              }
              return;
            }
            if (!mountedRef.current) return;
            completedApqInfo = {
              hash: apqResult.hash,
              cacheHit: apqResult.cacheHit,
              unsupported: apqResult.unsupported,
              connectionId: connectionId ?? endpoint,
            };
            setApqInfo(completedApqInfo);
          } else {
            // ── Standard POST (no APQ) ─────────────────────────────────────
            const result = await gqlFetch(
              endpoint,
              'POST',
              requestHeaders,
              JSON.stringify(requestBody),
              ctrl.signal,
              tls,
            );

            if (ctrl.signal.aborted) {
              // Reject so dedup "wait" waiters are not stuck in loading state
              rejectExecPromise(new Error('Aborted'));
              return;
            }

            if (result.error === 'Aborted') {
              rejectExecPromise(new Error('Aborted'));
              if (!mountedRef.current) return;
              restoreCompletedSnapshot();
              return;
            }

            gqlResponse = stampResponse(
              parseHttpBody(
              result.status,
              result.headers,
              result.body,
              Math.round(performance.now() - startTime),
              result.error,
            ),
            );
          }

          if (ctrl.signal.aborted) {
            // Reject so dedup "wait" waiters are not stuck in loading state
            rejectExecPromise(new Error('Aborted'));
            return;
          }

          const hasErrors = (gqlResponse.errors?.length ?? 0) > 0;
          const finalStatus: ExecutionStatus = !hasErrors || gqlResponse.data !== null ? 'success' : 'error';
          rememberCompletedSnapshot(finalStatus, gqlResponse, completedApqInfo);
          resolveExecPromise(gqlResponse);
          notifyExecutionCompleted(params, finalStatus, gqlResponse, completedApqInfo);
          if (!mountedRef.current) return;
          setStatus(finalStatus);
          setResponse(gqlResponse);
          if (abortCtrlRef.current === ctrl) abortCtrlRef.current = null;
        } catch (err) {
          if (ctrl.signal.aborted) {
            // Reject so dedup "wait" waiters are not stuck in loading state
            rejectExecPromise(new Error('Aborted'));
            if (!mountedRef.current) return;
            restoreCompletedSnapshot();
            return;
          }
          const latencyMs = Math.round(performance.now() - startTime);
          const message = err instanceof Error ? err.message : 'Unknown network error';
          const errorResponse = stampResponse({
            httpStatus: 0,
            httpHeaders: {},
            latencyMs,
            timestamp: Date.now(),
            data: null,
            errors: [{ message }],
          });
          rememberCompletedSnapshot('error', errorResponse, null);
          rejectExecPromise(err);
          notifyExecutionCompleted(params, 'error', errorResponse, null);
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
        const waitParams = pending.params;
        pendingDedupRef.current = null;
        clearDuplicateState();
        setStatus('loading');
        setApqInfo(null);
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
            const respApqInfo = apqInfoFromResponse(
              resp,
              waitParams.connectionId ?? waitParams.endpoint,
            );
            rememberCompletedSnapshot(fs, resp, respApqInfo);
            setApqInfo(respApqInfo);
            setStatus(fs);
            setResponse(resp);
            notifyExecutionCompleted(waitParams, fs, resp, respApqInfo);
          })
          .catch(() => {
            // Original was cancelled or errored — restore prior state
            waitCancelRef.current = null;
            if (!mountedRef.current || cancelled) return;
            restoreCompletedSnapshot();
          });
        return;
      }

      if (choice === 'cancel') {
        // Abort the original request; the replacement should be tracked as a new dedup entry
        handleDedupGuard(pending.key, 'cancel');
        const savedParams = pending.params;
        pendingDedupRef.current = null;
        clearDuplicateState();
        // _skipDedupCheckOnly: skip detection (no duplicate in map now that original was removed)
        // but still register the new request so future identical sends are dedup-detected.
        execute({ ...savedParams, _skipDedupCheckOnly: true });
        return;
      }
      // sendAnyway: run alongside the original — skip detection AND registration
      const savedParams = pending.params;
      pendingDedupRef.current = null;
      clearDuplicateState();
      execute({ ...savedParams, _skipDedupCheck: true });
    },
    [execute],
  );

  // BUG-GQL-R9-4 fix: abort any in-flight request when the component unmounts.
  // BUG-GQL-R13-1 fix: also clear mountedRef so async handlers skip setState.
  // React 18 StrictMode remounts in dev — reset mountedRef on mount (see useWebSocketStudio).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
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
    };
  }, []);

  return {
    status,
    response,
    execute,
    cancel,
    isDuplicate,
    duplicateSourceTabId,
    apqInfo,
    resolveDedupChoice,
    applyResult,
  };
}
