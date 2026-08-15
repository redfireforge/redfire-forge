/**
 * Phase 9D — response transforms + outbound callbacks editor (variant-scoped).
 */
import { useState, type ReactNode } from 'react';
import type { ApiMockResponseVariantV1 } from '../../../shared/api-mock/contracts';
import type { ApiMockCallbackV1, ApiMockTransformRuleV1 } from '../../../shared/api-mock/callbackContracts';
import { DEFAULT_CALLBACK } from '../../../shared/api-mock/callbackContracts';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { ChevronRightIcon, PlusIcon, TrashIcon, WebhookIcon, WorkflowIcon } from './ApiMockIcons';

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

const CALLBACK_METHODS: Array<{ value: ApiMockCallbackV1['method']; label: string }> = [
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
];

const PIPELINE_STEPS = ['Template', 'Transforms', 'Client'] as const;

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

function OutboundCard({
  icon,
  title,
  hint,
  count,
  addTestId,
  onAdd,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  count: number;
  addTestId: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="am-outbound-card">
      <div className="am-outbound-card-head">
        <span className="am-outbound-card-icon" aria-hidden="true">{icon}</span>
        <div className="am-outbound-card-copy">
          <div className="am-outbound-card-title">{title}</div>
          <div className="am-outbound-card-hint">{hint}</div>
        </div>
        <span className="am-count-badge">{count}</span>
        <span className="am-spacer" />
        <button type="button" className="am-btn small" onClick={onAdd} data-testid={addTestId}>
          <PlusIcon size={12} />
          + Add
        </button>
      </div>
      {children}
    </section>
  );
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
    <div className="am-outbound" data-testid="api-mock-variant-outbound">
      <div className="am-outbound-pipeline" data-testid="api-mock-outbound-pipeline">
        <div className="am-outbound-steps" aria-label="Outbound order">
          {PIPELINE_STEPS.map((label, i) => (
            <span key={label} className="am-outbound-step-cluster">
              {i > 0 && <ChevronRightIcon size={12} className="am-icon am-outbound-arrow" />}
              <span className="am-outbound-step">
                <span className="am-outbound-step-num">{i + 1}</span>
                {label}
              </span>
            </span>
          ))}
          <span className="am-outbound-then">then</span>
          <span className="am-outbound-step am-outbound-step--later">
            <span className="am-outbound-step-num">4</span>
            Callbacks
          </span>
        </div>
        <p className="am-outbound-pipeline-hint">
          Transforms rewrite the rendered body before delivery. Callbacks fire after the
          client is answered and never change the mock reply. Allowlist URLs under
          Settings → Callbacks.
        </p>
      </div>

      <OutboundCard
        icon={<WorkflowIcon size={15} />}
        title="Transforms"
        hint="After templates, before the client reads the response"
        count={transforms.length}
        addTestId="api-mock-transform-add"
        onAdd={addTransform}
      >
        {transforms.length === 0 ? (
          <div className="am-outbound-empty" data-testid="api-mock-transform-empty">
            <WorkflowIcon size={18} />
            <p>No transforms — response is delivered as rendered.</p>
          </div>
        ) : (
          <div className="am-outbound-list">
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
                  <TrashIcon size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </OutboundCard>

      <OutboundCard
        icon={<WebhookIcon size={15} />}
        title="Callbacks"
        hint="After delivery — failures never change the mock reply"
        count={callbacks.length}
        addTestId="api-mock-callback-add"
        onAdd={addCallback}
      >
        {callbacks.length === 0 ? (
          <div className="am-outbound-empty" data-testid="api-mock-callback-empty">
            <WebhookIcon size={18} />
            <p>No outbound callbacks for this variant.</p>
          </div>
        ) : (
          <div className="am-outbound-list">
            {callbacks.map(cb => (
              <article key={cb.id} className="am-outbound-callback" data-testid={`api-mock-callback-${cb.id}`}>
                <div className="am-outbound-callback-head">
                  <span className={`am-method ${cb.method.toLowerCase()}`}>{cb.method}</span>
                  <span className="am-outbound-callback-url" title={cb.url || undefined}>
                    {cb.url.trim() || 'Untitled callback'}
                  </span>
                  <span className={`am-badge${cb.enabled ? ' success' : ''}`}>{cb.enabled ? 'On' : 'Off'}</span>
                  <button type="button" className="am-btn small ghost" onClick={() => removeCallback(cb.id)}>
                    Remove
                  </button>
                </div>
                <div className="am-form-grid">
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
                      <span className="am-hint">{cb.enabled ? 'Fires after the client is answered' : 'Skipped at runtime'}</span>
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
                        options={CALLBACK_METHODS}
                        className="am-cs"
                        aria-label="Callback method"
                      />
                    </div>
                  </div>
                  <div className="am-form-row">
                    <div className="am-form-label">Timeout</div>
                    <div className="am-form-control">
                      <input
                        className="am-input num mono"
                        type="number"
                        value={cb.timeoutMs}
                        aria-label="Timeout ms"
                        onChange={e => updateCallback(cb.id, { timeoutMs: parseInt(e.target.value, 10) || 10_000 })}
                      />
                      <span className="am-hint">ms before the hook is abandoned</span>
                    </div>
                  </div>
                  <div className="am-form-row">
                    <div className="am-form-label">Retries</div>
                    <div className="am-form-control">
                      <input
                        className="am-input num mono"
                        type="number"
                        value={cb.maxRetries}
                        aria-label="Max retries"
                        data-testid={`api-mock-callback-retries-${cb.id}`}
                        onChange={e => updateCallback(cb.id, { maxRetries: parseInt(e.target.value, 10) || 0 })}
                      />
                      <span className="am-hint">extra attempts after a failed fire</span>
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
              </article>
            ))}
          </div>
        )}
      </OutboundCard>
    </div>
  );
}
