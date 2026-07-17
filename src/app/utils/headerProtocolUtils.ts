import type { Environment, Microservice, ProtocolKey } from '../../shared/types';
import {
  PROTOCOL_TABS,
  envDisplayName,
  getResolvedDisplayValue,
  getRowStatus,
  type EndpointRowStatus,
} from '../../features/environments/utils/protocolEndpointUtils';
import type { Tab } from './appTabUtils';

export type HeaderProtocolStatus = 'explicit' | 'fallback' | 'unresolved';

export interface HeaderProtocolIndicatorState {
  protocol: ProtocolKey;
  protocolLabel: string;
  cssKey: string;
  resolvedUrl: string;
  status: HeaderProtocolStatus;
  statusSymbol: '✓' | '⚠' | '✗';
  tooltipTitle: string;
  tooltipDetail: string;
}

const HTTP_CONTEXT_TABS = new Set<Tab>([
  'requests',
  'catalog',
  'scenarios',
  'runner',
  'param-runner',
  'workflow-runner',
  'results',
]);

/** Map the active app tab to the protocol whose endpoint should appear in the header. */
export function tabToHeaderProtocol(tab: Tab): ProtocolKey | null {
  switch (tab) {
    case 'websocket-studio':
      return 'websocket';
    case 'sse-studio':
      return 'sse';
    case 'graphql-studio':
      return 'graphql';
    case 'grpc-studio':
      return 'grpc';
    default:
      return HTTP_CONTEXT_TABS.has(tab) ? 'http' : null;
  }
}

function mapRowStatusToHeader(status: EndpointRowStatus, resolvedUrl: string): HeaderProtocolStatus {
  if (status === 'explicit') return 'explicit';
  if (status === 'fallback' && resolvedUrl) return 'fallback';
  return 'unresolved';
}

function statusSymbolFor(status: HeaderProtocolStatus): '✓' | '⚠' | '✗' {
  switch (status) {
    case 'explicit': return '✓';
    case 'fallback': return '⚠';
    case 'unresolved': return '✗';
  }
}

function fallbackReason(protocol: ProtocolKey): string {
  switch (protocol) {
    case 'websocket':
      return 'No explicit WebSocket address — using HTTP base URL with ws/wss conversion.';
    case 'sse':
      return 'No explicit SSE endpoint — using HTTP base URL.';
    case 'graphql':
      return 'No explicit GraphQL endpoint — using HTTP base URL and default path.';
    case 'http':
      return 'No HTTP base URL configured for this environment.';
    case 'grpc':
      return 'gRPC requires an explicit host:port — no HTTP fallback.';
    default:
      return 'Endpoint unresolved.';
  }
}

function explicitReason(protocol: ProtocolKey): string {
  const tab = PROTOCOL_TABS.find((t) => t.key === protocol);
  return `Explicitly configured in Environment Manager (${tab?.label ?? protocol} tab).`;
}

function unresolvedReason(protocol: ProtocolKey, resolvedUrl: string): string {
  if (resolvedUrl) return fallbackReason(protocol);
  if (protocol === 'http') {
    return 'Set a base URL on the HTTP tab for this environment (deploy the row first if needed).';
  }
  return `${fallbackReason(protocol)} Configure it in Environment Manager.`;
}

export function buildHeaderProtocolTooltip(
  protocol: ProtocolKey,
  envName: string,
  svcName: string,
  resolvedUrl: string,
  status: HeaderProtocolStatus,
): { title: string; detail: string } {
  const tab = PROTOCOL_TABS.find((t) => t.key === protocol);
  const title = `${tab?.label ?? protocol} endpoint · ${envName} × ${svcName}`;
  let detail: string;
  if (status === 'explicit') {
    detail = explicitReason(protocol);
  } else if (status === 'fallback') {
    detail = fallbackReason(protocol);
  } else {
    detail = unresolvedReason(protocol, resolvedUrl);
  }
  if (resolvedUrl) {
    detail = `${detail}\nResolved: ${resolvedUrl}`;
  }
  return { title, detail };
}

export function resolveHeaderProtocolIndicator(
  activeTab: Tab,
  svc: Microservice | undefined,
  envId: string,
  environments: Environment[],
): HeaderProtocolIndicatorState | null {
  const protocol = tabToHeaderProtocol(activeTab);
  if (!protocol) return null;

  const tabDef = PROTOCOL_TABS.find((t) => t.key === protocol)!;

  if (!svc || !envId) {
    return {
      protocol,
      protocolLabel: tabDef.label,
      cssKey: tabDef.cssKey,
      resolvedUrl: '',
      status: 'unresolved',
      statusSymbol: '✗',
      tooltipTitle: `${tabDef.label} endpoint`,
      tooltipDetail: 'Select an environment and microservice to resolve the endpoint.',
    };
  }

  const envName = envDisplayName(envId, environments, svc);
  const rowStatus = getRowStatus(svc, protocol, envId);
  const resolvedUrl = getResolvedDisplayValue(svc, protocol, envId, envName);
  const status = mapRowStatusToHeader(rowStatus, resolvedUrl);
  const { title, detail } = buildHeaderProtocolTooltip(
    protocol,
    envName,
    svc.name,
    resolvedUrl,
    status,
  );

  return {
    protocol,
    protocolLabel: tabDef.label,
    cssKey: tabDef.cssKey,
    resolvedUrl,
    status,
    statusSymbol: statusSymbolFor(status),
    tooltipTitle: title,
    tooltipDetail: detail,
  };
}
