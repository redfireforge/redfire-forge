import { useState } from 'react';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import type { ApiMockRuntimeStatus } from './ApiMockServerTabs';

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
}: Props) {
  const [copied, setCopied] = useState(false);
  const address = `http://${server.host}:${server.port}${server.basePath}`;
  const running = status === 'running';
  const busy = status === 'starting' || status === 'draining' || status === 'applying';
  const labelClass = running ? 'running' : status === 'error' ? 'error' : 'stopped';

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
        >{copied ? '✓' : '⧉'}</button>
        {dirty && <span className="am-badge warning" data-testid="api-mock-dirty-badge">Draft changed</span>}
        <span className="am-generation">Generation {generation}</span>
        <span className="am-spacer" />
        {dirty && running && (
          <button className="am-btn primary" onClick={onApply} data-testid="api-mock-apply">✓ Apply</button>
        )}
        {running ? (
          <>
            <button className="am-btn" onClick={onRestart} data-testid="api-mock-restart">Restart</button>
            <button className="am-btn danger" onClick={onStop} data-testid="api-mock-stop">Stop</button>
          </>
        ) : (
          <button className="am-btn primary" onClick={onStart} disabled={busy} data-testid="api-mock-start">
            {status === 'starting' ? 'Starting…' : 'Start'}
          </button>
        )}
        <button className="am-icon-btn" aria-label="Server settings" title="Server settings" onClick={onSettings} data-testid="api-mock-settings">⚙</button>
      </div>
      {error && (
        <div className="am-server-error" role="alert" data-testid="api-mock-server-error">
          {error}
        </div>
      )}
    </div>
  );
}
