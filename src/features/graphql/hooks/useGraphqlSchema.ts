/**
 * useGraphqlSchema.ts
 *
 * React hook that manages GraphQL schema introspection:
 *   - Fires an introspection query to the user-provided endpoint
 *   - Parses the raw introspection JSON into a GraphqlSchemaInfo
 *   - Caches the result in localStorage (keyed by endpoint hash)
 *   - Classifies errors into human-readable messages
 *   - Supports optional schema polling at a configurable interval
 *   - Pauses polling while the browser tab is hidden
 *
 * HTTP transport: uses gqlFetch() — web routes through Vite /__proxy; Tauri uses
 * native rustls for custom TLS and the Node proxy for plain loopback HTTP.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphqlSchemaInfo } from '../../../shared/types/graphql';
import { gqlTlsSettingsFromPartial } from '../../../shared/types/gqlTls';
import { gqlFetch } from '../utils/gqlFetch';
import { INTROSPECTION_QUERY } from '../utils/graphqlIntrospectionQuery';
import {
  loadCachedSchemaEntry,
  saveCachedSchemaEntry,
} from '../utils/graphqlSchemaCache';
import { parseIntrospectionResult } from '../utils/schemaParser';

// ─── SDL hash (DJB2) ─────────────────────────────────────────────────────────

function hashSdl(sdl: string): number {
  let h = 5381;
  for (let i = 0; i < sdl.length; i++) {
    h = ((h << 5) + h) ^ sdl.charCodeAt(i);
  }
  return h >>> 0;
}

// ─── Error classification ────────────────────────────────────────────────────

type SchemaStatus = 'idle' | 'loading' | 'loaded' | 'error' | 'introspection-disabled';

function classifyError(
  status: number,
  body: string,
  error?: string,
): { status: SchemaStatus; message: string } {
  if (error || status === 0) {
    const detail = error?.trim();
    return {
      status: 'error',
      message: detail
        ? `Cannot reach endpoint — ${detail}`
        : 'Cannot reach endpoint — check URL and network',
    };
  }
  if (
    body.includes('No required SSL certificate was sent')
    || body.includes('SSL certificate required')
    || (status === 400 && /<(?:html|body|center)/i.test(body))
  ) {
    return {
      status: 'error',
      message:
        'Client certificate required — open TLS, paste the client cert and key (mTLS), then introspect again',
    };
  }
  if (status === 400) {
    return {
      status: 'error',
      message: 'Bad request (HTTP 400) — check TLS/mTLS settings and endpoint URL',
    };
  }
  if (status === 401) {
    return {
      status: 'error',
      message: 'Authentication required — add a Bearer token or API key in headers',
    };
  }
  if (status === 403) {
    return {
      status: 'error',
      message: 'Access denied — token valid but lacks introspection permission',
    };
  }
  if (status === 503) {
    try {
      const parsed503 = JSON.parse(body) as { error?: { code?: string; message?: string } };
      if (parsed503.error?.code === 'MOCK_NOT_ENABLED') {
        return {
          status: 'error',
          message:
            'Mock server is not enabled — turn on Mock mode in the Mock panel, then introspect again.',
        };
      }
      if (parsed503.error?.message) {
        return { status: 'error', message: parsed503.error.message };
      }
    } catch {
      /* fall through to generic 5xx message */
    }
  }
  if (status >= 500) {
    return {
      status: 'error',
      message: `Server error (HTTP ${status}) — endpoint returned an error during introspection`,
    };
  }

  // HTTP 200 but possibly a non-introspection response or introspection disabled
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return {
      status: 'error',
      message: 'Response is not valid JSON — check the endpoint URL',
    };
  }

  const p = parsed as Record<string, unknown>;

  // Introspection-disabled: HTTP 200 + errors array, data.__schema is null/missing
  if (p.errors && Array.isArray(p.errors)) {
    const schema = (p.data as Record<string, unknown> | undefined)?.__schema;
    if (!schema) {
      // Check error messages for introspection-disabled signals
      const errMsg = (p.errors as Array<{ message?: string }>)
        .map((e) => e.message ?? '')
        .join(' ')
        .toLowerCase();
      const isIntrospectionDisabled =
        errMsg.includes('introspect') ||
        errMsg.includes('disabled') ||
        errMsg.includes('not allowed') ||
        errMsg.includes('permission');
      if (isIntrospectionDisabled) {
        return {
          status: 'introspection-disabled',
          message:
            'Introspection is disabled on this server. You can still execute operations manually, but autocomplete and schema explorer will not work.',
        };
      }
      return {
        status: 'error',
        message:
          'Server returned errors during introspection — check the endpoint URL and authentication',
      };
    }
  }

  // data.__schema must be present and non-null
  const data = p.data as Record<string, unknown> | undefined;
  if (!data || !data.__schema) {
    return {
      status: 'error',
      message: 'Response is not a valid GraphQL introspection result — check the endpoint URL',
    };
  }

  return { status: 'loaded', message: '' };
}

