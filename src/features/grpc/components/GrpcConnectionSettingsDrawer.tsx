/**
 * Connection Settings drawer (Phase 4J-C/D) — mockup 04 left nav + panels.
 */
import { createPortal } from 'react-dom';
import type {
  GrpcCallResult,
  GrpcCallType,
  GrpcCompressionConfig,
} from '../../../shared/grpc/contracts';
import type { GrpcStudioTransportMode } from '../grpcStudioTypes';
import type { GrpcK8sPortForwardSession } from '../utils/grpcK8sPortForward';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import { GrpcCallSettingsPanel } from './GrpcCallSettingsPanel';
import { GrpcCompressionPanel } from './GrpcCompressionPanel';
import { GrpcHealthCheckPanel } from './GrpcHealthCheckPanel';
import { GrpcK8sPortForwardPanel } from './GrpcK8sPortForwardPanel';
import { GrpcTransportPanel } from './GrpcTransportPanel';

const GRPC_SETTINGS_DRAG_ANCHOR = {
  selector: '[data-testid="grpc-target-input"]',
  hAlign: 'right',
  vAlign: 'top',
  padding: {
    right: -210,
  },
} as const;

export type GrpcConnectionSettingsNav =
  | 'call'
  | 'compression'
  | 'health'
  | 'k8s'
  | 'transport';

const NAV_ITEMS: Array<{
  id: GrpcConnectionSettingsNav;
  label: string;
  hint: string;
}> = [
  { id: 'call', label: 'Call', hint: 'Deadlines and behavior' },
  { id: 'compression', label: 'Compression', hint: 'Payload optimization' },
  { id: 'health', label: 'Health', hint: 'Probe grpc.health.v1' },
  { id: 'k8s', label: 'K8s', hint: 'Cluster tunnel setup' },
  { id: 'transport', label: 'Transport', hint: 'Engine and wire mode' },
];

export interface GrpcConnectionSettingsDrawerProps {
  open: boolean;
  activeNav: GrpcConnectionSettingsNav;
  timeoutMs: number;
  maxResponseSizeMb: number;
  keepaliveIntervalSec: number;
  compression: GrpcCompressionConfig | undefined;
  healthAvailable: boolean;
  healthWatchAvailable: boolean;
  healthProbeReady?: boolean;
  healthBusy?: boolean;
  disabled?: boolean;
  onNavChange: (nav: GrpcConnectionSettingsNav) => void;
  onClose: () => void;
  onTimeoutMsChange: (timeoutMs: number) => void;
  onMaxResponseSizeMbChange: (mb: number) => void;
  onKeepaliveIntervalSecChange: (sec: number) => void;
  onCompressionChange: (compression: GrpcCompressionConfig) => void;
  onHealthCheck: (serviceName: string) => Promise<{ ok: true; result: GrpcCallResult } | { ok: false; error: string }>;
  onHealthWatch: (serviceName: string) => void;
  transportMode?: GrpcStudioTransportMode;
  onTransportModeChange?: (mode: GrpcStudioTransportMode) => void;
  transportChangeBlocked?: boolean;
  /** Phase 10G — call type of the current method; used to disable incompatible modes. */
  callType?: GrpcCallType;
  k8sPortForward?: GrpcK8sPortForwardSession;
  k8sAutomationScopeId?: string;
  onK8sPortForwardChange?: (session: GrpcK8sPortForwardSession) => void;
  onK8sApplyTarget?: (target: string) => void;
  /** Incremented by parent whenever settings are opened to reset modal placement. */
  openRequest?: number;
}

