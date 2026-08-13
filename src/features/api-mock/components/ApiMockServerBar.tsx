import { useState } from 'react';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import type { ApiMockRuntimeStatus } from './ApiMockServerTabs';
import { CopyIcon, CheckIcon, SettingsIcon, RestartIcon, StopIcon, PlayIcon, PanelLeftIcon } from './ApiMockIcons';
import { mockClientOrigin } from '../../../shared/api-mock/harExport';
import { isTauri } from '../../../shared/utils/platform';
import { analyzeNativeUnsupported } from '../../../shared/api-mock/nativeCapabilities';

interface Props {
  server: ApiMockServerDefinitionV1;
  onUpdate: (patch: Partial<ApiMockServerDefinitionV1>) => void;
  status?: ApiMockRuntimeStatus;
  dirty?: boolean;
  generation?: number;
  error?: string;
  onStart?: () => void;
  onStop?: () => void;
  onApply?: () => void;
  onRestart?: () => void;
  onSettings?: () => void;
  /** Mockup 08 — open rules drawer on narrow viewports. */
  onOpenRoutes?: () => void;
}

const STATUS_LABEL: Record<ApiMockRuntimeStatus, string> = {
  stopped: 'Stopped',
  starting: 'Starting…',
  running: 'Running',
  draining: 'Draining…',
  applying: 'Applying…',
  error: 'Error',
};

export function ApiMockServerBar({
  server,
  onUpdate: _onUpdate,
  status = 'stopped',
  dirty = false,
  generation = 0,
  error,
  onStart,
  onStop,
  onApply,
  onRestart,
  onSettings,
  onOpenRoutes,
}: Props) {
  const [copied, setCopied] = useState(false);
  const address = `${mockClientOrigin(server.host, server.port, Boolean(server.settings.tls?.enabled))}${server.basePath}`;
  const running = status === 'running';
  const busy = status === 'starting' || status === 'draining' || status === 'applying';
  const labelClass = running ? 'running' : status === 'error' ? 'error' : 'stopped';
  const nativeWarnings = isTauri() ? analyzeNativeUnsupported(server) : [];
  const tlsEnabled = Boolean(server.settings.tls?.enabled);

  const handleCopy = () => {
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  };

  return (
    <div className="api-mock-server-bar" data-testid="api-mock-server-bar">
      <div className="am-server-bar-main">
        <span className={`am-status-dot ${status}`} />
        <span className={`am-status-label ${labelClass}`}>{STATUS_LABEL[status]}</span>
        <span className="am-address" data-testid="api-mock-address">{address}</span>
        <button
          className="am-icon-btn"
          aria-label="Copy address"
          title={copied ? 'Copied!' : 'Copy address'}
          onClick={handleCopy}
          data-testid="api-mock-copy-address"
        >{copied ? <CheckIcon /> : <CopyIcon />}</button>
        {generation > 0 && (
          <span className="am-generation">Generation {generation}</span>
        )}
        {tlsEnabled && (
          <span className="am-badge" title="HTTPS listeners accept HTTP/2 (h2) and HTTP/1.1" data-testid="api-mock-http2-badge">HTTP/2</span>
        )}
        {dirty && <span className="am-badge warning" data-testid="api-mock-dirty-badge">Draft changed</span>}
        <span className="am-spacer" />
        {dirty && running && (
          <button className="am-btn primary" onClick={onApply} data-testid="api-mock-apply"><CheckIcon /> Apply</button>
        )}
        {running ? (
          <>
            <button className="am-btn" onClick={onRestart} data-testid="api-mock-restart"><RestartIcon /> Restart</button>
            <button className="am-btn danger" onClick={onStop} data-testid="api-mock-stop"><StopIcon /> Stop</button>
          </>
        ) : (
          <button className="am-btn primary" onClick={onStart} disabled={busy} data-testid="api-mock-start">
            <PlayIcon /> {status === 'starting' ? 'Starting…' : 'Start'}
          </button>
        )}
        <button className="am-icon-btn" aria-label="Server settings" title="Server settings" onClick={onSettings} data-testid="api-mock-settings"><SettingsIcon /></button>
        {onOpenRoutes && (
          <button
            className="am-icon-btn am-routes-drawer-toggle"
            aria-label="Open routes"
            title="Open routes"
            onClick={onOpenRoutes}
            data-testid="api-mock-open-routes"
          ><PanelLeftIcon /></button>
        )}
      </div>
      {error && (
        <div className="am-server-error" role="alert" data-testid="api-mock-server-error">
          {error}
        </div>
      )}
      {nativeWarnings.length > 0 && (
        <div className="am-notice warning am-notice--flush" data-testid="api-mock-native-warnings" role="status">
          {nativeWarnings.map(w => (
            <div key={w.code}>{w.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}
