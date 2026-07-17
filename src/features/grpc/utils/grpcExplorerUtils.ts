/**
 * gRPC Service Explorer — tree filtering and method lookup (Phase 1E).
 */
import type {
  GrpcCallType,
  GrpcDescriptor,
  GrpcMethodInfo,
  GrpcServiceInfo,
} from '../../../shared/grpc/contracts';

export interface GrpcExplorerServiceNode {
  service: GrpcServiceInfo;
  methods: GrpcMethodInfo[];
  visible: boolean;
}

export function slugifyGrpcExplorerId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

export function formatGrpcCallTypeLabel(callType: GrpcCallType): string {
  switch (callType) {
    case 'unary':
      return 'Unary';
    case 'server_streaming':
      return 'Server streaming';
    case 'client_streaming':
      return 'Client streaming';
    case 'bidi_streaming':
      return 'Bidirectional streaming';
    default:
      return callType;
  }
}

/** Short badge codes from `docs/plan/future/grpc/mockups/01-main-studio.html`. */
export function formatGrpcCallTypeBadge(callType: GrpcCallType): string {
  switch (callType) {
    case 'unary':
      return 'U';
    case 'server_streaming':
      return 'SS';
    case 'client_streaming':
      return 'CS';
    case 'bidi_streaming':
      return 'BD';
    default:
      return '?';
  }
}

export function grpcCallTypeBadgeModifier(callType: GrpcCallType): string {
  switch (callType) {
    case 'unary':
      return 'grpc-method-badge--u';
    case 'server_streaming':
      return 'grpc-method-badge--ss';
    case 'client_streaming':
      return 'grpc-method-badge--cs';
    case 'bidi_streaming':
      return 'grpc-method-badge--bd';
    default:
      return 'grpc-method-badge--u';
  }
}

export function serviceExplorerShortName(fullName: string): string {
  const parts = fullName.split('.');
  return parts[parts.length - 1] ?? fullName;
}

export function serviceExplorerInitial(fullName: string): string {
  const shortName = serviceExplorerShortName(fullName);
  return (shortName.charAt(0) || '?').toUpperCase();
}

const SERVICE_ICON_VARIANTS = ['primary', 'success', 'mauve', 'peach'] as const;

export type GrpcServiceIconVariant = typeof SERVICE_ICON_VARIANTS[number];

export function serviceExplorerIconVariant(fullName: string): GrpcServiceIconVariant {
  let hash = 0;
  for (const ch of fullName) {
    hash = (hash + ch.charCodeAt(0)) % SERVICE_ICON_VARIANTS.length;
  }
  return SERVICE_ICON_VARIANTS[hash]!;
}

export function countDescriptorMethods(descriptor: GrpcDescriptor): number {
  return descriptor.services.reduce((total, service) => total + service.methods.length, 0);
}

export function formatDescriptorSourceLabel(
  source: GrpcDescriptor['source'] | undefined,
): string {
  switch (source) {
    case 'reflection':
      return 'Reflection';
    case 'proto_files':
      return 'Proto files';
    case 'protoset':
      return 'Protoset';
    case 'bsr':
      return 'BSR';
    case 'url_proto':
      return 'URL proto';
    default:
      return 'Unknown';
  }
}

export function isUnaryReadyMethod(method: GrpcMethodInfo): boolean {
  return method.callType === 'unary';
}

export function isStreamReadyMethod(method: GrpcMethodInfo): boolean {
  return method.callType === 'server_streaming'
    || method.callType === 'client_streaming'
    || method.callType === 'bidi_streaming';
}

export function isStreamingLayoutCallType(callType: GrpcCallType): boolean {
  return callType !== 'unary';
}

/** UI layout call type — method wins; defaults to unary when no method is selected. */
export function resolveGrpcStudioLayoutCallType(
  _tab: unknown,
  method?: Pick<GrpcMethodInfo, 'callType'>,
): GrpcCallType {
  return method?.callType ?? 'unary';
}

export function isExecutableMethod(method: GrpcMethodInfo): boolean {
  return isUnaryReadyMethod(method) || isStreamReadyMethod(method);
}

export function findGrpcMethod(
  descriptor: GrpcDescriptor,
  serviceFullName: string,
  methodName: string,
): GrpcMethodInfo | undefined {
  const service = descriptor.services.find((entry) => entry.fullName === serviceFullName);
  return service?.methods.find((entry) => entry.name === methodName);
}

function methodMatchesQuery(method: GrpcMethodInfo, serviceFullName: string, query: string): boolean {
  const lower = query.toLowerCase();
  return (
    serviceFullName.toLowerCase().includes(lower)
    || method.name.toLowerCase().includes(lower)
    || method.requestTypeName.toLowerCase().includes(lower)
    || method.responseTypeName.toLowerCase().includes(lower)
  );
}

export function filterGrpcExplorerTree(
  descriptor: GrpcDescriptor,
  query: string,
): GrpcExplorerServiceNode[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return descriptor.services.map((service) => ({
      service,
      methods: service.methods,
      visible: true,
    }));
  }

  return descriptor.services
    .map((service) => {
      const serviceMatches = service.fullName.toLowerCase().includes(trimmed);
      const methods = serviceMatches
        ? service.methods
        : service.methods.filter((method) => methodMatchesQuery(method, service.fullName, trimmed));
      return {
        service,
        methods,
        visible: serviceMatches || methods.length > 0,
      };
    })
    .filter((node) => node.visible);
}

export function countGrpcExplorerMethods(nodes: GrpcExplorerServiceNode[]): number {
  return nodes.reduce((total, node) => total + node.methods.length, 0);
}
