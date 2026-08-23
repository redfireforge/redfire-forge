import type { Environment, Microservice, ProtocolEndpoint, ProtocolKey } from '@shared/types';
import { buildEnvVarMap, httpToWsUrl, joinBaseAndPath } from '@shared/utils/envVarUtils';

export type EndpointRowStatus = 'explicit' | 'fallback' | 'empty' | 'unresolved';

export type CompletenessBadgeTone = 'ok' | 'warn' | 'err';

export interface ProtocolCompleteness {
  explicitCount: number;
  total: number;
  label: string;
  tone: CompletenessBadgeTone;
  tabCountLabel: string;
}

export interface ProtocolTabDef {
  key: ProtocolKey;
  label: string;
  shortLabel: string;
  cssKey: string;
  supportsFallback: boolean;
  derivedVars: string[];
}

/** All non-HTTP protocols in display order. */
export const NON_HTTP_PROTOCOLS: ProtocolKey[] = ['websocket', 'sse', 'graphql', 'grpc'];

/**
 * Returns the protocols that should be shown as tabs.
 * No protocol is included by default — users add tabs via "+ Add protocol".
 * For backward compatibility, when `enabledProtocols` is absent we derive the
 * list from existing endpoint data (HTTP from deployed baseUrls, others from
 * protocolEndpoints).
 */
export function getEffectiveEnabledProtocols(svc: Microservice): ProtocolKey[] {
  if (svc.enabledProtocols) return svc.enabledProtocols;
  const enabled: ProtocolKey[] = [];
  if (Object.keys(svc.baseUrls).length > 0) enabled.push('http');
  for (const p of NON_HTTP_PROTOCOLS) {
    const endpoints = svc.protocolEndpoints?.[p];
    if (endpoints && Object.keys(endpoints).length > 0) enabled.push(p);
  }
  return enabled;
}

export const PROTOCOL_TABS: ProtocolTabDef[] = [
  { key: 'http', label: 'HTTP', shortLabel: 'HTTP', cssKey: 'http', supportsFallback: false, derivedVars: ['baseUrl', 'host', 'envName', 'svcName'] },
  { key: 'websocket', label: 'WebSocket', shortLabel: 'WS', cssKey: 'ws', supportsFallback: true, derivedVars: ['wsBaseUrl', 'baseUrl', 'host'] },
  { key: 'sse', label: 'SSE', shortLabel: 'SSE', cssKey: 'sse', supportsFallback: true, derivedVars: ['sseUrl', 'baseUrl'] },
  { key: 'graphql', label: 'GraphQL', shortLabel: 'GraphQL', cssKey: 'graphql', supportsFallback: true, derivedVars: ['graphqlUrl', 'baseUrl'] },
  { key: 'grpc', label: 'gRPC', shortLabel: 'gRPC', cssKey: 'grpc', supportsFallback: false, derivedVars: ['grpcHost'] },
];

export function listDeployedEnvRows(
  svc: Microservice,
  environments: Environment[],
): Array<{ envId: string; name: string; isAdditional: boolean }> {
  const rows: Array<{ envId: string; name: string; isAdditional: boolean }> = [];
  for (const env of environments) {
    if (env.id in svc.baseUrls) rows.push({ envId: env.id, name: env.name, isAdditional: false });
  }
  for (const cEnv of svc.customEnvs ?? []) {
    if (cEnv.id in svc.baseUrls) rows.push({ envId: cEnv.id, name: cEnv.name, isAdditional: true });
  }
  return rows;
}

export function envDisplayName(
  envId: string,
  environments: Environment[],
  svc: Microservice,
): string {
  return environments.find((e) => e.id === envId)?.name
    ?? svc.customEnvs?.find((e) => e.id === envId)?.name
    ?? envId;
}

export function getProtocolEndpoint(
  svc: Microservice,
  protocol: ProtocolKey,
  envId: string,
): ProtocolEndpoint | undefined {
  return svc.protocolEndpoints?.[protocol]?.[envId];
}

