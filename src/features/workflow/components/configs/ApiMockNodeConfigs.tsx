/**
 * Phase 11 — config panels for API Mock workflow nodes.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type {
  ApiMockApplyNodeData,
  ApiMockAssertCallsNodeData,
  ApiMockResetStateNodeData,
  ApiMockStartNodeData,
  ApiMockStopNodeData,
} from '../../types/workflow/node-api-mock';
import { API_MOCK_WORKSPACE_CHANGED_EVENT } from '../../../api-mock/apiMockGalleryImport';
import {
  API_MOCK_RUNTIME_CHANGED_EVENT,
  API_MOCK_WORKSPACE_PERSISTED_EVENT,
  loadApiMockWorkspace,
  peekApiMockWorkspaceSnapshot,
} from '../../../api-mock/apiMockPersistence';
import { CustomSelect } from '@shared/components/CustomSelect';
import {
  GqlWfFormCard,
  GqlWfFormRow,
  GqlWfSectionToolbar,
} from '@graphql/components/GraphqlWfConfigLayout';
import { pickHealedMockServerId } from './apiMockNodeConfigHelpers';

interface ServerOpt { id: string; name: string; port: number }

function serversFromWorkspace(ws: {
  servers: Array<{ id: string; name: string; port: number }>;
  activeServerId?: string;
}): { servers: ServerOpt[]; activeServerId?: string } {
  return {
    servers: ws.servers.map(s => ({ id: s.id, name: s.name, port: s.port })),
    activeServerId: ws.activeServerId,
  };
}

function useMockServers() {
  const [state, setState] = useState(() => {
    const peeked = peekApiMockWorkspaceSnapshot();
    return peeked ? serversFromWorkspace(peeked) : { servers: [] as ServerOpt[], activeServerId: undefined as string | undefined };
  });
  useEffect(() => {
    const reload = () => {
      void loadApiMockWorkspace().then(ws => setState(serversFromWorkspace(ws)));
    };
    reload();
    window.addEventListener(API_MOCK_WORKSPACE_CHANGED_EVENT, reload);
    window.addEventListener(API_MOCK_WORKSPACE_PERSISTED_EVENT, reload);
    window.addEventListener(API_MOCK_RUNTIME_CHANGED_EVENT, reload);
    return () => {
      window.removeEventListener(API_MOCK_WORKSPACE_CHANGED_EVENT, reload);
      window.removeEventListener(API_MOCK_WORKSPACE_PERSISTED_EVENT, reload);
      window.removeEventListener(API_MOCK_RUNTIME_CHANGED_EVENT, reload);
    };
  }, []);
  return state;
}

function AmWfBody({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <div className="wf-config-body gql-wf-config am-wf-config" data-testid={testId}>
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
  onHint,
  offHint,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  onHint: string;
  offHint: string;
  testId?: string;
}) {
  return (
    <GqlWfFormRow label={label}>
      <label className="am-wf-check">
        <input
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          data-testid={testId}
          onChange={e => onChange(e.target.checked)}
        />
        <span className="am-wf-hint">{checked ? onHint : offHint}</span>
      </label>
    </GqlWfFormRow>
  );
}

function ServerPicker({
  value,
  onChange,
  servers,
  activeServerId,
}: {
  value: string;
  onChange: (id: string) => void;
  servers: ServerOpt[];
  activeServerId?: string;
}) {
  useEffect(() => {
    const next = pickHealedMockServerId(servers, value, activeServerId);
    if (next && next !== value) onChange(next);
  }, [activeServerId, onChange, servers, value]);

  return (
    <GqlWfFormRow label="Mock server">
      <div
        className="am-wf-server-host"
        data-testid="api-mock-wf-server-host"
        data-count={String(servers.length)}
      >
        <CustomSelect
          className="am-wf-select"
          value={value}
          onChange={onChange}
          options={
            servers.length === 0
              ? [{ value: '', label: 'No Studio servers', disabled: true }]
              : [
                { value: '', label: 'Select server…' },
                ...servers.map(s => ({ value: s.id, label: `${s.name} (:${s.port})` })),
              ]
          }
          placeholder={servers.length === 0 ? 'No Studio servers' : 'Select server…'}
          aria-label="Mock server"
          data-testid="api-mock-wf-server"
        />
      </div>
    </GqlWfFormRow>
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
    <GqlWfFormRow label="On error">
      <CustomSelect
        className="am-wf-select"
        value={value ?? 'fail'}
        onChange={v => onChange(v as 'fail' | 'continue')}
        options={[
          { value: 'fail', label: 'Fail workflow' },
          { value: 'continue', label: 'Continue' },
        ]}
        aria-label="On error"
      />
    </GqlWfFormRow>
  );
}

export function ApiMockStartConfig({
  data,
  onChange,
}: {
  data: ApiMockStartNodeData;
  onChange: (patch: Partial<ApiMockStartNodeData>) => void;
}) {
  const { servers, activeServerId } = useMockServers();
  const isolateOn = data.isolateRun !== false;
  return (
    <AmWfBody testId="api-mock-start-config">
      <GqlWfSectionToolbar
        title="Listener"
        subtitle="Which Studio mock this step starts"
      />
      <GqlWfFormCard>
        <ServerPicker value={data.serverId} onChange={serverId => onChange({ serverId })} servers={servers} activeServerId={activeServerId} />
        <GqlWfFormRow label="Port override">
          <input
            type="number"
            value={data.portOverride ?? ''}
            placeholder="Use definition port"
            onChange={e => onChange({
              portOverride: e.target.value ? parseInt(e.target.value, 10) : undefined,
            })}
            data-testid="api-mock-wf-port-override"
          />
        </GqlWfFormRow>
        <SwitchRow
          label="Isolate run"
          checked={isolateOn}
          onChange={checked => onChange({ isolateRun: checked })}
          onHint="Throwaway copy — Stop Mock Server cleans it up"
          offHint="Use Studio's mock as-is"
          testId="api-mock-wf-isolate"
        />
      </GqlWfFormCard>

      <GqlWfSectionToolbar
        title="Outputs"
        subtitle="Variable names downstream steps can read"
      />
      <GqlWfFormCard>
        <div data-testid="api-mock-wf-port-vars">
          <GqlWfFormRow label="Save port as">
            <input
              value={data.savePortAs ?? 'mockPort'}
              onChange={e => onChange({ savePortAs: e.target.value })}
              data-testid="api-mock-wf-save-port"
              aria-label="Save port as"
            />
          </GqlWfFormRow>
          <GqlWfFormRow label="Save base URL as">
            <input
              value={data.saveBaseUrlAs ?? 'mockBaseUrl'}
              onChange={e => onChange({ saveBaseUrlAs: e.target.value })}
              data-testid="api-mock-wf-save-base-url"
              aria-label="Save base URL as"
            />
          </GqlWfFormRow>
        </div>
      </GqlWfFormCard>

      <GqlWfFormCard>
        <OnErrorRow value={data.onError} onChange={onError => onChange({ onError })} />
      </GqlWfFormCard>
    </AmWfBody>
  );
}

export function ApiMockApplyConfig({
  data,
  onChange,
}: {
  data: ApiMockApplyNodeData;
  onChange: (patch: Partial<ApiMockApplyNodeData>) => void;
}) {
  const { servers, activeServerId } = useMockServers();
  return (
    <AmWfBody testId="api-mock-apply-config">
      <GqlWfSectionToolbar
        title="Definition"
        subtitle="Hot-swap routes on the running listener"
      />
      <GqlWfFormCard>
        <ServerPicker value={data.serverId} onChange={serverId => onChange({ serverId })} servers={servers} activeServerId={activeServerId} />
        <GqlWfFormRow label="Isolated runs">
          <p className="am-wf-hint" data-testid="api-mock-wf-apply-isolate-hint">
            Set server to <code>{'{{mockServerId}}'}</code> from Start Mock Server
          </p>
        </GqlWfFormRow>
        <OnErrorRow value={data.onError} onChange={onError => onChange({ onError })} />
      </GqlWfFormCard>
    </AmWfBody>
  );
}

const RESET_CLEARS = [
  { name: 'Scenario state', desc: 'Stateful rule variables return to the start' },
  { name: 'Sequence cursors', desc: 'The next-variant pointer goes back to the first slot' },
  { name: 'Match counters', desc: 'Per-rule hit counts used by limits and asserts' },
] as const;

export function ApiMockResetStateConfig({
  data,
  onChange,
}: {
  data: ApiMockResetStateNodeData;
  onChange: (patch: Partial<ApiMockResetStateNodeData>) => void;
}) {
  const { servers, activeServerId } = useMockServers();
  return (
    <AmWfBody testId="api-mock-reset-config">
      <GqlWfSectionToolbar
        title="Listener"
        subtitle="Which running mock this step rewinds"
      />
      <GqlWfFormCard>
        <ServerPicker value={data.serverId} onChange={serverId => onChange({ serverId })} servers={servers} activeServerId={activeServerId} />
        <OnErrorRow value={data.onError} onChange={onError => onChange({ onError })} />
      </GqlWfFormCard>

      <GqlWfSectionToolbar
        title="Clears"
        subtitle="Always all three — there is no partial reset"
      />
      <GqlWfFormCard>
        <div className="am-wf-reset-grid" data-testid="api-mock-wf-reset-option">
          {RESET_CLEARS.map(item => (
            <div className="am-wf-reset-tile" key={item.name}>
              <span className="am-wf-reset-name">{item.name}</span>
              <span className="am-wf-reset-desc">{item.desc}</span>
            </div>
          ))}
        </div>
      </GqlWfFormCard>
    </AmWfBody>
  );
}

export function ApiMockStopConfig({
  data,
  onChange,
}: {
  data: ApiMockStopNodeData;
  onChange: (patch: Partial<ApiMockStopNodeData>) => void;
}) {
  const { servers, activeServerId } = useMockServers();
  return (
    <AmWfBody testId="api-mock-stop-config">
      <GqlWfSectionToolbar
        title="Stop"
        subtitle="Tear down the listener this graph started"
      />
      <GqlWfFormCard>
        <ServerPicker value={data.serverId} onChange={serverId => onChange({ serverId })} servers={servers} activeServerId={activeServerId} />
        <SwitchRow
          label="Idempotent"
          checked={data.idempotent !== false}
          onChange={checked => onChange({ idempotent: checked })}
          onHint="Already stopped is still success"
          offHint="Missing or stopped is an error"
        />
        <OnErrorRow value={data.onError} onChange={onError => onChange({ onError })} />
      </GqlWfFormCard>
    </AmWfBody>
  );
}

function parseOptionalInt(value: string): number | undefined {
  return value ? parseInt(value, 10) : undefined;
}

function AmWfMiniField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  testId,
  ariaLabel,
  narrow,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  testId?: string;
  ariaLabel?: string;
  narrow?: boolean;
}) {
  return (
    <div className={`am-wf-mini${narrow ? ' am-wf-mini--narrow' : ''}`}>
      <label className="am-wf-mini-label">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        data-testid={testId}
        aria-label={ariaLabel ?? label}
      />
    </div>
  );
}

interface AssertHeaderRow {
  key: string;
  value: string;
}

function assertHeaderRows(data: ApiMockAssertCallsNodeData): AssertHeaderRow[] {
  if (data.expectedHeaders && data.expectedHeaders.length > 0) {
    return data.expectedHeaders.map(header => ({
      key: header.key ?? '',
      value: header.value ?? '',
    }));
  }
  if (data.expectedHeaderKey || data.expectedHeaderValue) {
    return [{ key: data.expectedHeaderKey ?? '', value: data.expectedHeaderValue ?? '' }];
  }
  return [{ key: '', value: '' }];
}

function commitAssertHeaders(
  rows: AssertHeaderRow[],
  onChange: (patch: Partial<ApiMockAssertCallsNodeData>) => void,
) {
  const named = rows.filter(row => row.key.trim());
  const first = named[0];
  const persistList = rows.length > 1 || rows.some(row => row.key.trim() || row.value.trim());
  onChange({
    expectedHeaders: persistList ? rows : undefined,
    expectedHeaderKey: first?.key.trim() || undefined,
    expectedHeaderValue: first?.value.trim() || undefined,
  });
}

function AmWfHeaderList({
  rows,
  onChange,
}: {
  rows: AssertHeaderRow[];
  onChange: (rows: AssertHeaderRow[]) => void;
}) {
  return (
    <div className="am-wf-header-list" data-testid="api-mock-wf-assert-headers">
      <div className="am-wf-header-cols" aria-hidden="true">
        <span>Name</span>
        <span>Value</span>
        <span className="am-wf-header-cols-action" />
      </div>
      {rows.map((row, index) => (
        <div className="am-wf-header-row" key={index}>
          <input
            value={row.key}
            placeholder="e.g. X-Request-Id"
            aria-label={index === 0 ? 'Header key' : `Header ${index + 1} name`}
            data-testid={index === 0 ? 'api-mock-wf-assert-header' : `api-mock-wf-assert-header-${index}`}
            onChange={e => onChange(rows.map((item, i) => (
              i === index ? { ...item, key: e.target.value } : item
            )))}
          />
          <input
            value={row.value}
            placeholder="Optional — present if blank"
            aria-label={index === 0 ? 'Header value' : `Header ${index + 1} value`}
            data-testid={index === 0 ? 'api-mock-wf-assert-header-value' : `api-mock-wf-assert-header-value-${index}`}
            onChange={e => onChange(rows.map((item, i) => (
              i === index ? { ...item, value: e.target.value } : item
            )))}
          />
          <button
            type="button"
            className="btn btn-sm btn-ghost am-wf-header-remove"
            aria-label={`Remove header ${index + 1}`}
            data-testid={index === 0 ? 'api-mock-wf-assert-header-remove' : undefined}
            onClick={() => {
              const next = rows.filter((_, i) => i !== index);
              onChange(next.length > 0 ? next : [{ key: '', value: '' }]);
            }}
          >
            Remove
          </button>
        </div>
      ))}
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
  const { servers, activeServerId } = useMockServers();
  return (
    <AmWfBody testId="api-mock-assert-config">
      <GqlWfSectionToolbar
        title="Target"
        subtitle="Which journal entries to inspect — blank route or variant matches all"
      />
      <GqlWfFormCard>
        <ServerPicker value={data.serverId} onChange={serverId => onChange({ serverId })} servers={servers} activeServerId={activeServerId} />
        <GqlWfFormRow label="Route id">
          <input
            value={data.routeId ?? ''}
            placeholder="Any route"
            onChange={e => onChange({ routeId: e.target.value || undefined })}
          />
        </GqlWfFormRow>
        <GqlWfFormRow label="Variant id">
          <input
            value={data.matchedResponseId ?? ''}
            placeholder="Any variant"
            onChange={e => onChange({ matchedResponseId: e.target.value || undefined })}
          />
        </GqlWfFormRow>
      </GqlWfFormCard>

      <GqlWfSectionToolbar
        title="Call count"
        subtitle="Leave a bound empty if you do not care about it"
      />
      <GqlWfFormCard>
        <GqlWfFormRow label="Bounds" last>
          <div className="am-wf-field-grid">
            <AmWfMiniField
              label="Exact count"
              type="number"
              narrow
              value={data.expectedCount ?? ''}
              placeholder="Any"
              onChange={value => onChange({ expectedCount: parseOptionalInt(value) })}
            />
            <AmWfMiniField
              label="Min count"
              type="number"
              narrow
              value={data.expectedMinCount ?? ''}
              placeholder="At least"
              testId="api-mock-wf-assert-min"
              ariaLabel="Min call count"
              onChange={value => onChange({ expectedMinCount: parseOptionalInt(value) })}
            />
            <AmWfMiniField
              label="Max count"
              type="number"
              narrow
              value={data.expectedMaxCount ?? ''}
              placeholder="At most"
              onChange={value => onChange({ expectedMaxCount: parseOptionalInt(value) })}
            />
          </div>
        </GqlWfFormRow>
      </GqlWfFormCard>

      <GqlWfSectionToolbar
        title="Last matching call"
        subtitle="Optional checks on the newest journal entry"
      />
      <GqlWfFormCard>
        <GqlWfFormRow label="Status">
          <input
            type="number"
            value={data.expectedStatus ?? ''}
            placeholder="e.g. 200"
            onChange={e => onChange({ expectedStatus: parseOptionalInt(e.target.value) })}
            data-testid="api-mock-wf-assert-status"
            aria-label="Expected status"
          />
        </GqlWfFormRow>
        <GqlWfFormRow label="Body" stack>
          <div className="am-wf-body-match">
            <CustomSelect
              className="am-wf-select am-wf-body-match-mode"
              value={data.expectedBodyMatch ?? 'contains'}
              onChange={value => onChange({
                expectedBodyMatch: value as 'contains' | 'equals' | 'regex',
              })}
              options={[
                { value: 'contains', label: 'Contains substring' },
                { value: 'equals', label: 'Equals exactly' },
                { value: 'regex', label: 'Matches regex' },
              ]}
              aria-label="Body match"
              data-testid="api-mock-wf-assert-body-match"
            />
            <textarea
              className="am-wf-body-editor"
              rows={8}
              spellCheck={false}
              value={data.expectedBodyContains ?? ''}
              placeholder={
                data.expectedBodyMatch === 'equals'
                  ? 'Exact response body'
                  : data.expectedBodyMatch === 'regex'
                    ? 'Regular expression, e.g. "id":\\s*"\\d+"'
                    : 'Substring in the response body'
              }
              onChange={e => onChange({ expectedBodyContains: e.target.value || undefined })}
              data-testid="api-mock-wf-assert-body"
              aria-label="Body contains"
            />
          </div>
        </GqlWfFormRow>
        <GqlWfFormRow label="Last call within" last>
          <div className="am-wf-inline-field">
            <input
              type="number"
              value={data.expectedLastCallWithinMs ?? ''}
              placeholder="Any age"
              onChange={e => onChange({
                expectedLastCallWithinMs: parseOptionalInt(e.target.value),
              })}
              data-testid="api-mock-wf-assert-recency"
              aria-label="Last call within milliseconds"
            />
            <span className="am-wf-suffix">ms</span>
          </div>
        </GqlWfFormRow>
      </GqlWfFormCard>

      <GqlWfSectionToolbar
        title="Request headers"
        subtitle="Every named row must match the newest call. Blank value = name must be present"
        actions={(
          <button
            type="button"
            className="btn btn-xs gql-wf-section-add-btn"
            data-testid="api-mock-wf-assert-header-add"
            onClick={() => commitAssertHeaders(
              [...assertHeaderRows(data), { key: '', value: '' }],
              onChange,
            )}
          >
            + Add
          </button>
        )}
      />
      <GqlWfFormCard>
        <div className="gql-wf-section-body">
          <AmWfHeaderList
            rows={assertHeaderRows(data)}
            onChange={rows => commitAssertHeaders(rows, onChange)}
          />
        </div>
      </GqlWfFormCard>

      <GqlWfFormCard>
        <OnErrorRow value={data.onError} onChange={onError => onChange({ onError })} />
      </GqlWfFormCard>
    </AmWfBody>
  );
}