/** 2 MB cap — skip caching rawIntrospection if it would exceed this */
const RAW_INTROSPECTION_CACHE_LIMIT = 2 * 1024 * 1024;

// ─── Hook state ──────────────────────────────────────────────────────────────

export interface GraphqlSchemaState {
  status: SchemaStatus;
  schemaInfo: GraphqlSchemaInfo | null;
  /** Raw introspection data (the `data` field from the response) — fed to monaco-graphql */
  rawIntrospection: Record<string, unknown> | null;
  errorMessage: string | null;
  /** True while an introspection request is in-flight */
  introspecting: boolean;
  /**
   * BUG-GQL-R8-9 fix: when schema polling is active and a poll refresh fails, this
   * contains the error message while the main `status` / `schemaInfo` still shows the
   * last successful schema. Consumers can surface a non-blocking warning without
   * wiping the schema explorer. Null when the last poll succeeded or polling is off.
   */
  pollErrorMessage: string | null;
}

export interface UseGraphqlSchemaOptions {
  /** Polling interval in ms (0 = disabled). Default: 0 */
  pollingIntervalMs?: number;
  /** Called whenever the schema is refreshed (polled) and the SDL hash changed */
  onSchemaChanged?: (info: GraphqlSchemaInfo) => void;
  /** Skip TLS certificate validation — for self-signed/dev endpoints */
  skipTlsVerify?: boolean;
  /** Full TLS settings (CA + mTLS). When omitted, derived from skipTlsVerify. */
  tls?: import('../../../shared/types/gqlTls').GqlTlsSettings;
}

