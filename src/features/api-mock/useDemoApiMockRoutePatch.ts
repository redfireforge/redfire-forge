import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { flushSync } from 'react-dom';
import type {
  ApiMockFaultKind,
  ApiMockPathMatcherKind,
  ApiMockPredicateGroupV1,
  ApiMockResponseMode,
  ApiMockServerDefinitionV1,
  ApiMockSimulationSampleV1,
  ApiMockStateTransitionV1,
  ApiMockTransactionOutcome,
} from '../../shared/api-mock/contracts';
import { DEMO_HUB_ENABLED } from '../../config/features';
import { createDefaultResponse } from '../../shared/api-mock/defaults';
import { DEFAULT_PROXY_SETTINGS } from '../../shared/api-mock/proxyContracts';
import { DEFAULT_CALLBACK_SETTINGS } from '../../shared/api-mock/callbackContracts';
import { inferPathKind, pathParamNames } from '../../shared/api-mock/pathMatcher';
import { kindFromContentType } from './components/apiMockResponseEditorConstants';
import { createRoute, nowIso } from './apiMockStudioFactory';

interface Args {
  /** Reads live servers/active tab so the bridge never closes over stale state. */
  getState: () => { servers: ApiMockServerDefinitionV1[]; activeServerId?: string };
  selectedRouteId: string | undefined;
  setServers: Dispatch<SetStateAction<ApiMockServerDefinitionV1[]>>;
}

export type DemoSimulateSampleDraft = {
  name: string;
  method: string;
  path: string;
  body?: string | null;
  contentType?: string;
  expected?: {
    outcome: ApiMockTransactionOutcome;
    status?: number;
    bodyContains?: string;
  };
};

type ServerSettingsPatch = {
  multipleMatchPolicy?: ApiMockServerDefinitionV1['settings']['selection']['multipleMatchPolicy'];
  equalPriorityPolicy?: ApiMockServerDefinitionV1['settings']['selection']['equalPriorityPolicy'];
  ambiguityBody?: string;
  fallbackMode?: ApiMockServerDefinitionV1['settings']['fallback']['mode'];
  proxyEnabled?: boolean;
  proxyAllowlist?: string[];
  proxyBlockPrivate?: boolean;
  proxyForwardAuth?: boolean;
  proxyRecordDrafts?: boolean;
  corsEnabled?: boolean;
  corsOrigins?: string[];
  maxInboundBodyBytes?: number;
  maxConcurrentConnections?: number;
  gracefulDrainMs?: number;
  persistToDisk?: boolean;
  redactHeaders?: string[];
  redactJsonPaths?: string[];
  callbackAllowlist?: string[];
};

type RoutePatch = {
  path?: string;
  pathKind?: ApiMockPathMatcherKind;
  /** Select a rule by path instead of the currently selected row. */
  selectPath?: string;
  selectMethod?: string;
  body?: string;
  contentType?: string;
  status?: number;
  reasonPhrase?: string;
  priority?: number;
  predicates?: ApiMockPredicateGroupV1;
  responseMode?: ApiMockResponseMode;
  addVariant?: boolean;
  /** Append a new enabled rule (method from `method` / `selectMethod`, path from `path`). */
  addRoute?: boolean;
  /** Delete the rule resolved by `selectPath` / `selectMethod` / selection. */
  removeRoute?: boolean;
  /** Enable or disable the resolved rule (OpenAPI drafts stay off until this is set). */
  enabled?: boolean;
  method?: string;
  variantIndex?: number;
  variantName?: string;
  variantConditions?: ApiMockPredicateGroupV1;
  isDefault?: boolean;
  transition?: ApiMockStateTransitionV1;
  weight?: number;
  behavior?: {
    delayMs?: number;
    jitterMs?: number;
    maxMatches?: number | null;
    expiresAt?: string | null;
    probability?: number | null;
    fault?: ApiMockFaultKind;
    longRunningMs?: number | null;
    chunkSchedule?: Array<{ afterMs: number; body: string }> | null;
  };
};

