/**
 * Connection Settings drawer (Phase 4J-C/D) — mockup 04 left nav + panels.
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  GrpcAuthConfig,
  GrpcCallResult,
  GrpcCallType,
  GrpcCompressionConfig,
  GrpcTlsConfig,
  GrpcTlsMode,
} from '../../../shared/grpc/contracts';
import type { GrpcTlsValidationIssue } from '../../../shared/grpc/grpcTlsPolicy';
import { validateGrpcTlsConfigContract } from '../../../shared/grpc/grpcTlsPolicy';
import type { GrpcAuthPreviewResult } from '../utils/grpcAuthPreview';
import type { GrpcStudioTransportMode } from '../grpcStudioTypes';
import type { GrpcK8sPortForwardSession } from '../utils/grpcK8sPortForward';
import type {
  GrpcAuthSecretFieldKey,
  GrpcMaskedSecretFields,
  GrpcTlsSecretFieldKey,
} from '../utils/grpcSecretFieldUi';
import { pruneAuthMaskForConfig } from '../utils/grpcSecretFieldUi';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import { GrpcAuthPanel } from './GrpcAuthPanel';
import { GrpcCallSettingsPanel } from './GrpcCallSettingsPanel';
import { GrpcCompressionPanel } from './GrpcCompressionPanel';
import { GrpcHealthCheckPanel } from './GrpcHealthCheckPanel';
import { GrpcK8sPortForwardPanel } from './GrpcK8sPortForwardPanel';
import { GrpcTlsConfigBody } from './GrpcTlsConfigBody';
import { GrpcTransportPanel } from './GrpcTransportPanel';

export type GrpcConnectionSettingsNav =
  | 'tls'
  | 'auth'
  | 'call'
  | 'compression'
  | 'health'
  | 'k8s'
  | 'transport';

const NAV_ITEMS: Array<{
  id: GrpcConnectionSettingsNav;
  section: 'connection' | 'call' | 'advanced';
  label: string;
  icon: string;
}> = [
  { id: 'tls', section: 'connection', label: 'TLS / mTLS', icon: '🔒' },
  { id: 'auth', section: 'connection', label: 'Authentication', icon: '🗝' },
  { id: 'call', section: 'call', label: 'Call settings', icon: '⏱' },
  { id: 'compression', section: 'call', label: 'Compression', icon: '⚡' },
  { id: 'health', section: 'advanced', label: 'Health check', icon: '♥' },
  { id: 'k8s', section: 'advanced', label: 'K8s port-forward', icon: '☸' },
  { id: 'transport', section: 'advanced', label: 'Transport', icon: '🛠' },
];

export interface GrpcConnectionSettingsDrawerProps {
  open: boolean;
  activeNav: GrpcConnectionSettingsNav;
  tlsMode: GrpcTlsMode;
  tlsConfig: GrpcTlsConfig | undefined;
  tlsIssues: GrpcTlsValidationIssue[];
  auth: GrpcAuthConfig | undefined;
  authPreview: GrpcAuthPreviewResult;
  timeoutMs: number;
  compression: GrpcCompressionConfig | undefined;
  healthAvailable: boolean;
  healthWatchAvailable: boolean;
  healthProbeReady?: boolean;
  healthBusy?: boolean;
  maskedSecretFields?: GrpcMaskedSecretFields;
  disabled?: boolean;
  onNavChange: (nav: GrpcConnectionSettingsNav) => void;
  onClose: () => void;
  onTlsModeChange: (mode: GrpcTlsMode) => void;
  onTlsConfigChange: (patch: Partial<GrpcTlsConfig>) => void;
  onAuthChange: (auth: GrpcAuthConfig | undefined) => void;
  onTimeoutMsChange: (timeoutMs: number) => void;
  onCompressionChange: (compression: GrpcCompressionConfig) => void;
  onHealthCheck: (serviceName: string) => Promise<{ ok: true; result: GrpcCallResult } | { ok: false; error: string }>;
  onHealthWatch: (serviceName: string) => void;
  onUnmaskTlsSecretField?: (field: GrpcTlsSecretFieldKey) => void;
  onClearTlsSecretField?: (field: GrpcTlsSecretFieldKey) => void;
  onUnmaskAuthSecretField?: (field: GrpcAuthSecretFieldKey) => void;
  onClearAuthSecretField?: (field: GrpcAuthSecretFieldKey) => void;
  transportMode?: GrpcStudioTransportMode;
  onTransportModeChange?: (mode: GrpcStudioTransportMode) => void;
  transportChangeBlocked?: boolean;
  /** Phase 10G — call type of the current method; used to disable incompatible modes. */
  callType?: GrpcCallType;
  k8sPortForward?: GrpcK8sPortForwardSession;
  k8sAutomationScopeId?: string;
  onK8sPortForwardChange?: (session: GrpcK8sPortForwardSession) => void;
  onK8sApplyTarget?: (target: string) => void;
}

