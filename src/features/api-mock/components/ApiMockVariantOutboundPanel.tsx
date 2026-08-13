/**
 * Phase 9D — response transforms + outbound callbacks editor (variant-scoped).
 */
import { useState } from 'react';
import type { ApiMockResponseVariantV1 } from '../../../shared/api-mock/contracts';
import type { ApiMockCallbackV1, ApiMockTransformRuleV1 } from '../../../shared/api-mock/callbackContracts';
import { DEFAULT_CALLBACK } from '../../../shared/api-mock/callbackContracts';
import { CustomSelect } from '../../../shared/components/CustomSelect';

interface Props {
  variant: ApiMockResponseVariantV1;
  onUpdate: (patch: Partial<ApiMockResponseVariantV1>) => void;
}

const TRANSFORM_OPS: Array<{ value: ApiMockTransformRuleV1['op']; label: string }> = [
  { value: 'setHeader', label: 'Set header' },
  { value: 'appendHeader', label: 'Append header' },
  { value: 'removeHeader', label: 'Remove header' },
  { value: 'setStatus', label: 'Set status' },
  { value: 'replaceBody', label: 'Replace body' },
];

/** Pretty-print or minify JSON callback bodies (templates must stay inside JSON strings). */
// eslint-disable-next-line react-refresh/only-export-components
export function formatCallbackBodyJson(
  raw: string,
  mode: 'pretty' | 'oneline',
): { ok: true; value: string } | { ok: false; error: string } {
  if (!raw.trim()) return { ok: false, error: 'Body is empty.' };
  try {
    const parsed = JSON.parse(raw);
    return {
      ok: true,
      value: mode === 'pretty' ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed),
    };
  } catch (err) {
    const hasTpl = /\{\{[^}]+\}\}/.test(raw);
    return {
      ok: false,
      error: hasTpl
        ? 'Body contains template expressions that break JSON parsing. Keep templates inside quoted strings, then format.'
        : err instanceof Error ? err.message : 'Body is not valid JSON.',
    };
  }
}