export function getExplicitBaseUrl(svc: Microservice, protocol: ProtocolKey, envId: string): string {
  if (protocol === 'http') return svc.baseUrls[envId]?.trim() ?? '';
  return getProtocolEndpoint(svc, protocol, envId)?.baseUrl?.trim() ?? '';
}

export function getRowStatus(svc: Microservice, protocol: ProtocolKey, envId: string): EndpointRowStatus {
  const explicit = getExplicitBaseUrl(svc, protocol, envId);
  if (explicit) return 'explicit';

  // Protocol has no explicit endpoint; check for HTTP fallback availability
  if (protocol === 'http') return 'empty';
  if (protocol === 'grpc') return 'unresolved';
  
  const httpBase = svc.baseUrls[envId]?.trim() ?? '';
  if (httpBase) return 'fallback';
  return 'empty';
}

export function getResolvedDisplayValue(
  svc: Microservice,
  protocol: ProtocolKey,
  envId: string,
  envName: string,
): string {
  const map = buildEnvVarMap(svc, envId, protocol, envName);
  switch (protocol) {
    case 'http': return map.baseUrl ?? '';
    case 'websocket': return map.wsBaseUrl ?? '';
    case 'sse': return map.sseUrl ?? '';
    case 'graphql': return map.graphqlUrl ?? '';
    case 'grpc': return map.grpcHost ?? '';
    default: return '';
  }
}

export function computeProtocolCompleteness(
  svc: Microservice,
  protocol: ProtocolKey,
  deployedEnvIds: string[],
  supportsFallback: boolean,
): ProtocolCompleteness {
  const total = deployedEnvIds.length;
  if (total === 0) {
    return { explicitCount: 0, total: 0, label: '0/0', tone: 'err', tabCountLabel: '0/0' };
  }

  let explicitCount = 0;
  let fallbackCount = 0;
  for (const envId of deployedEnvIds) {
    const status = getRowStatus(svc, protocol, envId);
    if (status === 'explicit') explicitCount += 1;
    else if (status === 'fallback') fallbackCount += 1;
  }

  if (explicitCount === total) {
    return {
      explicitCount,
      total,
      label: `${total}/${total}`,
      tone: 'ok',
      tabCountLabel: `${total}/${total}`,
    };
  }

  if (explicitCount === 0 && fallbackCount === total && supportsFallback) {
    return {
      explicitCount,
      total,
      label: 'fallback',
      tone: 'warn',
      tabCountLabel: 'fallback',
    };
  }

  const tone: CompletenessBadgeTone = explicitCount === 0 ? 'err' : 'warn';
  return {
    explicitCount,
    total,
    label: `${explicitCount}/${total}`,
    tone,
    tabCountLabel: `${explicitCount}/${total}`,
  };
}