export function GrpcConnectionSettingsDrawer({
  open,
  activeNav,
  tlsMode,
  tlsConfig,
  tlsIssues,
  auth,
  authPreview,
  timeoutMs,
  compression,
  healthAvailable,
  healthWatchAvailable,
  healthProbeReady = true,
  healthBusy = false,
  maskedSecretFields,
  disabled = false,
  onNavChange,
  onClose,
  onTlsModeChange,
  onTlsConfigChange,
  onAuthChange,
  onTimeoutMsChange,
  onCompressionChange,
  onHealthCheck,
  onHealthWatch,
  onUnmaskTlsSecretField,
  onClearTlsSecretField,
  onUnmaskAuthSecretField,
  onClearAuthSecretField,
  transportMode = 'express',
  onTransportModeChange,
  transportChangeBlocked = false,
  callType,
  k8sPortForward,
  k8sAutomationScopeId,
  onK8sPortForwardChange,
  onK8sApplyTarget,
}: GrpcConnectionSettingsDrawerProps) {
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTestResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleTestConnection = useCallback(() => {
    const validationIssues = validateGrpcTlsConfigContract(tlsMode, tlsConfig);
    if (validationIssues.length === 0) {
      setTestResult(
        tlsMode === 'disabled'
          ? 'Plaintext mode — no TLS handshake required.'
          : 'TLS configuration passed local validation.',
      );
      return;
    }
    setTestResult(validationIssues.map((issue) => issue.message).join(' '));
  }, [tlsMode, tlsConfig]);

  const handleResetDefaults = useCallback(() => {
    setTestResult(null);
    onTlsModeChange('disabled');
  }, [onTlsModeChange]);

  const handleTlsModeChange = useCallback((mode: GrpcTlsMode) => {
    setTestResult(null);
    onTlsModeChange(mode);
  }, [onTlsModeChange]);

  const handleTlsConfigChange = useCallback((patch: Partial<GrpcTlsConfig>) => {
    setTestResult(null);
    onTlsConfigChange(patch);
  }, [onTlsConfigChange]);

  if (!open) return null;

  return createPortal(
    <AppModalFrame
      title={(
        <div className="grpc-settings-title-block">
          <span className="grpc-settings-drag-handle" aria-hidden="true" />
          <div className="grpc-settings-title-copy">
            <span className="grpc-settings-title-text">gRPC session settings</span>
            <span className="grpc-settings-title-hint">Connection profile editor — drag header to move</span>
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
      closeButtonKind="none"
      minWidth={720}
      minHeight={480}
      footer={(
        <button
          type="button"
          className="btn"
          onClick={onClose}
          data-testid="grpc-settings-close"
        >
          Close
        </button>
      )}
    >
      <div className="grpc-settings-layout" data-testid="grpc-connection-settings-drawer">
        <nav className="grpc-settings-nav" aria-label="gRPC session settings" data-testid="grpc-settings-nav">
          <div className="grpc-settings-nav-section">Connection</div>
          {NAV_ITEMS.filter((item) => item.section === 'connection').map((item) => (
            <button
              key={item.id}
              type="button"
              className={`grpc-settings-nav-item${activeNav === item.id ? ' grpc-settings-nav-item--active' : ''}`}
              data-testid={`grpc-settings-nav-${item.id}`}
              disabled={disabled}
              onClick={() => onNavChange(item.id)}
            >
              <span className="grpc-settings-nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div className="grpc-settings-nav-section">Call config</div>
          {NAV_ITEMS.filter((item) => item.section === 'call').map((item) => (
            <button
              key={item.id}
              type="button"
              className={`grpc-settings-nav-item${activeNav === item.id ? ' grpc-settings-nav-item--active' : ''}`}
              data-testid={`grpc-settings-nav-${item.id}`}
              disabled={disabled}
              onClick={() => onNavChange(item.id)}
            >
              <span className="grpc-settings-nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div className="grpc-settings-nav-section">Advanced</div>
          {NAV_ITEMS.filter((item) => item.section === 'advanced').map((item) => (
            <button
              key={item.id}
              type="button"
              className={`grpc-settings-nav-item${activeNav === item.id ? ' grpc-settings-nav-item--active' : ''}`}
              data-testid={`grpc-settings-nav-${item.id}`}
              disabled={disabled}
              onClick={() => onNavChange(item.id)}
            >
              <span className="grpc-settings-nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="grpc-settings-main">
          {activeNav === 'tls' && (
            <div className="grpc-settings-panel" data-testid="grpc-settings-panel-tls">
              <div className="grpc-settings-card">
                <div className="grpc-settings-card-header">
                  <h3 className="grpc-settings-card-title">TLS / mTLS</h3>
                </div>
                <div className="grpc-settings-card-body">
                  <GrpcTlsConfigBody
                    tlsMode={tlsMode}
                    tlsConfig={tlsConfig}
                    issues={tlsIssues}
                    maskedSecretFields={maskedSecretFields?.tls}
                    disabled={disabled}
                    testResult={testResult}
                    onTlsModeChange={handleTlsModeChange}
                    onTlsConfigChange={handleTlsConfigChange}
                    onUnmaskSecretField={onUnmaskTlsSecretField}
                    onClearSecretField={onClearTlsSecretField}
                    onTestConnection={handleTestConnection}
                    onResetDefaults={handleResetDefaults}
                  />
                </div>
              </div>
            </div>
          )}

          {activeNav === 'auth' && (
            <div className="grpc-settings-panel" data-testid="grpc-settings-panel-auth">
              <div className="grpc-settings-card">
                <div className="grpc-settings-card-header">
                  <h3 className="grpc-settings-card-title">Authentication</h3>
                </div>
                <div className="grpc-settings-card-body">
                  <GrpcAuthPanel
                    auth={auth}
                    preview={authPreview}
                    disabled={disabled}
                    showPageDefaultBanner
                    maskedSecretFields={pruneAuthMaskForConfig(auth, maskedSecretFields)?.auth}
                    onChange={onAuthChange}
                    onUnmaskSecretField={onUnmaskAuthSecretField}
                    onClearSecretField={onClearAuthSecretField}
                  />
                </div>
              </div>
            </div>
          )}

          {activeNav === 'call' && (
            <div className="grpc-settings-panel" data-testid="grpc-settings-panel-call">
              <GrpcCallSettingsPanel
                timeoutMs={timeoutMs}
                disabled={disabled}
                onTimeoutMsChange={onTimeoutMsChange}
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
