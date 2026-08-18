import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type {
  ApiMockFaultKind,
  ApiMockPathMatcherKind,
  ApiMockPredicateGroupV1,
  ApiMockResponseMode,
  ApiMockServerDefinitionV1,
  ApiMockStateTransitionV1,
} from '../../shared/api-mock/contracts';
import { DEMO_HUB_ENABLED } from '../../config/features';
import { createDefaultResponse } from '../../shared/api-mock/defaults';
import { DEFAULT_PROXY_SETTINGS } from '../../shared/api-mock/proxyContracts';
import { DEFAULT_CALLBACK_SETTINGS } from '../../shared/api-mock/callbackContracts';
import { inferPathKind } from '../../shared/api-mock/pathMatcher';
import { kindFromContentType } from './components/apiMockResponseEditorConstants';
import { nowIso } from './apiMockStudioFactory';

interface Args {
  /** Reads live servers/active tab so the bridge never closes over stale state. */
  getState: () => { servers: ApiMockServerDefinitionV1[]; activeServerId?: string };
  selectedRouteId: string | undefined;
  setServers: Dispatch<SetStateAction<ApiMockServerDefinitionV1[]>>;
}

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
  body?: string;
  contentType?: string;
  status?: number;
  reasonPhrase?: string;
  priority?: number;
  predicates?: ApiMockPredicateGroupV1;
  responseMode?: ApiMockResponseMode;
  addVariant?: boolean;
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

/**
 * Mounts `window.__demoPatchApiMockActiveRoute` so demo lessons can edit the
 * selected rule without driving the editor UI. No-op outside Learning Hub builds.
 */
export function useDemoApiMockRoutePatch({ getState, selectedRouteId, setServers }: Args): void {
  useEffect(() => {
    if (!DEMO_HUB_ENABLED) return;
    const win = window as unknown as {
      __demoPatchApiMockActiveRoute?: (patch: RoutePatch) => boolean;
      __demoPatchApiMockServerSettings?: (patch: ServerSettingsPatch) => boolean;
    };
    win.__demoPatchApiMockActiveRoute = (patch) => {
      const { servers: current, activeServerId: sid } = getState();
      const server = current.find(s => s.id === sid);
      if (!server) return false;
      const routeId = selectedRouteId && server.routes.some(r => r.id === selectedRouteId)
        ? selectedRouteId
        : server.routes[0]?.id;
      if (!routeId) return false;
      setServers(prev => prev.map(s => {
        if (s.id !== server.id) return s;
        return {
          ...s,
          updatedAt: nowIso(),
          routes: s.routes.map(r => {
            if (r.id !== routeId) return r;
            const next = { ...r, updatedAt: nowIso() };
            if (patch.path != null) {
              // A quiet path patch must leave a coherent matcher behind: without
              // re-inferring, `/users/:id` would stay an exact literal that can
              // never match. `pathKind` overrides for regex, which no string can imply.
              next.path = {
                ...r.path,
                value: patch.path,
                kind: patch.pathKind ?? inferPathKind(patch.path, r.path.kind),
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
            if (patch.addVariant && next.responses.length < 2) {
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
      setServers(prev => prev.map(s => {
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
    return () => {
      delete win.__demoPatchApiMockActiveRoute;
      delete win.__demoPatchApiMockServerSettings;
    };
  }, [selectedRouteId, getState, setServers]);
}
