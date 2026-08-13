import { useEffect, useState } from 'react';
import type { ApiMockTestFixtureConfig } from '../utils/apiMockTestFixture';
import { loadApiMockWorkspace } from '../../api-mock/apiMockPersistence';

interface Props {
  value: ApiMockTestFixtureConfig | undefined;
  onChange: (next: ApiMockTestFixtureConfig | undefined) => void;
  disabled?: boolean;
}

/**
 * Optional Test Runner setup/teardown for an API Mock Studio definition (Phase 11C).
 */
export default function ApiMockFixturePanel({ value, onChange, disabled }: Props) {
  const [servers, setServers] = useState<Array<{ id: string; name: string; port: number }>>([]);

  useEffect(() => {
    void loadApiMockWorkspace().then((ws) => {
      setServers(ws.servers.map(s => ({ id: s.id, name: s.name, port: s.port })));
    });
  }, []);

  const enabled = !!value?.enabled;
  const cfg: ApiMockTestFixtureConfig = value ?? {
    enabled: false,
    serverId: servers[0]?.id ?? '',
    isolateRun: true,
    portMode: 'auto',
    overrideBaseUrl: true,
    teardown: 'stop',
  };

  const patch = (partial: Partial<ApiMockTestFixtureConfig>) => {
    const next = { ...cfg, ...partial };
    onChange(next.enabled ? next : undefined);
  };

  return (
    <fieldset className="runner-fieldset" data-testid="har-apimock-fixture">
      <legend>API Mock fixture</legend>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          data-testid="har-apimock-fixture-enabled"
          onChange={(e) => patch({
            enabled: e.target.checked,
            serverId: cfg.serverId || servers[0]?.id || '',
          })}
        />
        <span>Start mock server before run (auto-stop after pass/fail/cancel)</span>
      </label>
      {enabled && (
        <div className="form-row-inline" style={{ gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <label>
            <span className="field-label">Server</span>
            <select
              value={cfg.serverId}
              disabled={disabled || servers.length === 0}
              data-testid="har-apimock-fixture-server"
              onChange={(e) => patch({ serverId: e.target.value })}
            >
              {servers.length === 0 && <option value="">No Studio servers</option>}
              {servers.map(s => (
                <option key={s.id} value={s.id}>{s.name} (:{s.port})</option>
              ))}
            </select>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={cfg.isolateRun !== false}
              disabled={disabled}
              onChange={(e) => patch({ isolateRun: e.target.checked })}
            />
            <span>Isolate run ID</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={cfg.overrideBaseUrl !== false}
              disabled={disabled}
              onChange={(e) => patch({ overrideBaseUrl: e.target.checked })}
            />
            <span>Override host → mock</span>
          </label>
        </div>
      )}
    </fieldset>
  );
}
