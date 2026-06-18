/**
 * useGraphqlExecution.ts
 *
 * React hook that manages the query / mutation execution lifecycle:
 *   - Sends a POST request to the GraphQL endpoint via httpFetch
 *   - Parses the response JSON into a GraphqlResponse
 *   - Supports request cancellation via AbortController (Escape / Cancel button)
 *   - Returns { status, response, execute, cancel }
 *
 * Phase 1C implementation. Phase 1D will add auth-header injection from connection
 * profiles; Phase 1E will add {{var}} interpolation in header values.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphqlError, GraphqlResponse } from '../../../shared/types/graphql';
import { gqlFetch } from '../utils/gqlFetch';

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
}

export interface UseGraphqlExecution {
  status: ExecutionStatus;
  response: GraphqlResponse | null;
  execute: (params: ExecuteParams) => void;
  cancel: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGraphqlExecution(): UseGraphqlExecution {
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [response, setResponse] = useState<GraphqlResponse | null>(null);
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

  // ── Cancel ────────────────────────────────────────────────────────────────
  // BUG-GQL-R14-5 fix: guard with mountedRef for consistency with async paths.
  // closeTab calls cancelForCloseRef.current() which invokes this — if the page
  // is unmounting simultaneously, we must not call setState.
  const cancel = useCallback(() => {
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
      const { endpoint, query, variables, operationName, headers, skipTlsVerify } = params;

      if (!endpoint.trim() || !query.trim()) return;

      // Cancel any in-flight request before starting a new one
      abortCtrlRef.current?.abort();
      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;

      // BUG-GQL-R8-3 fix: snapshot the current (completed) state so that Cancel
      // can restore it rather than showing an empty panel.
      // BUG-GQL-R11-15 fix: avoid calling setResponse inside a setStatus updater —
      // cross-hook setState inside updaters has unpredictable ordering under React
      // concurrent features. Snapshot synchronously from refs, then batch updates.
      const prevStatus = statusRef.current;
      const prevResponse = responseRef.current;
      if (prevStatus !== 'loading') {
        lastCompletedResponseRef.current = { status: prevStatus, response: prevResponse };
      }
      setResponse(null);
      setStatus('loading');

      const startTime = performance.now();

      // Build the JSON request body
      const requestBody: Record<string, unknown> = { query };
      // Parse variables — silently skip if malformed (server will return a proper error)
      try {
        const trimmed = variables.trim();
        if (trimmed && trimmed !== '{}') {
          const parsed = JSON.parse(trimmed) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            requestBody.variables = parsed;
          }
        }
      } catch {
        // Invalid JSON — omit variables (server will report the error)
      }
      if (operationName) requestBody.operationName = operationName;

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      };

      void (async () => {
        try {
          const result = await gqlFetch(
            endpoint,
            'POST',
            requestHeaders,
            JSON.stringify(requestBody),
            ctrl.signal,
            skipTlsVerify,
          );

          // Guard: ignore if this request was already superseded by a cancel()
          if (ctrl.signal.aborted) return;

          // Treat the httpFetch "Aborted" sentinel as a cancel — restore prior result
          if (result.error === 'Aborted') {
            if (!mountedRef.current) return;
            setStatus(lastCompletedResponseRef.current.status);
            setResponse(lastCompletedResponseRef.current.response);
            return;
          }

          const latencyMs = Math.round(performance.now() - startTime);

          const gqlResponse: GraphqlResponse = {
            httpStatus: result.status,
            httpHeaders: result.headers,
            latencyMs,
            timestamp: Date.now(),
          };

          // ── Parse response body ──────────────────────────────────────────
          if (result.status === 0 && result.error) {
            // Network / transport error
            gqlResponse.data = null;
            gqlResponse.errors = [{ message: result.error }];
          } else {
            try {
              const parsed = JSON.parse(result.body) as Record<string, unknown>;
              // Normalize undefined to null: some servers omit "data" entirely on
              // pure errors. Keeping undefined would cause the isSuccess check to
              // treat `undefined !== null` as true and wrongly report 'success'.
              gqlResponse.data = parsed.data ?? null;
              if (Array.isArray(parsed.errors)) {
                gqlResponse.errors = parsed.errors as GraphqlError[];
              }
              if (parsed.extensions && typeof parsed.extensions === 'object') {
                gqlResponse.extensions = parsed.extensions as Record<string, unknown>;
              }
            } catch {
              // Non-JSON body (HTML error page, plain text, etc.)
              const preview =
                result.body.length > 200 ? `${result.body.slice(0, 200)}…` : result.body;
              gqlResponse.data = null;
              gqlResponse.errors = [
                {
                  message: `Server returned a non-JSON response (HTTP ${result.status})`,
                  extensions: { rawPreview: preview },
                },
              ];
            }
          }

          const hasErrors = gqlResponse.errors && gqlResponse.errors.length > 0;
          // Partial success: data present alongside errors → 'success' with error indicators.
          // Pure error: no data (null) + errors → 'error'.
          const finalStatus: ExecutionStatus = !hasErrors || gqlResponse.data !== null ? 'success' : 'error';
          // BUG-GQL-R8-3 fix: save completed state before setting it so cancel() can restore it
          lastCompletedResponseRef.current = { status: finalStatus, response: gqlResponse };
          if (!mountedRef.current) return;
          setStatus(finalStatus);
          setResponse(gqlResponse);
          abortCtrlRef.current = null;
        } catch (err) {
          if (ctrl.signal.aborted) {
            // BUG-GQL-R8-3 fix: restore prior result instead of going blank
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
          // BUG-GQL-R8-3 fix: save error response so cancel (on a future request) can restore it
          lastCompletedResponseRef.current = { status: 'error', response: errorResponse };
          if (!mountedRef.current) return;
          setStatus('error');
          setResponse(errorResponse);
          abortCtrlRef.current = null;
        }
      })();
    },
    [],
  );

  // BUG-GQL-R9-4 fix: abort any in-flight request when the component unmounts.
  // BUG-GQL-R13-1 fix: also clear mountedRef so async handlers skip setState.
  useEffect(() => () => {
    mountedRef.current = false;
    abortCtrlRef.current?.abort();
  }, []);

  return { status, response, execute, cancel };
}
