import { useState } from 'react';
import type { WorkflowNode, HttpNodeData, ConditionNodeData, DelayNodeData, WorkflowNodeData } from '../../types/workflow';
import type { Scenario, Extraction, ExtractionSource, KeyValue } from '../../types';
import ExtractionEditor from '../ExtractionEditor';

interface Props {
  node: WorkflowNode | null;
  variables: Record<string, string>;
  onUpdateNode: (id: string, data: WorkflowNodeData) => void;
  onDeleteNode: (id: string) => void;
  onUpdateVariables: (variables: Record<string, string>) => void;
}

type HttpTab = 'url' | 'headers' | 'body' | 'auth' | 'extract';

export default function WorkflowConfigPanel({ node, variables, onUpdateNode, onDeleteNode, onUpdateVariables }: Props) {
  const [httpTab, setHttpTab] = useState<HttpTab>('url');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  if (!node) {
    return (
      <div className="wf-config-panel">
        <div className="wf-config-empty">
          <p>Select a node to configure</p>
          <p className="wf-config-hint">Click any step on the canvas, or add one from the palette</p>
        </div>
        <VariablesSection
          variables={variables}
          onUpdateVariables={onUpdateVariables}
          newVarKey={newVarKey}
          setNewVarKey={setNewVarKey}
          newVarValue={newVarValue}
          setNewVarValue={setNewVarValue}
        />
      </div>
    );
  }

  return (
    <div className="wf-config-panel">
      <div className="wf-config-header">
        <span className="wf-config-type">{node.type.toUpperCase()}</span>
        <button className="btn btn-sm btn-danger" onClick={() => onDeleteNode(node.id)} title="Delete node">×</button>
      </div>

      {node.type === 'http' && (
        <HttpConfig
          data={node.data as HttpNodeData}
          onChange={(data) => onUpdateNode(node.id, data)}
          activeTab={httpTab}
          onTabChange={setHttpTab}
        />
      )}

      {node.type === 'condition' && (
        <ConditionConfig
          data={node.data as ConditionNodeData}
          onChange={(data) => onUpdateNode(node.id, data)}
        />
      )}

      {node.type === 'delay' && (
        <DelayConfig
          data={node.data as DelayNodeData}
          onChange={(data) => onUpdateNode(node.id, data)}
        />
      )}

      <VariablesSection
        variables={variables}
        onUpdateVariables={onUpdateVariables}
        newVarKey={newVarKey}
        setNewVarKey={setNewVarKey}
        newVarValue={newVarValue}
        setNewVarValue={setNewVarValue}
      />
    </div>
  );
}

// ── HTTP Config ───────────────────────────────────────