export function GrpcConnectionSettingsDrawer({
  open,
  activeNav,
  timeoutMs,
  maxResponseSizeMb,
  keepaliveIntervalSec,
  compression,
  healthAvailable,
  healthWatchAvailable,
  healthProbeReady = true,
  healthBusy = false,
  disabled = false,
  onNavChange,
  onClose,
  onTimeoutMsChange,
  onMaxResponseSizeMbChange,
  onKeepaliveIntervalSecChange,
  onCompressionChange,
  onHealthCheck,
  onHealthWatch,
  transportMode = 'express',
  onTransportModeChange,
  transportChangeBlocked = false,
  callType,
  k8sPortForward,
  k8sAutomationScopeId,
  onK8sPortForwardChange,
  onK8sApplyTarget,
  openRequest = 0,
}: GrpcConnectionSettingsDrawerProps) {
  const activeNavItem = NAV_ITEMS.find((item) => item.id === activeNav);

  if (!open) return null;

  return createPortal(
    <AppModalFrame
      key={`grpc-settings-frame-${openRequest}`}
      title={(
        <div className="grpc-settings-title-block">
          <div className="grpc-settings-title-copy">
            <span className="grpc-settings-title-text">gRPC session settings</span>
            <span className="grpc-settings-title-hint">{activeNavItem?.hint ?? 'Configure call behavior and connection options.'}</span>
          </div>
        </div>
      )}
      onClose={onClose}
      closeOnOverlayClick={false}
      overlayClassName="grpc-settings-overlay"
      dialogClassName="grpc-settings-drawer-modal"
      headerClassName="grpc-settings-drawer-header modal-header"
      bodyClassName="grpc-settings-drawer-body"
      footerClassName="grpc-settings-drawer-footer"
      titleId="grpc-settings-drawer-title"
      showExpandButton={false}
      showResizeHandles={false}
      disableDrag={false}
      dragAnchor={GRPC_SETTINGS_DRAG_ANCHOR}
      constrainDragToViewport
      dragViewportPadding={8}
      closeButtonKind="none"
      minWidth={560}
      minHeight={440}
      footer={(
        <button
          type="button"
          className="btn grpc-settings-close-btn"
          onClick={onClose}
          data-testid="grpc-settings-close"
        >
          Close
        </button>
      )}
    >
      <div className="grpc-settings-modal-shell" data-testid="grpc-connection-settings-drawer">
        <nav
          className="grpc-settings-tabs"
          role="tablist"
          aria-label="gRPC session settings"
          data-testid="grpc-settings-nav"
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`grpc-settings-nav-${item.id}`}
              aria-selected={activeNav === item.id}
              aria-controls={`grpc-settings-panel-${item.id}`}
              className={`grpc-settings-tab${activeNav === item.id ? ' grpc-settings-tab--active' : ''}`}
              data-testid={`grpc-settings-nav-${item.id}`}
              disabled={disabled}
              onClick={() => onNavChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div
          className="grpc-settings-main"
          role="tabpanel"
          id={`grpc-settings-panel-${activeNav}`}
          aria-labelledby={`grpc-settings-nav-${activeNav}`}
        >
          {activeNav === 'call' && (
            <div className="grpc-settings-panel" data-testid="grpc-settings-panel-call">
              <GrpcCallSettingsPanel
                timeoutMs={timeoutMs}
                maxResponseSizeMb={maxResponseSizeMb}
                keepaliveIntervalSec={keepaliveIntervalSec}
                disabled={disabled}
                onTimeoutMsChange={onTimeoutMsChange}
                onMaxResponseSizeMbChange={onMaxResponseSizeMbChange}
                onKeepaliveIntervalSecChange={onKeepaliveIntervalSecChange}
              />
            </div>
          )}

          {activeNav === 'compression' && (
            <div className="grpc-settings-panel" data-testid="grpc-settings-panel-compression">
              <GrpcCompressionPanel
                compression={compression}
                disabled={disabled}
                onChange={onCompressionChange}
              />
            </div>
          )}

          {activeNav === 'health' && (
            <div className="grpc-settings-panel" data-testid="grpc-settings-panel-health">
              <GrpcHealthCheckPanel
                healthAvailable={healthAvailable}
                healthWatchAvailable={healthWatchAvailable}
                probeReady={healthProbeReady}
                disabled={disabled}
                busy={healthBusy}
                onCheckHealth={onHealthCheck}
                onStartWatch={onHealthWatch}
              />
            </div>
          )}

          {activeNav === 'k8s' && (
            <div className="grpc-settings-panel" data-testid="grpc-settings-panel-k8s">
              <GrpcK8sPortForwardPanel
                session={k8sPortForward}
                disabled={disabled}
                automationScopeId={k8sAutomationScopeId}
                onSessionChange={onK8sPortForwardChange}
                onApplyTarget={onK8sApplyTarget}
              />
            </div>
          )}

          {activeNav === 'transport' && (
            <div className="grpc-settings-panel" data-testid="grpc-settings-panel-transport">
              <GrpcTransportPanel
                transportMode={transportMode}
                onTransportModeChange={onTransportModeChange}
                disabled={disabled}
                transportChangeBlocked={transportChangeBlocked}
                callType={callType}
              />
            </div>
          )}
        </div>
      </div>
    </AppModalFrame>,
    document.body,
  );
}
