import { useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import type { ApiMockServerDefinitionV1, ApiMockServerSettingsV1 } from '../../../shared/api-mock/contracts';

interface Props {
  server: ApiMockServerDefinitionV1;
  onSave: (patch: Partial<ApiMockServerDefinitionV1>) => void;
  onClose: () => void;
  statusLabel?: string;
}

const HOST_OPTIONS = [
  { value: '127.0.0.1', label: '127.0.0.1 (loopback)' },
  { value: 'localhost', label: 'localhost' },
  { value: '0.0.0.0', label: '0.0.0.0 (LAN — exposes to network)' },
];

const MULTIPLE_MATCH_OPTIONS: Array<{ value: ApiMockServerSettingsV1['selection']['multipleMatchPolicy']; label: string }> = [
  { value: 'highest_priority', label: 'Choose highest priority' },
  { value: 'reject_multiple', label: 'Reject all multiple matches' },
];

const EQUAL_PRIORITY_OPTIONS: Array<{ value: ApiMockServerSettingsV1['selection']['equalPriorityPolicy']; label: string }> = [
  { value: 'reject', label: 'Reject as ambiguous' },
  { value: 'specificity_then_id', label: 'Specificity, then stable ID' },
];

export function ApiMockServerSettingsModal({ server, onSave, onClose, statusLabel }: Props) {
  const [name, setName] = useState(server.name);
  const [host, setHost] = useState<ApiMockServerDefinitionV1['host']>(server.host);
  const [port, setPort] = useState(String(server.port));
  const [basePath, setBasePath] = useState(server.basePath);
  const [multipleMatchPolicy, setMultipleMatchPolicy] = useState(server.settings.selection.multipleMatchPolicy);
  const [equalPriorityPolicy, setEqualPriorityPolicy] = useState(server.settings.selection.equalPriorityPolicy);

  const portNum = parseInt(port, 10);
  const portValid = Number.isFinite(portNum) && portNum >= 1024 && portNum <= 65535;
  const nameValid = name.trim().length > 0;
  const canSave = portValid && nameValid;
  const fallbackStatus = server.settings.fallback.unmatchedResponse.status;
  const fallbackCt = server.settings.fallback.unmatchedResponse.contentType ?? 'application/json';

  const handleSave = () => {
    onSave({
      name: name.trim(),
      host,
      port: portNum,
      basePath: basePath.trim(),
      settings: {
        ...server.settings,
        selection: {
          ...server.settings.selection,
          multipleMatchPolicy,
          equalPriorityPolicy,
        },
      },
    });
    onClose();
  };

  return (
    <AppModalFrame
      title={`${name.trim() || server.name} settings`}
      onClose={onClose}
      footer={
        <div className="api-mock-root am-in-modal" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="am-btn" onClick={onClose} data-testid="api-mock-settings-cancel">Cancel</button>
          <button className="am-btn primary" onClick={handleSave} disabled={!canSave} data-testid="api-mock-settings-save">Save settings</button>
        </div>
      }
    >
      <div className="api-mock-root am-in-modal">
        {statusLabel && (
          <div style={{ marginBottom: 12 }}>
            <span className={`am-badge ${statusLabel === 'Running' ? 'success' : ''}`}>{statusLabel}</span>
          </div>
        )}
        <div className="am-form-grid" data-testid="api-mock-settings-modal">
          <div className="am-form-row">
            <div className="am-form-label">Name</div>
            <div className="am-form-control">
              <input className="am-input wide" value={name} onChange={e => setName(e.target.value)} data-testid="api-mock-settings-name" />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Host</div>
            <div className="am-form-control">
              <CustomSelect
                value={host}
                onChange={v => setHost(v as ApiMockServerDefinitionV1['host'])}
                options={HOST_OPTIONS}
                className="am-cs"
                aria-label="Server host"
                data-testid="api-mock-settings-host"
              />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Port</div>
            <div className="am-form-control">
              <input
                className="am-input num mono"
                type="number"
                min={1024}
                max={65535}
                value={port}
                onChange={e => setPort(e.target.value)}
                data-testid="api-mock-settings-port"
              />
              {!portValid && <span className="am-hint" style={{ color: 'var(--am-red)' }}>Port must be 1024–65535.</span>}
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Base path</div>
            <div className="am-form-control">
              <input className="am-input wide mono" value={basePath} placeholder="/api" onChange={e => setBasePath(e.target.value)} data-testid="api-mock-settings-basepath" />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Multiple matches</div>
            <div className="am-form-control">
              <CustomSelect
                value={multipleMatchPolicy}
                onChange={v => setMultipleMatchPolicy(v as ApiMockServerSettingsV1['selection']['multipleMatchPolicy'])}
                options={MULTIPLE_MATCH_OPTIONS}
                className="am-cs"
                aria-label="Multiple match policy"
                data-testid="api-mock-settings-multiple-match"
              />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Equal priority</div>
            <div className="am-form-control">
              <CustomSelect
                value={equalPriorityPolicy}
                onChange={v => setEqualPriorityPolicy(v as ApiMockServerSettingsV1['selection']['equalPriorityPolicy'])}
                options={EQUAL_PRIORITY_OPTIONS}
                className="am-cs"
                aria-label="Equal priority policy"
                data-testid="api-mock-settings-equal-priority"
              />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Default response</div>
            <div className="am-form-control" style={{ gap: 8 }}>
              <span className="am-badge warning" data-testid="api-mock-settings-fallback-status">{fallbackStatus}</span>
              <span className="am-mono am-muted">{fallbackCt}</span>
              <span className="am-hint">Returned when no rule matches.</span>
            </div>
          </div>
        </div>
        {host === '0.0.0.0' && (
          <div className="am-notice warning" style={{ marginTop: 12 }}>
            <span>Binding to 0.0.0.0 exposes this mock server to your local network.</span>
          </div>
        )}
      </div>
    </AppModalFrame>
  );
}
