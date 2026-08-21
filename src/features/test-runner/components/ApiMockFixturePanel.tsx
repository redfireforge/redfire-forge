import { useEffect, useRef, useState, type ReactNode } from 'react';
import { API_MOCK_WORKSPACE_CHANGED_EVENT } from '../../api-mock/apiMockGalleryImport';
import {
  API_MOCK_RUNTIME_CHANGED_EVENT,
  API_MOCK_WORKSPACE_PERSISTED_EVENT,
} from '../../api-mock/apiMockPersistence';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import type { ApiMockFixtureRunStatus, ApiMockTestFixtureConfig } from '../utils/apiMockTestFixture';
import {
  fixtureServerLabel,
  fixtureServerStatusLabel,
  loadApiMockFixtureServers,
  type ApiMockFixtureServerRow,
} from '../utils/apiMockFixtureServers';

interface Props {
  value: ApiMockTestFixtureConfig | undefined;
  onChange: (next: ApiMockTestFixtureConfig | undefined) => void;
  disabled?: boolean;
  status?: ApiMockFixtureRunStatus | null;
  /** Test Runner stays mounted; reload when the tab is shown. */
  visible?: boolean;
}

function FixtureRow({
  label,
  htmlFor,
  testId,
  children,
}: {
  label: string;
  htmlFor?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div className="am-fixture-row" data-testid={testId}>
      <div className="am-fixture-label">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
      </div>
      <div className="am-fixture-control">{children}</div>
    </div>
  );
}

