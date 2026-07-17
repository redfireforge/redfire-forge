export const GRPC_ROUTE_IDS = {
  STATUS: 'status',
  REFLECT: 'reflect',
  DESCRIBE: 'describe',
  DESCRIBE_USAGE: 'describe_usage',
  PERF_SNAPSHOT: 'perf_snapshot',
  EXPORT_PROTOSET: 'export_protoset',
  LOOKUP_DESCRIPTOR: 'lookup_descriptor',
  CALL: 'call',
  CANCEL: 'cancel',
  STREAM_START: 'stream_start',
  STREAM_EVENTS: 'stream_events',
  STREAM_SEND: 'stream_send',
  STREAM_END: 'stream_end',
  STREAM_CANCEL: 'stream_cancel',
  K8S_STATUS: 'k8s_status',
  K8S_LOGS: 'k8s_logs',
  K8S_LOGS_CLEAR: 'k8s_logs_clear',
  K8S_START: 'k8s_start',
  K8S_STOP: 'k8s_stop',
} as const;

export type GrpcObservabilityRouteId = (typeof GRPC_ROUTE_IDS)[keyof typeof GRPC_ROUTE_IDS];

export interface GrpcRouteTaxonomyEntry {
  routeId: GrpcObservabilityRouteId;
  surface: 'control_plane' | 'data_plane' | 'stream_lifecycle' | 'k8s_port_forward';
  redactionTier: 'none' | 'display_mask' | 'export_mask';
}

export const GRPC_ROUTE_TAXONOMY: GrpcRouteTaxonomyEntry[] = [
  { routeId: GRPC_ROUTE_IDS.STATUS, surface: 'control_plane', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.REFLECT, surface: 'control_plane', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.DESCRIBE, surface: 'control_plane', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.DESCRIBE_USAGE, surface: 'control_plane', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.PERF_SNAPSHOT, surface: 'control_plane', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.EXPORT_PROTOSET, surface: 'control_plane', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.LOOKUP_DESCRIPTOR, surface: 'control_plane', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.CALL, surface: 'data_plane', redactionTier: 'export_mask' },
  { routeId: GRPC_ROUTE_IDS.CANCEL, surface: 'data_plane', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.STREAM_START, surface: 'stream_lifecycle', redactionTier: 'export_mask' },
  { routeId: GRPC_ROUTE_IDS.STREAM_EVENTS, surface: 'stream_lifecycle', redactionTier: 'display_mask' },
  { routeId: GRPC_ROUTE_IDS.STREAM_SEND, surface: 'stream_lifecycle', redactionTier: 'export_mask' },
  { routeId: GRPC_ROUTE_IDS.STREAM_END, surface: 'stream_lifecycle', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.STREAM_CANCEL, surface: 'stream_lifecycle', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.K8S_STATUS, surface: 'k8s_port_forward', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.K8S_LOGS, surface: 'k8s_port_forward', redactionTier: 'display_mask' },
  { routeId: GRPC_ROUTE_IDS.K8S_LOGS_CLEAR, surface: 'k8s_port_forward', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.K8S_START, surface: 'k8s_port_forward', redactionTier: 'none' },
  { routeId: GRPC_ROUTE_IDS.K8S_STOP, surface: 'k8s_port_forward', redactionTier: 'none' },
];

export const GRPC_ROUTE_ID_SET = new Set<GrpcObservabilityRouteId>(GRPC_ROUTE_TAXONOMY.map((item) => item.routeId));