function resolveDemoPatchRouteId(
  server: ApiMockServerDefinitionV1,
  patch: RoutePatch,
  selected: string | undefined,
): string | undefined {
  if (patch.selectPath) {
    const method = patch.selectMethod?.toUpperCase();
    const matches = server.routes.filter(r => (
      r.path.value === patch.selectPath
      && (method == null || r.method === method || r.method === 'ANY')
    ));
    return (matches.find(r => r.enabled) ?? matches[0])?.id;
  }
  if (selected && server.routes.some(r => r.id === selected)) return selected;
  return server.routes[0]?.id;
}

/**
 * Mounts `window.__demoPatchApiMockActiveRoute` so demo lessons can edit the
 * selected rule without driving the editor UI. No-op outside Learning Hub builds.
 */
export function useDemoApiMockRoutePatch({ getState, selectedRouteId, setServers }: Args): void {
  // Read selection at patch time, not from the effect closure. Demo helpers click a
  // different rule and then patch immediately — `.active` updates on commit, but the
  // effect would still close over the previous id until after paint.
  const selectedRouteIdRef = useRef(selectedRouteId);
  selectedRouteIdRef.current = selectedRouteId;

  useEffect(() => {
    if (!DEMO_HUB_ENABLED) return;
    const win = window as unknown as {
      __demoPatchApiMockActiveRoute?: (patch: RoutePatch) => boolean;
      __demoPatchApiMockServerSettings?: (patch: ServerSettingsPatch) => boolean;
      __demoClearApiMockServerSamples?: () => boolean;
      __demoUpsertApiMockServerSamples?: (drafts: DemoSimulateSampleDraft[]) => boolean;
    };
    const commitServers = (update: (prev: ApiMockServerDefinitionV1[]) => ApiMockServerDefinitionV1[]) => {
      // Defer flushSync to a microtask so it never runs from inside a React lifecycle.
      // React 19 warns ("flushSync was called from inside a lifecycle method") when
      // flushSync is called while executionContext has RenderContext | CommitContext bits set.
      // Microtasks fire before any setTimeout / next-frame work, so the commit still lands
      // before lesson ctx.click() or ctx.delay() calls reach the actual DOM operation.
      // (All lesson callers either await ctx.delay()/ctx.click() with ≥40ms, or the
      //  patch is followed by a separate awaited call — never an immediate synchronous DOM op.)
      queueMicrotask(() => { flushSync(() => { setServers(update); }); });
    };
    win.__demoPatchApiMockActiveRoute = (patch) => {
      const { servers: current, activeServerId: sid } = getState();
      const server = current.find(s => s.id === sid);
      if (!server) return false;
      const selected = selectedRouteIdRef.current;
      if (patch.addRoute) {
        commitServers(prev => prev.map(s => {
          if (s.id !== server.id) return s;
          const method = (patch.method ?? patch.selectMethod ?? 'GET').toUpperCase();
          const pathValue = patch.path ?? '/';
          const created = createRoute(patch.variantName ?? `${method} ${pathValue}`);
          created.method = method as typeof created.method;
          if (patch.enabled != null) created.enabled = patch.enabled;
          const kind = patch.pathKind ?? inferPathKind(pathValue, created.path.kind);
          created.path = {
            ...created.path,
            value: pathValue,
            kind,
            ...(kind === 'parameterized' ? { paramNames: pathParamNames(pathValue) } : {}),
          };
          if (patch.priority != null && Number.isFinite(patch.priority)) {
            created.priority = patch.priority;
          }
          return { ...s, updatedAt: nowIso(), routes: [...s.routes, created] };
        }));
        return true;
      }
      if (patch.removeRoute) {
        let removed = false;
        commitServers(prev => prev.map(s => {
          if (s.id !== server.id) return s;
          const routeId = resolveDemoPatchRouteId(s, patch, selected);
          if (!routeId) return s;
          removed = true;
          return { ...s, updatedAt: nowIso(), routes: s.routes.filter(r => r.id !== routeId) };
        }));
        return removed;
      }
      const routeId = resolveDemoPatchRouteId(server, patch, selected);
      if (!routeId) return false;
      commitServers(prev => prev.map(s => {
        if (s.id !== server.id) return s;
        return {
          ...s,
          updatedAt: nowIso(),
          routes: s.routes.map(r => {
            if (r.id !== routeId) return r;
            const next = { ...r, updatedAt: nowIso() };
            if (patch.method) {
              next.method = patch.method.toUpperCase() as typeof next.method;
            }
            if (patch.enabled != null) {
              next.enabled = patch.enabled;
            }
            if (patch.path != null) {
              // A quiet path patch must leave a coherent matcher behind: without
              // re-inferring, `/users/:id` would stay an exact literal that can
              // never match. `pathKind` overrides for regex, which no string can imply.
              const kind = patch.pathKind ?? inferPathKind(patch.path, r.path.kind);
              next.path = {
                ...r.path,
                value: patch.path,
                kind,
                ...(kind === 'parameterized' ? { paramNames: pathParamNames(patch.path) } : {}),
              };
            } else if (patch.pathKind != null) {
              next.path = {
                ...r.path,
                kind: patch.pathKind,
                ...(patch.pathKind === 'parameterized' ? { paramNames: pathParamNames(r.path.value) } : {}),
              };
            }
            if (patch.priority != null && Number.isFinite(patch.priority)) {
              next.priority = patch.priority;
            }
            // Predicate lessons author conditions live, so a replayed step has to be
            // able to put the whole Match group back the way that step starts from.
            if (patch.predicates) {
              next.predicates = structuredClone(patch.predicates);
            }
            if (patch.responseMode) {
              const mode = patch.responseMode;
              next.responseMode = mode;
              next.responses = next.responses.map(resp => (
                mode === 'weighted'
                  ? { ...resp, weight: resp.weight ?? 1 }
                  : { ...resp, weight: undefined }
              ));
            }
            if (patch.addVariant) {
              const id = `resp-demo-${next.responses.length + 1}`;
              next.responses = [
                ...next.responses,
                {
                  ...createDefaultResponse(id),
                  name: patch.variantName ?? `Variant ${next.responses.length + 1}`,
                  isDefault: false,
                  status: patch.status ?? 200,
                },
              ];
            }
            const touchVariant = patch.body != null
              || patch.contentType != null
              || patch.status != null
              || patch.reasonPhrase != null
              || patch.variantName != null
              || patch.variantConditions !== undefined
              || patch.isDefault != null
              || patch.transition !== undefined
              || patch.weight != null
              || patch.behavior != null;
            if (touchVariant) {
              const responses = [...next.responses];
              const found = responses.findIndex(resp => resp.isDefault);
              const at = patch.variantIndex != null
                ? patch.variantIndex
                : (patch.addVariant || patch.variantName != null || patch.variantConditions !== undefined
                  ? responses.length - 1
                  : (found >= 0 ? found : 0));
              const target = responses[at];
              if (!target) return next;
              const body = { ...target.body };
              if (patch.body != null) {
                body.content = patch.body;
                if (patch.contentType != null) {
                  body.contentType = patch.contentType;
                  body.kind = kindFromContentType(patch.contentType);
                } else {
                  body.kind = 'json';
                  body.contentType = 'application/json';
                }
              } else if (patch.contentType != null) {
                body.contentType = patch.contentType;
                body.kind = kindFromContentType(patch.contentType);
              }
              const updated = {
                ...target,
                body,
                ...(patch.status != null ? { status: patch.status } : {}),
                ...(patch.reasonPhrase != null ? { reasonPhrase: patch.reasonPhrase } : {}),
                ...(patch.variantName != null ? { name: patch.variantName } : {}),
                ...(patch.variantConditions !== undefined
                  ? { conditions: structuredClone(patch.variantConditions) }
                  : {}),
                ...(patch.transition !== undefined
                  ? { transition: structuredClone(patch.transition) }
                  : {}),
                ...(patch.weight != null ? { weight: patch.weight } : {}),
                ...(patch.behavior
                  ? {
                    behavior: (() => {
                      const next = { ...target.behavior };
                      if (patch.behavior.delayMs != null) next.delayMs = patch.behavior.delayMs;
                      if (patch.behavior.jitterMs != null) next.jitterMs = patch.behavior.jitterMs;
                      if (patch.behavior.maxMatches !== undefined) {
                        next.maxMatches = patch.behavior.maxMatches ?? undefined;
                      }
                      if (patch.behavior.expiresAt !== undefined) {
                        next.expiresAt = patch.behavior.expiresAt ?? undefined;
                      }
                      if (patch.behavior.probability !== undefined) {
                        next.probability = patch.behavior.probability ?? undefined;
                      }
                      if (patch.behavior.fault !== undefined) {
                        next.fault = patch.behavior.fault === 'none' ? undefined : patch.behavior.fault;
                        if (next.fault !== 'dribble') next.chunkSchedule = undefined;
                      }
                      if (patch.behavior.longRunningMs !== undefined) {
                        next.longRunningMs = patch.behavior.longRunningMs ?? undefined;
                      }
                      if (patch.behavior.chunkSchedule !== undefined) {
                        next.chunkSchedule = patch.behavior.chunkSchedule ?? undefined;
                      }
                      return next;
                    })(),
                  }
                  : {}),
              };
              if (patch.isDefault === true) {
                next.responses = responses.map((resp, i) => (
                  i === at ? { ...updated, isDefault: true } : { ...resp, isDefault: false }
                ));
              } else {
                responses[at] = {
                  ...updated,
                  ...(patch.isDefault === false ? { isDefault: false } : {}),
                };
                next.responses = responses;
              }
            }
            return next;
          }),
        };
      }));
      return true;
    };
    win.__demoPatchApiMockServerSettings = (patch) => {
      const { servers: current, activeServerId: sid } = getState();
      const server = current.find(s => s.id === sid);
      if (!server) return false;
      commitServers(prev => prev.map(s => {
        if (s.id !== server.id) return s;
        return {
          ...s,
          updatedAt: nowIso(),
          settings: {
            ...s.settings,
            selection: {
              ...s.settings.selection,
              ...(patch.multipleMatchPolicy ? { multipleMatchPolicy: patch.multipleMatchPolicy } : {}),
              ...(patch.equalPriorityPolicy ? { equalPriorityPolicy: patch.equalPriorityPolicy } : {}),
              ...(patch.ambiguityBody != null
                ? { ambiguityResponse: { ...s.settings.selection.ambiguityResponse, body: patch.ambiguityBody } }
                : {}),
            },
            ...(patch.fallbackMode
              ? { fallback: { ...s.settings.fallback, mode: patch.fallbackMode } }
              : {}),
            ...(patch.proxyEnabled != null
              || patch.proxyAllowlist
              || patch.proxyBlockPrivate != null
              || patch.proxyForwardAuth != null
              || patch.proxyRecordDrafts != null
              ? {
                proxy: {
                  ...(s.settings.proxy ?? DEFAULT_PROXY_SETTINGS),
                  ...(patch.proxyEnabled != null ? { enabled: patch.proxyEnabled } : {}),
                  ...(patch.proxyAllowlist ? { allowlist: [...patch.proxyAllowlist] } : {}),
                  ...(patch.proxyBlockPrivate != null ? { blockPrivateNetworks: patch.proxyBlockPrivate } : {}),
                  ...(patch.proxyForwardAuth != null
                    ? {
                      forwardAuth: patch.proxyForwardAuth,
                      forwardCredentialHeaders: patch.proxyForwardAuth
                        ? ['authorization', 'cookie', 'x-api-key']
                        : [],
                    }
                    : {}),
                  ...(patch.proxyRecordDrafts != null ? { recordAsDrafts: patch.proxyRecordDrafts } : {}),
                },
              }
              : {}),
            ...(patch.corsEnabled != null || patch.corsOrigins
              ? {
                cors: {
                  ...s.settings.cors,
                  ...(patch.corsEnabled != null ? { enabled: patch.corsEnabled } : {}),
                  ...(patch.corsOrigins ? { allowOrigins: [...patch.corsOrigins] } : {}),
                },
              }
              : {}),
            ...(patch.maxInboundBodyBytes != null
              || patch.maxConcurrentConnections != null
              || patch.gracefulDrainMs != null
              ? {
                limits: {
                  ...s.settings.limits,
                  ...(patch.maxInboundBodyBytes != null ? { maxInboundBodyBytes: patch.maxInboundBodyBytes } : {}),
                  ...(patch.maxConcurrentConnections != null
                    ? { maxConcurrentConnections: patch.maxConcurrentConnections }
                    : {}),
                  ...(patch.gracefulDrainMs != null ? { gracefulDrainMs: patch.gracefulDrainMs } : {}),
                },
              }
              : {}),
            ...(patch.persistToDisk != null
              ? { journal: { ...s.settings.journal, persistToDisk: patch.persistToDisk } }
              : {}),
            ...(patch.redactHeaders || patch.redactJsonPaths
              ? {
                redaction: {
                  ...s.settings.redaction,
                  ...(patch.redactHeaders ? { headerNames: [...patch.redactHeaders] } : {}),
                  ...(patch.redactJsonPaths ? { jsonPaths: [...patch.redactJsonPaths] } : {}),
                },
              }
              : {}),
            ...(patch.callbackAllowlist
              ? {
                callbacks: {
                  ...(s.settings.callbacks ?? DEFAULT_CALLBACK_SETTINGS),
                  allowlist: [...patch.callbackAllowlist],
                },
              }
              : {}),
          },
        };
      }));
      return true;
    };
    win.__demoClearApiMockServerSamples = () => {
      const { activeServerId: sid } = getState();
      if (!sid) return false;
      commitServers(prev => prev.map(s => s.id === sid ? { ...s, samples: [] } : s));
      return true;
    };
    win.__demoUpsertApiMockServerSamples = (drafts) => {
      const { activeServerId: sid } = getState();
      if (!sid || drafts.length === 0) return false;
      commitServers(prev => prev.map(s => {
        if (s.id !== sid) return s;
        const next = [...(s.samples ?? [])];
        for (const draft of drafts) {
          const idx = next.findIndex(x => x.name === draft.name);
          const request: ApiMockSimulationSampleV1['request'] = {
            method: draft.method,
            path: draft.path,
            rawPath: draft.path,
            query: {},
            headers: draft.contentType ? { 'content-type': [draft.contentType] } : {},
            cookies: {},
            body: draft.body ?? null,
            bodyTruncated: false,
            receivedAt: nowIso(),
            contentType: draft.contentType,
          };
          const sample: ApiMockSimulationSampleV1 = {
            id: idx >= 0 ? next[idx].id : `sample-${crypto.randomUUID().slice(0, 8)}`,
            name: draft.name,
            request,
            expected: draft.expected,
          };
          if (idx >= 0) next[idx] = { ...next[idx], ...sample };
          else next.push(sample);
        }
        return { ...s, samples: next, updatedAt: nowIso() };
      }));
      return true;
    };
    return () => {
      delete win.__demoPatchApiMockActiveRoute;
      delete win.__demoPatchApiMockServerSettings;
      delete win.__demoClearApiMockServerSamples;
      delete win.__demoUpsertApiMockServerSamples;
    };
  }, [getState, setServers]);
}
