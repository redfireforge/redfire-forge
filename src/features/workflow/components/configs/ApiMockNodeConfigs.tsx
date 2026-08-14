/**
 * Phase 11 — config panels for API Mock workflow nodes.
 */
import { useEffect, useState } from 'react';
import type {
  ApiMockApplyNodeData,
  ApiMockAssertCallsNodeData,
  ApiMockResetStateNodeData,
  ApiMockStartNodeData,
  ApiMockStopNodeData,
} from '../../types/workflow/node-api-mock';
import { loadApiMockWorkspace } from '../../../api-mock/apiMockPersistence';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

interface ServerOpt { id: string; name: string; port: number }

function useMockServers() {
  const [servers, setServers] = useState<ServerOpt[]>([]);
  useEffect(() => {
    void loadApiMockWorkspace().then(ws => {
      setServers(ws.servers.map(s => ({ id: s.id, name: s.name, port: s.port })));
    });
  }, []);
  return servers;
}

function ServerPicker({
  value,
  onChange,
  servers,
}: {
  value: string;
  onChange: (id: string) => void;
  servers: ServerOpt[];
}) {
  return (
    <div className="wf-form-row">
      <label>Mock server</label>
      <CustomSelect
        value={value}
        onChange={onChange}
        options={[
          { value: '', label: servers.length ? 'Select server…' : 'No servers in workspace' },
          ...servers.map(s => ({ value: s.id, label: `${s.name} (:${s.port})` })),
        ]}
        aria-label="Mock server"
        data-testid="api-mock-wf-server"
      />
    </div>
  );
}

function OnErrorRow({
  value,
  onChange,
}: {
  value?: 'fail' | 'continue';
  onChange: (v: 'fail' | 'continue') => void;
}) {
  return (
    <div className="wf-form-row">
      <label>On error</label>
      <CustomSelect
        value={value ?? 'fail'}
        onChange={v => onChange(v as 'fail' | 'continue')}
        options={[
          { value: 'fail', label: 'Fail workflow' },
          { value: 'continue', label: 'Continue' },
        ]}
        aria-label="On error"
      />
    </div>
  );
}

export function ApiMockStartConfig({
  data,
  onChange,
}: {
  data: ApiMockStartNodeData;
  onChange: (patch: Partial<ApiMockStartNodeData>) => void;
}) {
  const servers = useMockServers();
  return (
    <div className="wf-config-section" data-testid="api-mock-start-config">
      <ServerPicker value={data.serverId} onChange={serverId => onChange({ serverId })} servers={servers} />
      <div className="wf-form-row">
        <label>Port override</label>
        <input
          type="number"
          value={data.portOverride ?? ''}
          placeholder="Use definition port"
          onChange={e => onChange({
            portOverride: e.target.value ? parseInt(e.target.value, 10) : undefined,
          })}
          data-testid="api-mock-wf-port-override"
        />
      </div>
      <div className="wf-form-row">
        <label>Isolate run</label>
        <button
          type="button"
          className={`am-toggle${data.isolateRun !== false ? ' on' : ''}`}
          role="switch"
          aria-checked={data.isolateRun !== false}
          onClick={() => onChange({ isolateRun: data.isolateRun === false })}
          data-testid="api-mock-wf-isolate"
        />
        <span className="wf-hint">Ephemeral server id + auto cleanup</span>
      </div>
      <div data-testid="api-mock-wf-port-vars">
        <div className="wf-form-row">
          <label>Save port as</label>
          <input
            value={data.savePortAs ?? 'mockPort'}
            onChange={e => onChange({ savePortAs: e.target.value })}
            data-testid="api-mock-wf-save-port"
            aria-label="Save port as"
          />
        </div>
        <div className="wf-form-row">
          <label>Save base URL as</label>
          <input
            value={data.saveBaseUrlAs ?? 'mockBaseUrl'}
            onChange={e => onChange({ saveBaseUrlAs: e.target.value })}
            data-testid="api-mock-wf-save-base-url"
            aria-label="Save base URL as"
          />
        </div>
      </div>
      <OnErrorRow value={data.onError} onChange={onError => onChange({ onError })} />
    </div>
  );
}

export function ApiMockApplyConfig({
  data,
  onChange,
}: {
  data: ApiMockApplyNodeData;
  onChange: (patch: Partial<ApiMockApplyNodeData>) => void;
}) {
  const servers = useMockServers();
  return (
    <div className="wf-config-section" data-testid="api-mock-apply-config">
      <ServerPicker value={data.serverId} onChange={serverId => onChange({ serverId })} servers={servers} />
      <p className="wf-hint" data-testid="api-mock-wf-apply-isolate-hint">
        For isolated runs, set serverId to `{'{{mockServerId}}'}` from Start.
      </p>
      <OnErrorRow value={data.onError} onChange={onError => onChange({ onError })} />
    </div>
  );
}