export function ApiMockVariantOutboundPanel({ variant, onUpdate }: Props) {
  const transforms = variant.transforms ?? [];
  const callbacks = variant.callbacks ?? [];
  const [bodyFormatError, setBodyFormatError] = useState<Record<string, string>>({});

  const updateTransform = (id: string, patch: Partial<ApiMockTransformRuleV1>) => {
    onUpdate({
      transforms: transforms.map(t => (t.id === id ? { ...t, ...patch } : t)),
    });
  };

  const addTransform = () => {
    const rule: ApiMockTransformRuleV1 = {
      id: `xf-${crypto.randomUUID().slice(0, 8)}`,
      enabled: true,
      target: 'response',
      op: 'setHeader',
      key: 'X-Mocked-By',
      value: 'RedfireForge',
    };
    onUpdate({ transforms: [...transforms, rule] });
  };

  const removeTransform = (id: string) => {
    onUpdate({ transforms: transforms.filter(t => t.id !== id) });
  };

  const updateCallback = (id: string, patch: Partial<ApiMockCallbackV1>) => {
    onUpdate({
      callbacks: callbacks.map(c => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const addCallback = () => {
    const cb: ApiMockCallbackV1 = {
      id: `cb-${crypto.randomUUID().slice(0, 8)}`,
      ...DEFAULT_CALLBACK,
    };
    onUpdate({ callbacks: [...callbacks, cb] });
  };

  const removeCallback = (id: string) => {
    onUpdate({ callbacks: callbacks.filter(c => c.id !== id) });
    setBodyFormatError(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const formatCallbackBody = (id: string, raw: string, mode: 'pretty' | 'oneline') => {
    const result = formatCallbackBodyJson(raw, mode);
    if (!result.ok) {
      setBodyFormatError(prev => ({ ...prev, [id]: result.error }));
      return;
    }
    setBodyFormatError(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    updateCallback(id, { bodyTemplate: result.value });
  };

  return (
    <div data-testid="api-mock-variant-outbound">
      <div className="am-notice info" style={{ marginBottom: 12 }}>
        <span>
          Transforms run after templates and before delivery. Callbacks fire after the client receives the response;
          failures never change the mock reply. Callback URLs must be listed under Settings → Callbacks.
        </span>
      </div>

      <div className="am-section-heading">
        Transforms
        <span className="am-count-badge">{transforms.length}</span>
        <button type="button" className="am-btn small ghost" onClick={addTransform} data-testid="api-mock-transform-add">
          + Add
        </button>
      </div>
      {transforms.length === 0 && <p className="am-muted">No transforms — response is delivered as rendered.</p>}
      {transforms.map(rule => (
        <div key={rule.id} className="am-transform-row" data-testid={`api-mock-transform-${rule.id}`}>
          <button
            type="button"
            className={`am-toggle${rule.enabled ? ' on' : ''}`}
            role="switch"
            aria-checked={rule.enabled}
            aria-label="Enable transform"
            onClick={() => updateTransform(rule.id, { enabled: !rule.enabled })}
          />
          <CustomSelect
            value={rule.op}
            onChange={v => updateTransform(rule.id, { op: v as ApiMockTransformRuleV1['op'] })}
            options={TRANSFORM_OPS}
            className="am-cs am-cs--transform-op"
            menuMinWidth={168}
            aria-label="Transform op"
            data-testid={`api-mock-transform-op-${rule.id}`}
          />
          {(rule.op === 'setHeader' || rule.op === 'appendHeader' || rule.op === 'removeHeader') && (
            <input
              className="am-input mono am-transform-field"
              value={rule.key ?? ''}
              placeholder="Header"
              aria-label="Header name"
              onChange={e => updateTransform(rule.id, { key: e.target.value })}
            />
          )}
          {rule.op !== 'removeHeader' && (
            <input
              className="am-input mono am-transform-field"
              value={rule.value ?? ''}
              placeholder={rule.op === 'setStatus' ? '200' : 'Value / template'}
              aria-label="Transform value"
              onChange={e => updateTransform(rule.id, { value: e.target.value })}
            />
          )}
          <button
            type="button"
            className="am-icon-btn"
            aria-label="Remove transform"
            onClick={() => removeTransform(rule.id)}
          >
            ×
          </button>
        </div>
      ))}

      <div className="am-section-heading" style={{ marginTop: 16 }}>
        Callbacks
        <span className="am-count-badge">{callbacks.length}</span>
        <button type="button" className="am-btn small ghost" onClick={addCallback} data-testid="api-mock-callback-add">
          + Add
        </button>
      </div>
      {callbacks.length === 0 && <p className="am-muted">No outbound callbacks for this variant.</p>}
      {callbacks.map(cb => (
        <div key={cb.id} className="am-form-grid" data-testid={`api-mock-callback-${cb.id}`} style={{ marginBottom: 10 }}>
          <div className="am-form-row">
            <div className="am-form-label">Enabled</div>
            <div className="am-form-control">
              <button
                type="button"
                className={`am-toggle${cb.enabled ? ' on' : ''}`}
                role="switch"
                aria-checked={cb.enabled}
                aria-label="Enable callback"
                data-testid={`api-mock-callback-enabled-${cb.id}`}
                onClick={() => updateCallback(cb.id, { enabled: !cb.enabled })}
              />
              <button type="button" className="am-btn small ghost" onClick={() => removeCallback(cb.id)}>Remove</button>
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">URL</div>
            <div className="am-form-control">
              <input
                className="am-input wide mono"
                value={cb.url}
                placeholder="https://hooks.example.com/mock-event"
                data-testid={`api-mock-callback-url-${cb.id}`}
                onChange={e => updateCallback(cb.id, { url: e.target.value })}
              />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Method</div>
            <div className="am-form-control">
              <CustomSelect
                value={cb.method}
                onChange={v => updateCallback(cb.id, { method: v as ApiMockCallbackV1['method'] })}
                options={[
                  { value: 'POST', label: 'POST' },
                  { value: 'PUT', label: 'PUT' },
                  { value: 'PATCH', label: 'PATCH' },
                ]}
                aria-label="Callback method"
              />
              <input
                className="am-input num mono"
                type="number"
                value={cb.timeoutMs}
                aria-label="Timeout ms"
                onChange={e => updateCallback(cb.id, { timeoutMs: parseInt(e.target.value, 10) || 10_000 })}
              />
              <span className="am-hint">timeout ms</span>
              <input
                className="am-input num mono"
                type="number"
                value={cb.maxRetries}
                aria-label="Max retries"
                onChange={e => updateCallback(cb.id, { maxRetries: parseInt(e.target.value, 10) || 0 })}
              />
              <span className="am-hint">retries</span>
            </div>
          </div>
          <div className="am-form-row am-form-row--tall am-callback-body-row">
            <div className="am-form-label">Body</div>
            <div className="am-form-control am-form-control-stack">
              <div className="am-callback-body-toolbar">
                <button
                  type="button"
                  className="am-format-badge"
                  disabled={!cb.bodyTemplate.trim()}
                  title="Pretty-print JSON"
                  aria-label="Pretty format"
                  data-testid={`api-mock-callback-pretty-${cb.id}`}
                  onClick={() => formatCallbackBody(cb.id, cb.bodyTemplate, 'pretty')}
                >
                  Pretty format
                </button>
                <button
                  type="button"
                  className="am-format-badge"
                  disabled={!cb.bodyTemplate.trim()}
                  title="Collapse JSON to one line"
                  aria-label="One line format"
                  data-testid={`api-mock-callback-oneline-${cb.id}`}
                  onClick={() => formatCallbackBody(cb.id, cb.bodyTemplate, 'oneline')}
                >
                  One line format
                </button>
              </div>
              <textarea
                className="am-textarea mono am-callback-body-editor"
                value={cb.bodyTemplate}
                spellCheck={false}
                placeholder={'{\n  "event": "mock.matched",\n  "path": "{{request.path}}"\n}'}
                data-testid={`api-mock-callback-body-${cb.id}`}
                onChange={e => {
                  setBodyFormatError(prev => {
                    if (!(cb.id in prev)) return prev;
                    const next = { ...prev };
                    delete next[cb.id];
                    return next;
                  });
                  updateCallback(cb.id, { bodyTemplate: e.target.value });
                }}
              />
              {bodyFormatError[cb.id] && (
                <div className="am-hint am-hint--error" data-testid={`api-mock-callback-format-error-${cb.id}`}>
                  {bodyFormatError[cb.id]}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
