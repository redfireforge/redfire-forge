import type { Microservice, ProtocolKey } from '../types';
import { deriveGrpcPortEnvValue } from '../grpc/grpcCanonicalEnvValidation';

/** Convert an HTTP base URL to a WebSocket URL (https→wss, http→ws). */
export function httpToWsUrl(baseUrl: string): string {
  if (baseUrl.startsWith('https://')) return 'wss://' + baseUrl.slice(8);
  if (baseUrl.startsWith('http://')) return 'ws://' + baseUrl.slice(7);
  return baseUrl;
}

/** Extract hostname + port from a URL string; returns empty string on failure. */
export function extractHost(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    return u.host;
  } catch {
    const noProto = baseUrl.replace(/^https?:\/\//, '');
    const slashIdx = noProto.indexOf('/');
    return slashIdx >= 0 ? noProto.slice(0, slashIdx) : noProto;
  }
}

/** Join a base URL and path without duplicating slashes. */
export function joinBaseAndPath(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

/**
 * Build an env var map from the app's selected environment/microservice context.
 * Empty values are omitted so unresolved placeholders remain visible in templates.
 */
export function buildEnvVarMap(
  svc: Microservice | undefined,
  envId: string,
  protocol: ProtocolKey,
  envName?: string,
): Record<string, string> {
  const map: Record<string, string> = {};

  // Global vars first (lowest priority) — apply to all environments
  const globalVars = svc?.globalVars;
  if (globalVars) {
    for (const [k, v] of Object.entries(globalVars)) {
      if (v) map[k] = v;
    }
  }

  // Per-environment vars override global vars for the same key
  const envOverrides = svc?.envVars?.[envId];
  if (envOverrides) {
    for (const [k, v] of Object.entries(envOverrides)) {
      if (v) map[k] = v;
      else delete map[k];
    }
  }

  const httpBase = svc?.baseUrls?.[envId]?.trim() ?? '';
  const protoEndpoint = svc?.protocolEndpoints?.[protocol]?.[envId];

  if (httpBase) {
    map.baseUrl = httpBase;
    const host = extractHost(httpBase);
    if (host) map.host = host;
  }

  const trimmedEnvName = envName?.trim();
  if (trimmedEnvName) map.envName = trimmedEnvName;

  const svcName = svc?.name?.trim();
  if (svcName) map.svcName = svcName;

  switch (protocol) {
    case 'websocket': {
      const explicitWs = protoEndpoint?.baseUrl?.trim();
      const wsBase = explicitWs || (httpBase ? httpToWsUrl(httpBase) : '');
      if (wsBase) map.wsBaseUrl = wsBase;
      break;
    }
    case 'sse': {
      const sseBase = protoEndpoint?.baseUrl?.trim() || httpBase;
      if (sseBase) map.sseUrl = sseBase;
      break;
    }
    case 'graphql': {
      const gqlBase = protoEndpoint?.baseUrl?.trim() || httpBase;
      const path = protoEndpoint?.path?.trim() || '/graphql';
      if (gqlBase) map.graphqlUrl = joinBaseAndPath(gqlBase, path);
      break;
    }
    case 'grpc': {
      const grpcAddr = protoEndpoint?.baseUrl?.trim();
      if (grpcAddr) {
        map.grpcHost = grpcAddr;
        const grpcPort = deriveGrpcPortEnvValue(grpcAddr);
        if (grpcPort) {
          map.grpcPort = grpcPort;
        }
      }
      break;
    }
    case 'http':
      break;
  }

  return map;
}