export function ApiMockResetStateConfig({
  data,
  onChange,
}: {
  data: ApiMockResetStateNodeData;
  onChange: (patch: Partial<ApiMockResetStateNodeData>) => void;
}) {
  const servers = useMockServers();
  return (
    <div className="wf-config-section" data-testid="api-mock-reset-config">
      <ServerPicker value={data.serverId} onChange={serverId => onChange({ serverId })} servers={servers} />
      <p className="wf-hint" data-testid="api-mock-wf-reset-option">
        Rewinds scenario state, sequence cursors, and match counters on the running listener.
      </p>
      <OnErrorRow value={data.onError} onChange={onError => onChange({ onError })} />
    </div>
  );
}

export function ApiMockStopConfig({
  data,
  onChange,
}: {
  data: ApiMockStopNodeData;
  onChange: (patch: Partial<ApiMockStopNodeData>) => void;
}) {
  const servers = useMockServers();
  return (
    <div className="wf-config-section" data-testid="api-mock-stop-config">
      <ServerPicker value={data.serverId} onChange={serverId => onChange({ serverId })} servers={servers} />
      <div className="wf-form-row">
        <label>Idempotent</label>
        <button
          type="button"
          className={`am-toggle${data.idempotent !== false ? ' on' : ''}`}
          role="switch"
          aria-checked={data.idempotent !== false}
          onClick={() => onChange({ idempotent: data.idempotent === false })}
        />
      </div>
      <OnErrorRow value={data.onError} onChange={onError => onChange({ onError })} />
    </div>
  );
}

export function ApiMockAssertCallsConfig({
  data,
  onChange,
}: {
  data: ApiMockAssertCallsNodeData;
  onChange: (patch: Partial<ApiMockAssertCallsNodeData>) => void;
}) {
  const servers = useMockServers();
  return (
    <div className="wf-config-section" data-testid="api-mock-assert-config">
      <ServerPicker value={data.serverId} onChange={serverId => onChange({ serverId })} servers={servers} />
      <div className="wf-form-row">
        <label>Route id</label>
        <input value={data.routeId ?? ''} onChange={e => onChange({ routeId: e.target.value || undefined })} />
      </div>
      <div className="wf-form-row">
        <label>Variant id</label>
        <input value={data.matchedResponseId ?? ''} onChange={e => onChange({ matchedResponseId: e.target.value || undefined })} />
      </div>
      <div className="wf-form-row">
        <label>Exact count</label>
        <input
          type="number"
          value={data.expectedCount ?? ''}
          onChange={e => onChange({ expectedCount: e.target.value ? parseInt(e.target.value, 10) : undefined })}
        />
      </div>
      <div className="wf-form-row">
        <label>Min count</label>
        <input
          type="number"
          value={data.expectedMinCount ?? ''}
          onChange={e => onChange({ expectedMinCount: e.target.value ? parseInt(e.target.value, 10) : undefined })}
          data-testid="api-mock-wf-assert-min"
          aria-label="Min call count"
        />
      </div>
      <div className="wf-form-row">
        <label>Max count</label>
        <input
          type="number"
          value={data.expectedMaxCount ?? ''}
          onChange={e => onChange({ expectedMaxCount: e.target.value ? parseInt(e.target.value, 10) : undefined })}
        />
      </div>
      <div className="wf-form-row">
        <label>Status</label>
        <input
          type="number"
          value={data.expectedStatus ?? ''}
          onChange={e => onChange({ expectedStatus: e.target.value ? parseInt(e.target.value, 10) : undefined })}
          data-testid="api-mock-wf-assert-status"
          aria-label="Expected status"
        />
      </div>
      <div className="wf-form-row">
        <label>Body contains</label>
        <input
          value={data.expectedBodyContains ?? ''}
          onChange={e => onChange({ expectedBodyContains: e.target.value || undefined })}
          data-testid="api-mock-wf-assert-body"
          aria-label="Body contains"
        />
      </div>
      <div className="wf-form-row">
        <label>Header key</label>
        <input
          value={data.expectedHeaderKey ?? ''}
          onChange={e => onChange({ expectedHeaderKey: e.target.value || undefined })}
          data-testid="api-mock-wf-assert-header"
          aria-label="Header key"
        />
      </div>
      <div className="wf-form-row">
        <label>Header value</label>
        <input
          value={data.expectedHeaderValue ?? ''}
          onChange={e => onChange({ expectedHeaderValue: e.target.value || undefined })}
          data-testid="api-mock-wf-assert-header-value"
          aria-label="Header value"
        />
      </div>
      <div className="wf-form-row">
        <label>Last call within (ms)</label>
        <input
          type="number"
          value={data.expectedLastCallWithinMs ?? ''}
          onChange={e => onChange({
            expectedLastCallWithinMs: e.target.value ? parseInt(e.target.value, 10) : undefined,
          })}
          data-testid="api-mock-wf-assert-recency"
          aria-label="Last call within milliseconds"
        />
      </div>
      <OnErrorRow value={data.onError} onChange={onError => onChange({ onError })} />
    </div>
  );
}
