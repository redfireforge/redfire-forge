export type GrpcHybridTelemetryEventName =
  | 'grpc_editor_modal_opened'
  | 'grpc_editor_modal_applied'
  | 'grpc_editor_modal_discarded'
  | 'grpc_editor_modal_close_prompted'
  | 'grpc_editor_modal_close_cancelled'
  | 'grpc_editor_send_blocked_error'
  | 'grpc_editor_validation_warning_count'
  | 'grpc_editor_selected_path_changed';

export type GrpcHybridSchemaComplexityBucket = 'small' | 'medium' | 'large';

export interface GrpcHybridTelemetryPayload {
  tabIdHash: string;
  methodIdentifier: string;
  schemaComplexity: GrpcHybridSchemaComplexityBucket;
}

export type GrpcHybridTelemetryMetadata = Record<string, string | number | boolean | null>;

const GRPC_HYBRID_TELEMETRY_EVENT = 'grpc-hybrid-editor-telemetry';

export function emitGrpcHybridTelemetry(
  name: GrpcHybridTelemetryEventName,
  payload: GrpcHybridTelemetryPayload,
  metadata?: GrpcHybridTelemetryMetadata,
): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(
    new CustomEvent(GRPC_HYBRID_TELEMETRY_EVENT, {
      detail: {
        name,
        ...payload,
        ...(metadata ?? {}),
        emittedAt: Date.now(),
      },
    }),
  );
}
