/** React hook that manages the GraphQL execution lifecycle. */

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

  const mountedRef = useRef(true);

  const statusRef = useRef(status);
  statusRef.current = status;
  const responseRef = useRef(response);
  responseRef.current = response;
  const apqInfoRef = useRef(apqInfo);
  apqInfoRef.current = apqInfo;

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

  const pendingDedupRef = useRef<{
    params: ExecuteParams;
    key: string;
    promise: Promise<GraphqlResponse>;
  } | null>(null);

  const currentDedupKeyRef = useRef<string | null>(null);

  const waitCancelRef = useRef<(() => void) | null>(null);

  const clearDuplicateState = () => {
    setIsDuplicate(false);
    setDuplicateSourceTabId(null);
  };

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

      let resolveExecPromise!: (r: GraphqlResponse) => void;
      let rejectExecPromise!: (err: unknown) => void;
      const execPromise = new Promise<GraphqlResponse>((res, rej) => {
        resolveExecPromise = res;
        rejectExecPromise = rej;
      });
      void execPromise.catch(() => {});

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
            const result = await gqlFetch(
              endpoint,
              'POST',
              requestHeaders,
              JSON.stringify(requestBody),
              ctrl.signal,
              tls,
            );

            if (ctrl.signal.aborted) {
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

  const resolveDedupChoice = useCallback(
    (choice: DedupChoice) => {
      const pending = pendingDedupRef.current;
      if (!pending) return;

      if (choice === 'wait') {
        const waitParams = pending.params;
        pendingDedupRef.current = null;
        clearDuplicateState();
        setStatus('loading');
        setApqInfo(null);
        abortCtrlRef.current = null;

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
            waitCancelRef.current = null;
            if (!mountedRef.current || cancelled) return;
            restoreCompletedSnapshot();
          });
        return;
      }

      if (choice === 'cancel') {
        handleDedupGuard(pending.key, 'cancel');
        const savedParams = pending.params;
        pendingDedupRef.current = null;
        clearDuplicateState();
        execute({ ...savedParams, _skipDedupCheckOnly: true });
        return;
      }
      const savedParams = pending.params;
      pendingDedupRef.current = null;
      clearDuplicateState();
      execute({ ...savedParams, _skipDedupCheck: true });
    },
    [execute],
  );

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