function FixtureCheck({
  checked,
  disabled,
  testId,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  testId: string;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="am-fixture-check">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        data-testid={testId}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

/**
 * Optional Test Runner setup/teardown for an API Mock Studio definition (Phase 11C).
 */
export default function ApiMockFixturePanel({ value, onChange, disabled, status, visible = true }: Props) {
  const [servers, setServers] = useState<ApiMockFixtureServerRow[]>([]);

  const enabled = Boolean(value?.enabled);
  const selectedServerId = value?.serverId ?? '';
  const isolateRun = value?.isolateRun !== false;
  const portMode = value?.portMode ?? 'auto';
  const teardown = value?.teardown ?? 'stop';
  const cfg: ApiMockTestFixtureConfig = {
    enabled,
    serverId: selectedServerId || servers[0]?.id || '',
    isolateRun,
    portMode,
    overrideBaseUrl: true,
    teardown,
  };

  const patch = (partial: Partial<ApiMockTestFixtureConfig>) => {
    onChange({ ...cfg, ...partial, enabled: true });
  };

  const healRef = useRef({ isolateRun, portMode, teardown, onChange, servers });
  healRef.current = { isolateRun, portMode, teardown, onChange, servers };
  const serverIds = servers.map(s => s.id).join('\0');

  useEffect(() => {
    const reload = () => {
      void loadApiMockFixtureServers().then(setServers);
    };
    if (visible) reload();
    window.addEventListener(API_MOCK_WORKSPACE_CHANGED_EVENT, reload);
    window.addEventListener(API_MOCK_WORKSPACE_PERSISTED_EVENT, reload);
    window.addEventListener(API_MOCK_RUNTIME_CHANGED_EVENT, reload);
    return () => {
      window.removeEventListener(API_MOCK_WORKSPACE_CHANGED_EVENT, reload);
      window.removeEventListener(API_MOCK_WORKSPACE_PERSISTED_EVENT, reload);
      window.removeEventListener(API_MOCK_RUNTIME_CHANGED_EVENT, reload);
    };
  }, [visible, enabled]);

  // Gallery import remaps server ids. Heal a blank/stale selection once the
  // workspace list arrives so Run is not left with `serverId: ''`.
  // Deps stay a fixed length of 3 — spreading config fields here trips React's
  // "useEffect changed size between renders" when the fixture hydrates.
  useEffect(() => {
    const extra = healRef.current;
    if (!enabled || extra.servers.length === 0) return;
    if (extra.servers.some(s => s.id === selectedServerId)) return;
    extra.onChange({
      enabled: true,
      serverId: extra.servers[0].id,
      isolateRun: extra.isolateRun,
      portMode: extra.portMode,
      overrideBaseUrl: true,
      teardown: extra.teardown,
    });
  }, [enabled, selectedServerId, serverIds]);

  return (
    <section
      className={`am-fixture${enabled ? ' am-fixture--on' : ''}`}
      data-testid="har-apimock-fixture"
    >
      <header className="am-fixture-head">
        <div className="am-fixture-title-block">
          <h3 className="am-fixture-title">API Mock fixture</h3>
          <p className="am-fixture-sub">
            Starts a Studio mock and stops it after pass, fail, or cancel
          </p>
        </div>
      </header>

      <div className="am-fixture-body">
        <FixtureRow label="Server">
          <div
            className="am-fixture-select-wrap"
            data-am-servers={JSON.stringify(servers.map(s => ({
              value: s.id,
              label: fixtureServerLabel(s),
            })))}
          >
            <div className="am-fixture-select-row">
              {servers.length > 0 && (
                <span
                  className="am-fixture-status-dot"
                  data-state={servers.find(s => s.id === cfg.serverId)?.status ?? 'stopped'}
                  data-testid="har-apimock-fixture-server-dot"
                  title={fixtureServerStatusLabel(servers.find(s => s.id === cfg.serverId)?.status ?? 'stopped')}
                />
              )}
              <CustomSelect
                className="am-fixture-select"
                value={cfg.serverId}
                onChange={(next) => {
                  if (!next || !servers.some(s => s.id === next)) return;
                  patch({ serverId: next });
                }}
                options={
                  servers.length === 0
                    ? [{ value: '', label: 'No Studio servers', disabled: true }]
                    : servers.map(s => ({
                      value: s.id,
                      label: fixtureServerLabel(s),
                      detail: fixtureServerStatusLabel(s.status),
                    }))
                }
                placeholder="No Studio servers"
                disabled={disabled || servers.length === 0}
                aria-label="Server"
                data-testid="har-apimock-fixture-server"
                showDetailInTrigger
              />
              {servers.length === 0 && (
                <p className="am-fixture-hint">Create a server in API Mock Studio first</p>
              )}
              {servers.length > 0 && (
                <p className="am-fixture-hint" data-testid="har-apimock-fixture-server-status">
                  {servers.find(s => s.id === cfg.serverId)?.status === 'running'
                    ? 'Listener is running'
                    : 'Stopped — Run starts a listener'}
                </p>
              )}
            </div>
          </div>
        </FixtureRow>

        <FixtureRow label="Isolate run ID" testId="har-apimock-fixture-isolate-row">
          <FixtureCheck
            checked={cfg.isolateRun !== false}
            disabled={disabled}
            testId="har-apimock-fixture-isolate"
            onChange={(checked) => patch({ isolateRun: checked })}
          >
            On: throwaway copy. Off: put Studio's mock back the way it was
          </FixtureCheck>
        </FixtureRow>
      </div>

      {status?.phase === 'starting' && (
        <p className="am-fixture-status" data-phase="starting" data-testid="har-apimock-fixture-start">
          Starting mock listener…
        </p>
      )}
      {status?.phase === 'running' && (
        <p className="am-fixture-status" data-phase="running" data-testid="har-apimock-fixture-start">
          Started mock on :<span data-testid="har-apimock-fixture-port">{status.port}</span>
        </p>
      )}
      {status?.phase === 'stopped' && (
        <p className="am-fixture-status" data-phase="stopped">
          {status.port != null && (
            <span data-testid="har-apimock-fixture-start">
              Started mock on :<span data-testid="har-apimock-fixture-port">{status.port}</span>
            </span>
          )}
          {status.port != null && ' · '}
          <span data-testid="har-apimock-fixture-stopped">
            Stopped · port <span data-testid="har-apimock-fixture-freed-port">{status.port}</span> freed
          </span>
        </p>
      )}
    </section>
  );
}