export interface UseGraphqlSchemaResult extends GraphqlSchemaState {
  /** Manually trigger an introspection request */
  introspect: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGraphqlSchema(
  endpoint: string,
  headers: Record<string, string> = {},
  options: UseGraphqlSchemaOptions = {},
): UseGraphqlSchemaResult {
  const { pollingIntervalMs = 0, onSchemaChanged, skipTlsVerify = false, tls: tlsInput } = options;
  const tls = gqlTlsSettingsFromPartial({
    ...(tlsInput ?? {}),
    // mTLS client creds take precedence over legacy skip-cert on the same tab.
    ...(skipTlsVerify && !tlsInput?.clientCert?.trim() ? { skipTlsVerify: true } : {}),
  });

  const [state, setState] = useState<GraphqlSchemaState>(() => ({
    status: 'idle',
    schemaInfo: null,
    rawIntrospection: null,
    errorMessage: null,
    introspecting: false,
    pollErrorMessage: null,
  }));

  // Keep latest refs for use inside intervals/event listeners without stale closures
  const endpointRef = useRef(endpoint);
  const headersRef = useRef(headers);
  const onSchemaChangedRef = useRef(onSchemaChanged);
  const skipTlsVerifyRef = useRef(skipTlsVerify);
  const tlsRef = useRef(tls);
  const prevSkipTlsVerifyRef = useRef(skipTlsVerify);
  const autoIntrospectRetryKeyRef = useRef('');
  const prevMtlsReadyRef = useRef(false);
  endpointRef.current = endpoint;
  headersRef.current = headers;
  onSchemaChangedRef.current = onSchemaChanged;
  skipTlsVerifyRef.current = skipTlsVerify;
  tlsRef.current = tls;

  // BUG-GQL-R13-2 fix: track mount state so async introspection handlers don't
  // call setState after the component unmounts (prevents React warnings).
  const mountedRef = useRef(true);

  // BUG-GQL-R8-2 fix: monotonic request counter so that a slow in-flight introspection
  // for a previous endpoint cannot overwrite state or the cache for the current endpoint.
  const introspectionSeqRef = useRef(0);

  // Track SDL hash of last introspection (for polling change detection)
  const lastSdlHashRef = useRef<number>(0);

  const runIntrospection = useCallback(
    async (isPoll: boolean): Promise<void> => {
      const url = endpointRef.current;
      if (!url.trim()) return;

      // BUG-GQL-R8-2 fix: capture the sequence number at the start of this request.
      // Increment BEFORE the await so any concurrent call gets a higher number.
      introspectionSeqRef.current += 1;
      const thisSeq = introspectionSeqRef.current;

      if (!isPoll) {
        setState((s) => ({ ...s, status: 'loading', introspecting: true, errorMessage: null }));
      }

      const tlsSnapshot = tlsRef.current;
      if (/:4445\b/.test(url) && !tlsSnapshot.clientCert?.trim()) {
        if (thisSeq !== introspectionSeqRef.current || !mountedRef.current) return;
        if (!isPoll) {
          setState({
            status: 'error',
            schemaInfo: null,
            rawIntrospection: null,
            errorMessage:
              'Client certificate required — open TLS, paste the client cert and key (mTLS), then introspect again',
            introspecting: false,
            pollErrorMessage: null,
          });
        }
        return;
      }

      try {
        const resp = await gqlFetch(
          url,
          'POST',
          {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...headersRef.current,
          },
          JSON.stringify({ query: INTROSPECTION_QUERY }),
          undefined, // no AbortSignal for introspection
          tlsRef.current,
        );

        // BUG-GQL-R8-2 fix: if a newer request started while we were awaiting, discard
        // this response — it may belong to a different endpoint URL.
        // BUG-GQL-R13-2 fix: also skip if unmounted to prevent React warnings.
        if (thisSeq !== introspectionSeqRef.current || !mountedRef.current) return;

        const classification = classifyError(resp.status, resp.body, resp.error);

        if (classification.status !== 'loaded') {
          if (!isPoll) {
            setState({
              status: classification.status,
              schemaInfo: null,
              rawIntrospection: null,
              errorMessage: classification.message,
              introspecting: false,
              pollErrorMessage: null,
            });
          } else {
            // BUG-GQL-R8-9 fix: poll failed — keep existing schema/status but surface
            // a non-blocking pollErrorMessage so the UI can show a warning.
            setState((s) => ({ ...s, introspecting: false, pollErrorMessage: classification.message }));
          }
          return;
        }

        // Parse raw JSON
        let responseData: Record<string, unknown>;
        try {
          const fullResponse = JSON.parse(resp.body) as { data: Record<string, unknown> };
          responseData = fullResponse.data;
        } catch {
          if (!isPoll) {
            setState({
              status: 'error',
              schemaInfo: null,
              rawIntrospection: null,
              errorMessage: 'Failed to parse introspection response',
              introspecting: false,
              pollErrorMessage: null,
            });
          } else {
            setState((s) => ({ ...s, introspecting: false, pollErrorMessage: 'Schema refresh failed — retrying' }));
          }
          return;
        }

        // Parse schema
        let schemaInfo: GraphqlSchemaInfo;
        try {
          schemaInfo = parseIntrospectionResult(responseData);
        } catch {
          if (!isPoll) {
            setState({
              status: 'error',
              schemaInfo: null,
              rawIntrospection: null,
              errorMessage: 'Failed to parse GraphQL schema — the server may have returned an unexpected format',
              introspecting: false,
              pollErrorMessage: null,
            });
          } else {
            setState((s) => ({ ...s, introspecting: false, pollErrorMessage: 'Schema parse failed — retrying' }));
          }
          return;
        }

        const newSdlHash = hashSdl(schemaInfo.sdl);
        const changed = newSdlHash !== lastSdlHashRef.current;
        lastSdlHashRef.current = newSdlHash;

        if (isPoll && !changed) {
          // No change in SDL — skip full state update to avoid unnecessary re-renders.
          // BUG-GQL-R9-1 fix: still clear pollErrorMessage if it was set from a prior
          // failed poll — the schema is now confirmed fresh again.
          setState((s) => s.pollErrorMessage ? { ...s, pollErrorMessage: null } : s);
          return;
        }

        // BUG-GQL-R8-2 final guard: re-check before writing cache/state — another
        // request (e.g. a poll) may have started after the parse completed.
        if (thisSeq !== introspectionSeqRef.current || !mountedRef.current) return;

        // BUG-GQL-R7-2 fix: cache rawIntrospection alongside schemaInfo so Monaco
        // gets autocomplete data on next reload. Guard against > 2 MB schemas to
        // avoid blowing the localStorage quota.
        const rawJson = JSON.stringify(responseData);
        saveCachedSchemaEntry(endpointRef.current, {
          schemaInfo,
          sdlHash: newSdlHash,
          rawIntrospection: rawJson.length <= RAW_INTROSPECTION_CACHE_LIMIT ? responseData : undefined,
        });

        setState({
          status: 'loaded',
          schemaInfo,
          rawIntrospection: responseData,
          errorMessage: null,
          introspecting: false,
          // BUG-GQL-R8-9 fix: clear poll error on successful refresh
          pollErrorMessage: null,
        });

        if (isPoll && changed) {
          onSchemaChangedRef.current?.(schemaInfo);
        }
      } catch {
        if (!mountedRef.current) return;
        if (!isPoll) {
          setState({
            status: 'error',
            schemaInfo: null,
            rawIntrospection: null,
            errorMessage: 'Introspection request failed — check network and endpoint URL',
            introspecting: false,
            pollErrorMessage: null,
          });
        } else {
          setState((s) => ({ ...s, introspecting: false, pollErrorMessage: 'Schema refresh failed — will retry' }));
        }
      }
    },
    [],
  );

  const introspect = useCallback(() => {
    void runIntrospection(false);
  }, [runIntrospection]);

  // Reset state when endpoint changes (restore from IDB cache when available)
  useEffect(() => {
    introspectionSeqRef.current += 1;
    autoIntrospectRetryKeyRef.current = '';
    const loadSeq = introspectionSeqRef.current;
    lastSdlHashRef.current = 0;
    let cancelled = false;

    void (async () => {
      try {
        const cached = await loadCachedSchemaEntry(endpoint);
        if (cancelled || loadSeq !== introspectionSeqRef.current) return;
        setState({
          status: cached ? 'loaded' : 'idle',
          schemaInfo: cached?.schemaInfo ?? null,
          rawIntrospection: cached?.rawIntrospection ?? null,
          errorMessage: null,
          introspecting: false,
          pollErrorMessage: null,
        });
        if (cached) {
          lastSdlHashRef.current = cached.sdlHash;
        }
      } catch {
        // IDB cache unavailable
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  // Re-introspect when skip-cert is enabled on HTTPS after a prior failure (common on Tauri
  // when the first attempt ran before skipTlsVerify reached the transport layer).
  useEffect(() => {
    const wasSkip = prevSkipTlsVerifyRef.current;
    prevSkipTlsVerifyRef.current = skipTlsVerify;
    const url = endpoint.trim().toLowerCase();
    if (!skipTlsVerify || !url.startsWith('https://') || !url.trim()) return;

    const retryKey = `${endpoint}|skip`;
    const shouldRetryAfterEnable = !wasSkip && skipTlsVerify;
    const shouldRetryStaleError =
      skipTlsVerify && state.status === 'error' && autoIntrospectRetryKeyRef.current !== retryKey;
    if (!shouldRetryAfterEnable && !shouldRetryStaleError) return;

    autoIntrospectRetryKeyRef.current = retryKey;
    void runIntrospection(false);
  }, [skipTlsVerify, endpoint, runIntrospection, state.status]);

  // Re-introspect when mTLS client credentials arrive on the Docker mTLS port (4445).
  const mtlsReady =
    /:4445\b/.test(endpoint) && !!tls.clientCert?.trim() && !!tls.clientKey?.trim();
  useEffect(() => {
    const wasReady = prevMtlsReadyRef.current;
    prevMtlsReadyRef.current = mtlsReady;
    if (!mtlsReady || wasReady) return;
    void runIntrospection(false);
  }, [mtlsReady, endpoint, runIntrospection]);

  // Schema polling
  useEffect(() => {
    if (pollingIntervalMs <= 0 || !endpoint.trim()) return;

    const tick = () => {
      if (!document.hidden) {
        void runIntrospection(true);
      }
    };

    const intervalId = setInterval(tick, pollingIntervalMs);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Resume — fire immediately after becoming visible
        void runIntrospection(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [endpoint, pollingIntervalMs, runIntrospection]);

  // BUG-GQL-R13-2 fix: clear mounted flag on unmount so in-flight introspection
  // handlers skip setState (prevents React warnings on navigation away).
  // React 18 StrictMode remounts in dev — reset mountedRef on mount (see useGraphqlExecution).
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return { ...state, introspect };
}
