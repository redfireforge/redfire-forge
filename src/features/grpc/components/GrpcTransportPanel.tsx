/** Phase 4J-D / 7F / 10B / 10G — transport mode cards with per-tab selection, call-type guardrails, and reason labels. */
import { isTauri } from '../../../shared/utils/platform';
import { isGrpcTransportDispatchImplemented } from '../../../shared/grpc/grpcBrowserTransportRouter';
import {
  isGrpcTransportCallTypeSupported,
  isGrpcTransportPlatformSupported,
} from '../../../shared/grpc/grpcWebTransportContracts';
import type { GrpcCallType } from '../../../shared/grpc/contracts';
import type { GrpcStudioTransportMode } from '../grpcStudioTypes';

const TRANSPORT_MODES: Array<{
  id: GrpcStudioTransportMode;
  icon: string;
  label: string;
  description: string;
  detail: string;
  desktopOnly?: boolean;
}> = [
  {
    id: 'express',
    icon: '🌐',
    label: 'Express Proxy',
    description: 'Web + Desktop (Phase 1)',
    detail: 'All calls go through the local Node.js server which uses @grpc/grpc-js to make real HTTP/2 gRPC calls. Works on both web and desktop.',
  },
  {
    id: 'tauri',
    icon: '🦀',
    label: 'Tauri Native (tonic)',
    description: 'Desktop only — true HTTP/2 via Rust',
    detail: 'Uses Rust tonic directly — true HTTP/2, lower overhead, better streaming. Desktop (Tauri) only.',
    desktopOnly: true,
  },
  {
    id: 'grpc-web',
    icon: '🌍',
    label: 'gRPC-Web',
    description: 'Unary + server streaming via grpc-web framing',
    detail: 'Unary and server-streaming calls via browser fetch and grpc-web framing. Client and bidi streaming are blocked in browser-direct mode.',
  },
  {
    id: 'spring-servlet',
    icon: '🌿',
    label: 'Spring Servlet',
    description: 'Unary + server streaming via HTTP/1.1 POST',
    detail: 'Unary and server-streaming calls via HTTP/1.1 POST to /<service>/<method>. Client and bidi streaming require Express Proxy or Tauri Native.',
  },
];

export interface GrpcTransportPanelProps {
  transportMode: GrpcStudioTransportMode;
  onTransportModeChange?: (mode: GrpcStudioTransportMode) => void;
  disabled?: boolean;
  transportChangeBlocked?: boolean;
  /** Phase 10G — the call type of the selected method; used to disable incompatible modes. */
  callType?: GrpcCallType;
}

/**
 * Phase 10G — returns the reason a mode is disabled, or `null` if it is selectable.
 * Caller should combine with `disabled` / `transportChangeBlocked` for final state.
 */
function getModeDisabledReason(
  mode: (typeof TRANSPORT_MODES)[number],
  desktop: boolean,
  callType: GrpcCallType | undefined,
): string | null {
  if (!isGrpcTransportDispatchImplemented(mode.id)) {
    return 'Not yet implemented';
  }
  if (mode.desktopOnly && !desktop) {
    return 'Desktop only';
  }
  if (!isGrpcTransportPlatformSupported(mode.id)) {
    return 'Not supported on this platform';
  }
  if (callType !== undefined && !isGrpcTransportCallTypeSupported(mode.id, callType)) {
    return 'Not supported for this call type';
  }
  return null;
}

export function GrpcTransportPanel({
  transportMode,
  onTransportModeChange,
  disabled = false,
  transportChangeBlocked = false,
  callType,
}: GrpcTransportPanelProps) {
  const desktop = isTauri();
  const selectionDisabled = disabled || transportChangeBlocked;

  return (
    <div className="grpc-transport-panel" data-testid="grpc-transport-panel">
      <div className="grpc-settings-card">
        <div className="grpc-settings-card-body">
          {transportChangeBlocked && (
            <p className="grpc-settings-note grpc-transport-locked-hint" data-testid="grpc-transport-locked-hint">
              Transport is locked while a call or stream is in flight.
            </p>
          )}
          {callType === 'server_streaming' && (
            <p
              className="grpc-settings-note grpc-transport-stream-deferred-hint"
              data-testid="grpc-transport-stream-deferred-hint"
            >
              Server streaming is supported on gRPC-Web and Spring Servlet. For client or bidi
              streaming, use Express Proxy or Tauri Native.
            </p>
          )}
          <div className="grpc-transport-mode-row" role="list" aria-label="Transport mode">
            {TRANSPORT_MODES.map((mode) => {
              const disabledReason = getModeDisabledReason(mode, desktop, callType);
              const selectable = disabledReason === null;
              const isActive = mode.id === transportMode;
              const isDisabled = !selectable || selectionDisabled;
              const optionClass = [
                'grpc-transport-mode-option',
                isActive ? 'grpc-transport-mode-option--active' : '',
                isDisabled ? 'grpc-transport-mode-option--disabled' : 'grpc-transport-mode-option--clickable',
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={mode.id}
                  type="button"
                  role="listitem"
                  className={optionClass}
                  data-testid={`grpc-transport-mode-${mode.id}`}
                  aria-current={isActive ? 'true' : undefined}
                  aria-pressed={isActive}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    onTransportModeChange?.(mode.id);
                  }}
                >
                  <span className="grpc-transport-mode-icon" aria-hidden="true">{mode.icon}</span>
                  <span className="grpc-transport-mode-copy">
                    <span className="grpc-transport-mode-line">
                      <span className="grpc-transport-mode-label">{mode.label}</span>
                      <span className="grpc-transport-mode-desc">{mode.description}</span>
                    </span>
                    <span className="grpc-transport-mode-detail">{mode.detail}</span>
                  </span>
                  {disabledReason !== null && (
                    <span
                      className="grpc-transport-mode-reason"
                      data-testid={`grpc-transport-mode-reason-${mode.id}`}
                    >
                      {disabledReason}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