function HttpConfig({ data, onChange, activeTab, onTabChange }: {
  data: HttpNodeData;
  onChange: (data: HttpNodeData) => void;
  activeTab: HttpTab;
  onTabChange: (tab: HttpTab) => void;
}) {
  const s = data.scenario;
  const update = (patch: Partial<Scenario>) => onChange({ ...data, scenario: { ...s, ...patch } });

  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-url-row">
        <select value={s.method} onChange={(e) => update({ method: e.target.value as Scenario['method'] })} className="wf-config-method-select">
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
        </select>
        <input value={s.url} onChange={(e) => update({ url: e.target.value })} placeholder="https://api.example.com/..." className="wf-config-url-input" />
      </div>

      <div className="wf-config-tabs">
        {(['url', 'headers', 'body', 'auth', 'extract'] as HttpTab[]).map(tab => (
          <button key={tab} className={`wf-config-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => onTabChange(tab)}>
            {tab === 'url' ? 'Params' : tab === 'extract' ? 'Extract' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'extract' && (s.extractions?.length ?? 0) > 0 && <span className="tab-badge">{s.extractions!.length}</span>}
            {tab === 'headers' && s.headers.filter(h => h.key.trim()).length > 0 && <span className="tab-badge">{s.headers.filter(h => h.key.trim()).length}</span>}
          </button>
        ))}
      </div>

      <div className="wf-config-tab-content">
        {activeTab === 'url' && (
          <div className="wf-config-hint-text">
            Use <code>{'{{variable}}'}</code> in the URL. Query params are part of the URL.
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="wf-config-kv-list">
            {s.headers.map((h, i) => (
              <div key={i} className="wf-config-kv-row">
                <input value={h.key} placeholder="Header name" onChange={(e) => {
                  const next = [...s.headers]; next[i] = { ...h, key: e.target.value }; update({ headers: next });
                }} />
                <input value={h.value} placeholder="Value (supports {{var}})" onChange={(e) => {
                  const next = [...s.headers]; next[i] = { ...h, value: e.target.value }; update({ headers: next });
                }} />
                <button className="btn btn-sm btn-danger" onClick={() => update({ headers: s.headers.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => update({ headers: [...s.headers, { key: '', value: '' }] })}>+ Add Header</button>
          </div>
        )}

        {activeTab === 'body' && (
          <div className="wf-config-field">
            <label>Body (supports {'{{var}}'})</label>
            <textarea
              value={s.body}
              onChange={(e) => update({ body: e.target.value })}
              placeholder='{"key": "{{value}}"}'
              rows={6}
              className="wf-config-textarea"
            />
          </div>
        )}

        {activeTab === 'auth' && (
          <div className="wf-config-field">
            <label>Auth Type</label>
            <select value={s.auth.type} onChange={(e) => update({ auth: { ...s.auth, type: e.target.value as Scenario['auth']['type'] } })}>
              <option value="none">None</option>
              <option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option>
              <option value="apikey">API Key</option>
            </select>
            {s.auth.type === 'bearer' && (
              <div className="wf-config-field" style={{ marginTop: 6 }}>
                <label>Token (supports {'{{var}}'})</label>
                <input value={s.auth.token ?? ''} onChange={(e) => update({ auth: { ...s.auth, token: e.target.value } })} placeholder="{{authToken}}" />
              </div>
            )}
            {s.auth.type === 'basic' && (
              <>
                <div className="wf-config-field" style={{ marginTop: 6 }}>
                  <label>Username</label>
                  <input value={s.auth.username ?? ''} onChange={(e) => update({ auth: { ...s.auth, username: e.target.value } })} />
                </div>
                <div className="wf-config-field">
                  <label>Password</label>
                  <input value={s.auth.password ?? ''} onChange={(e) => update({ auth: { ...s.auth, password: e.target.value } })} type="password" />
                </div>
              </>
            )}
            {s.auth.type === 'apikey' && (
              <>
                <div className="wf-config-field" style={{ marginTop: 6 }}>
                  <label>Key Name</label>
                  <input value={s.auth.apiKeyName ?? ''} onChange={(e) => update({ auth: { ...s.auth, apiKeyName: e.target.value } })} />
                </div>
                <div className="wf-config-field">
                  <label>Key Value</label>
                  <input value={s.auth.apiKeyValue ?? ''} onChange={(e) => update({ auth: { ...s.auth, apiKeyValue: e.target.value } })} />
                </div>
                <div className="wf-config-field">
                  <label>Send In</label>
                  <select value={s.auth.apiKeyIn ?? 'header'} onChange={(e) => update({ auth: { ...s.auth, apiKeyIn: e.target.value as 'header' | 'query' } })}>
                    <option value="header">Header</option>
                    <option value="query">Query Parameter</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'extract' && (
          <ExtractionEditor
            extractions={s.extractions ?? []}
            onChange={(extractions) => update({ extractions })}
          />
        )}
      </div>
    </div>
  );
}

// ── Condition Config ──────────────────────────────────

function ConditionConfig({ data, onChange }: { data: ConditionNodeData; onChange: (d: ConditionNodeData) => void }) {
  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>
      <div className="wf-config-field">
        <label>Left (variable or value)</label>
        <input value={data.left} onChange={(e) => onChange({ ...data, left: e.target.value })} placeholder="{{status}}" />
      </div>
      <div className="wf-config-field">
        <label>Operator</label>
        <select value={data.operator} onChange={(e) => onChange({ ...data, operator: e.target.value as ConditionNodeData['operator'] })}>
          <option value="==">== (equals)</option>
          <option value="!=">!= (not equals)</option>
          <option value=">">{'>'} (greater than)</option>
          <option value="<">{'<'} (less than)</option>
          <option value=">=">{'≥'} (greater or equal)</option>
          <option value="<=">{'≤'} (less or equal)</option>
          <option value="contains">contains</option>
          <option value="not-contains">not contains</option>
          <option value="regex">regex match</option>
        </select>
      </div>
      <div className="wf-config-field">
        <label>Right (value to compare)</label>
        <input value={data.right} onChange={(e) => onChange({ ...data, right: e.target.value })} placeholder="200" />
      </div>
    </div>
  );
}

// ── Delay Config ──────────────────────────────────────

function DelayConfig({ data, onChange }: { data: DelayNodeData; onChange: (d: DelayNodeData) => void }) {
  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>
      <div className="wf-config-field">
        <label>Mode</label>
        <select value={data.mode} onChange={(e) => onChange({ ...data, mode: e.target.value as 'fixed' | 'random' })}>
          <option value="fixed">Fixed</option>
          <option value="random">Random Range</option>
        </select>
      </div>
      {data.mode === 'fixed' && (
        <div className="wf-config-field">
          <label>Delay (ms)</label>
          <input type="number" min={0} max={60000} value={data.delayMs} onChange={(e) => onChange({ ...data, delayMs: parseInt(e.target.value) || 0 })} />
        </div>
      )}
      {data.mode === 'random' && (
        <>
          <div className="wf-config-field">
            <label>Min (ms)</label>
            <input type="number" min={0} value={data.minMs ?? 0} onChange={(e) => onChange({ ...data, minMs: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="wf-config-field">
            <label>Max (ms)</label>
            <input type="number" min={0} value={data.maxMs ?? data.delayMs} onChange={(e) => onChange({ ...data, maxMs: parseInt(e.target.value) || 0 })} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Variables Section ─────────────────────────────────

function VariablesSection({ variables, onUpdateVariables, newVarKey, setNewVarKey, newVarValue, setNewVarValue }: {
  variables: Record<string, string>;
  onUpdateVariables: (v: Record<string, string>) => void;
  newVarKey: string; setNewVarKey: (s: string) => void;
  newVarValue: string; setNewVarValue: (s: string) => void;
}) {
  const entries = Object.entries(variables);

  const addVar = () => {
    const key = newVarKey.trim().replace(/[{}]/g, '');
    if (!key) return;
    onUpdateVariables({ ...variables, [key]: newVarValue });
    setNewVarKey('');
    setNewVarValue('');
  };

  return (
    <div className="wf-config-vars">
      <div className="wf-config-vars-title">Initial Variables</div>
      <p className="wf-config-hint-text" style={{ marginBottom: 6 }}>
        Available as <code>{'{{name}}'}</code> in all steps. Generators: <code>{'{{$uuid}}'}</code>, <code>{'{{$timestamp}}'}</code>
      </p>
      {entries.map(([key, value]) => (
        <div key={key} className="wf-config-kv-row">
          <span className="wf-var-key-label">{`{{${key}}}`}</span>
          <input value={value} onChange={(e) => onUpdateVariables({ ...variables, [key]: e.target.value })} />
          <button className="btn btn-sm btn-danger" onClick={() => {
            const next = { ...variables }; delete next[key]; onUpdateVariables(next);
          }}>×</button>
        </div>
      ))}
      <div className="wf-config-kv-row">
        <input value={newVarKey} onChange={(e) => setNewVarKey(e.target.value)} placeholder="name" onKeyDown={(e) => e.key === 'Enter' && addVar()} className="wf-var-add-key" />
        <input value={newVarValue} onChange={(e) => setNewVarValue(e.target.value)} placeholder="value" onKeyDown={(e) => e.key === 'Enter' && addVar()} />
        <button className="btn btn-sm" onClick={addVar}>+</button>
      </div>
    </div>
  );
}