export function validateProtocolValue(protocol: ProtocolKey, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  switch (protocol) {
    case 'websocket':
      if (!/^wss?:\/\//i.test(trimmed)) return 'Use ws:// or wss://';
      return null;
    case 'http':
    case 'sse':
    case 'graphql':
      if (!/^https?:\/\//i.test(trimmed)) return 'Use http:// or https://';
      return null;
    case 'grpc':
      if (trimmed.includes('://')) return 'Use host:port without a scheme';
      {
        const lastColon = trimmed.lastIndexOf(':');
        if (lastColon <= 0 || lastColon === trimmed.length - 1) {
          return 'Use host:port (for example: grpc.example.com:50051)';
        }
        const host = trimmed.slice(0, lastColon).trim();
        const portText = trimmed.slice(lastColon + 1).trim();
        if (!host) return 'Use host:port (for example: grpc.example.com:50051)';
        if (!/^\d+$/.test(portText)) return 'Port must be numeric';
        const port = Number(portText);
        if (port < 1 || port > 65535) return 'Port must be between 1 and 65535';
      }
      return null;
    default:
      return null;
  }
}

export function statusChipLabel(status: EndpointRowStatus): string {
  switch (status) {
    case 'explicit': return '✓ set';
    case 'fallback': return '⚠ fallback';
    case 'unresolved': return '✗ unresolved';
    case 'empty': return '— empty';
  }
}

/** True when the protocol tab defines derived template variables to display. */
export function hasDerivedVarsForProtocol(protocol: ProtocolKey): boolean {
  const tabDef = PROTOCOL_TABS.find((t) => t.key === protocol);
  return !!tabDef && tabDef.derivedVars.length > 0;
}

export function derivedVarSourceLabel(key: string, status: EndpointRowStatus): string {
  if (key === 'envName') return 'env name';
  if (key === 'svcName') return 'service name';
  if (key === 'host') return 'extracted';
  if (status === 'explicit') return 'explicitly set';
  if (status === 'fallback') return 'HTTP fallback';
  return 'unresolved';
}

export function graphqlPathForEnv(svc: Microservice, envId: string): string {
  return getProtocolEndpoint(svc, 'graphql', envId)?.path?.trim() || '/graphql';
}

export function grpcTlsForEnv(svc: Microservice, envId: string): boolean {
  return getProtocolEndpoint(svc, 'grpc', envId)?.tls ?? false;
}

/** Build updated protocolEndpoints after editing one env cell. Empty baseUrl removes the env entry. */
export function patchProtocolEndpoints(
  svc: Microservice,
  protocol: ProtocolKey,
  envId: string,
  patch: Partial<ProtocolEndpoint>,
): Microservice['protocolEndpoints'] {
  const prev = svc.protocolEndpoints ?? {};
  const prevProto = { ...(prev[protocol] ?? {}) };
  const current: Partial<ProtocolEndpoint> = { ...(prevProto[envId] ?? {}) };
  const nextEntry: Partial<ProtocolEndpoint> = { ...current, ...patch };

  const hasBase = !!nextEntry.baseUrl?.trim();
  const hasPath = nextEntry.path !== undefined;
  const hasTls = nextEntry.tls !== undefined;

  if (!hasBase && !hasPath && !hasTls) {
    delete prevProto[envId];
  } else {
    prevProto[envId] = {
      baseUrl: hasBase ? nextEntry.baseUrl!.trim() : (current.baseUrl?.trim() ?? ''),
      ...(hasPath ? { path: nextEntry.path } : current.path !== undefined ? { path: current.path } : {}),
      ...(hasTls ? { tls: nextEntry.tls } : current.tls !== undefined ? { tls: current.tls } : {}),
    };
    if (!prevProto[envId].baseUrl && !prevProto[envId].path && prevProto[envId].tls === undefined) {
      delete prevProto[envId];
    }
  }

  const next = { ...prev, [protocol]: prevProto };
  if (Object.keys(prevProto).length === 0) delete next[protocol];
  return Object.keys(next).length > 0 ? next : undefined;
}

export function stripEnvFromProtocolEndpoints(
  svc: Microservice,
  envId: string,
): Microservice['protocolEndpoints'] {
  if (!svc.protocolEndpoints) return undefined;
  const next: NonNullable<Microservice['protocolEndpoints']> = {};
  for (const [proto, map] of Object.entries(svc.protocolEndpoints)) {
    if (!map) continue;
    const copy = { ...map };
    delete copy[envId];
    if (Object.keys(copy).length > 0) next[proto as ProtocolKey] = copy;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function previewGraphqlUrl(baseUrl: string, path: string): string {
  if (!baseUrl.trim()) return '';
  return joinBaseAndPath(baseUrl.trim(), path.trim() || '/graphql');
}

export function previewWsFallback(httpBase: string): string {
  return httpBase.trim() ? httpToWsUrl(httpBase.trim()) : '';
}

export function resolvePreviewEnvId(
  selectedEnvId: string,
  deployedEnvIds: string[],
): string {
  if (selectedEnvId && deployedEnvIds.includes(selectedEnvId)) return selectedEnvId;
  return deployedEnvIds[0] ?? '';
}

export function resolvePreviewEnvName(
  envId: string,
  environments: Environment[],
  svc: Microservice,
): string {
  return envDisplayName(envId, environments, svc);
}
