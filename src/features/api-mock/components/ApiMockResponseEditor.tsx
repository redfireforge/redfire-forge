import { useEffect, useMemo, useState } from 'react';
import type { ApiMockRouteV1, ApiMockResponseVariantV1 } from '../../../shared/api-mock/contracts';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import { CustomSelect } from '../../../shared/components/CustomSelect';

interface Props {
  route: ApiMockRouteV1;
  onUpdateRoute: (patch: Partial<ApiMockRouteV1>) => void;
}

type ContentTab = 'content' | 'headers' | 'timing';

/**
 * Mockup 03-inspired response editor: variant sidebar + content tabs + live preview pane.
 */
export function ApiMockResponseEditor({ route, onUpdateRoute }: Props) {
  const [activeVariantId, setActiveVariantId] = useState(route.responses[0]?.id);
  const [contentTab, setContentTab] = useState<ContentTab>('content');
  useEffect(() => {
    if (!route.responses.some(v => v.id === activeVariantId)) {
      setActiveVariantId(route.responses[0]?.id);
    }
  }, [route.responses, activeVariantId]);
  const activeVariant = route.responses.find(v => v.id === activeVariantId) ?? route.responses[0];

  const previewBody = useMemo(() => {
    if (!activeVariant) return '';
    const raw = activeVariant.body.content ?? '';
    if ((activeVariant.body.contentType ?? '').includes('json')) {
      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        return raw;
      }
    }
    return raw;
  }, [activeVariant]);

  const handleAddVariant = () => {
    const id = `resp-${crypto.randomUUID().slice(0, 8)}`;
    const variant: ApiMockResponseVariantV1 = {
      ...createDefaultResponse(id),
      name: `Variant ${route.responses.length + 1}`,
      isDefault: false,
      status: 200,
    };
    onUpdateRoute({ responses: [...route.responses, variant] });
    setActiveVariantId(id);
  };

  const handleUpdateVariant = (variantId: string, patch: Partial<ApiMockResponseVariantV1>) => {
    onUpdateRoute({
      responses: route.responses.map(v => v.id === variantId ? { ...v, ...patch } : v),
    });
  };

  const handleDeleteVariant = (variantId: string) => {
    if (route.responses.length <= 1) return;
    const next = route.responses.filter(v => v.id !== variantId);
    onUpdateRoute({ responses: next });
    if (activeVariantId === variantId) setActiveVariantId(next[0]?.id);
  };

  const updateHeader = (headerId: string, patch: { key?: string; value?: string }) => {
    const variant = activeVariant as ApiMockResponseVariantV1;
    handleUpdateVariant(variant.id, {
      headers: variant.headers.map(h => h.id === headerId ? { ...h, ...patch } : h),
    });
  };

  const addHeader = () => {
    const variant = activeVariant as ApiMockResponseVariantV1;
    handleUpdateVariant(variant.id, {
      headers: [
        ...variant.headers,
        { id: `hdr-${crypto.randomUUID().slice(0, 8)}`, key: '', value: '', enabled: true },
      ],
    });
  };

  const removeHeader = (headerId: string) => {
    const variant = activeVariant as ApiMockResponseVariantV1;
    handleUpdateVariant(variant.id, {
      headers: variant.headers.filter(h => h.id !== headerId),
    });
  };

  return (
    <div className="api-mock-root api-mock-response-editor" data-testid="api-mock-response-editor">
      <div className="am-response-mode-bar">
        <CustomSelect
          value={route.responseMode}
          onChange={v => onUpdateRoute({ responseMode: v as ApiMockRouteV1['responseMode'] })}
          options={[
            { value: 'rules', label: 'Rules' },
            { value: 'sequence', label: 'Sequence' },
            { value: 'weighted', label: 'Weighted' },
            { value: 'state', label: 'State' },
          ]}
          className="am-cs"
          aria-label="Response selection mode"
          data-testid="api-mock-response-mode"
        />
        <span className="am-hint">How this rule chooses among variants</span>
      </div>

      <div className="am-response-layout">
        <aside className="am-variant-sidebar" data-testid="api-mock-variant-sidebar">
          {route.responses.map(v => (
            <button
              key={v.id}
              type="button"
              className={`am-variant-card${v.id === activeVariant?.id ? ' active' : ''}`}
              data-testid={`api-mock-variant-tab-${v.id}`}
              onClick={() => setActiveVariantId(v.id)}
            >
              <span className={`am-badge ${v.status >= 400 ? 'warning' : 'success'}`}>{v.status}</span>
              <span className="am-variant-name">{v.name}</span>
              {v.isDefault && <span className="am-badge info">Default</span>}
            </button>
          ))}
          <button className="am-btn small" onClick={handleAddVariant} aria-label="Add response variant" title="Add response variant" data-testid="api-mock-add-variant">+ Variant</button>
        </aside>

        {activeVariant && (
          <div className="am-response-main">
            <div className="am-builder-tabs" role="tablist" aria-label="Response editor sections">
              {([
                ['content', 'Content'],
                ['headers', 'Headers & cookies'],
                ['timing', 'Timing'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={contentTab === id}
                  className={`am-builder-tab${contentTab === id ? ' active' : ''}`}
                  data-testid={`api-mock-response-tab-${id}`}
                  onClick={() => setContentTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="am-editor-body">
              {contentTab === 'content' && (
                <div className="am-form-grid">
                  <div className="am-form-row">
                    <div className="am-form-label">Status</div>
                    <div className="am-form-control">
                      <input
                        className="am-input num mono"
                        type="number"
                        value={activeVariant.status}
                        onChange={e => handleUpdateVariant(activeVariant.id, { status: parseInt(e.target.value, 10) || 200 })}
                        data-testid="api-mock-variant-status"
                      />
                      <input
                        className="am-input wide"
                        value={activeVariant.name}
                        onChange={e => handleUpdateVariant(activeVariant.id, { name: e.target.value })}
                        aria-label="Variant name"
                        data-testid="api-mock-variant-name"
                      />
                    </div>
                  </div>
                  <div className="am-form-row">
                    <div className="am-form-label">Content-Type</div>
                    <div className="am-form-control">
                      <input
                        className="am-input wide mono"
                        value={activeVariant.body.contentType ?? ''}
                        placeholder="application/json"
                        onChange={e => handleUpdateVariant(activeVariant.id, {
                          body: { ...activeVariant.body, contentType: e.target.value || undefined },
                        })}
                        data-testid="api-mock-variant-content-type"
                      />
                    </div>
                  </div>
                  <div className="am-form-row">
                    <div className="am-form-label">Body</div>
                    <div className="am-form-control">
                      <textarea
                        className="am-textarea"
                        value={activeVariant.body.content}
                        onChange={e => handleUpdateVariant(activeVariant.id, {
                          body: { ...activeVariant.body, content: e.target.value },
                        })}
                        rows={10}
                        data-testid="api-mock-variant-body"
                      />
                    </div>
                  </div>
                </div>
              )}

              {contentTab === 'headers' && (
                <>
                  <div className="am-section-heading">
                    Headers
                    <span className="am-count-badge">{activeVariant.headers.length}</span>
                    <span className="am-spacer" />
                    <button type="button" className="am-btn small ghost" onClick={addHeader} data-testid="api-mock-add-header">+ Header</button>
                  </div>
                  {activeVariant.headers.length === 0 && (
                    <div className="am-empty-conditions">No custom headers.</div>
                  )}
                  {activeVariant.headers.map(h => (
                    <div key={h.id} className="am-matcher-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                      <input className="am-input mono" value={h.key} onChange={e => updateHeader(h.id, { key: e.target.value })} aria-label="Header name" />
                      <input className="am-input mono" value={h.value} onChange={e => updateHeader(h.id, { value: e.target.value })} aria-label="Header value" />
                      <button type="button" className="am-icon-btn" aria-label="Remove header" onClick={() => removeHeader(h.id)}>×</button>
                    </div>
                  ))}

                  <div className="am-section-heading">
                    Cookies
                    <span className="am-count-badge">{activeVariant.cookies.length}</span>
                  </div>
                  {activeVariant.cookies.length === 0 && (
                    <div className="am-empty-conditions">No cookies.</div>
                  )}
                  {activeVariant.cookies.map(c => (
                    <div key={c.id} className="am-matcher-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                      <input className="am-input mono" value={c.name} readOnly />
                      <input className="am-input mono" value={c.value} readOnly />
                      <span className="am-badge info">{[c.httpOnly && 'HttpOnly', c.secure && 'Secure', c.sameSite].filter(Boolean).join(' ') || '—'}</span>
                    </div>
                  ))}
                </>
              )}

              {contentTab === 'timing' && (
                <div className="am-form-grid">
                  <div className="am-form-row">
                    <div className="am-form-label">Delay (ms)</div>
                    <div className="am-form-control">
                      <input
                        className="am-input num mono"
                        type="number"
                        value={activeVariant.behavior.delayMs}
                        onChange={e => handleUpdateVariant(activeVariant.id, {
                          behavior: { ...activeVariant.behavior, delayMs: parseInt(e.target.value, 10) || 0 },
                        })}
                        data-testid="api-mock-variant-delay"
                      />
                      <span className="am-hint">Fixed latency before the response is sent</span>
                    </div>
                  </div>
                  <div className="am-form-row">
                    <div className="am-form-label">Jitter (ms)</div>
                    <div className="am-form-control">
                      <input
                        className="am-input num mono"
                        type="number"
                        value={activeVariant.behavior.jitterMs}
                        onChange={e => handleUpdateVariant(activeVariant.id, {
                          behavior: { ...activeVariant.behavior, jitterMs: parseInt(e.target.value, 10) || 0 },
                        })}
                        data-testid="api-mock-variant-jitter"
                      />
                      <span className="am-hint">± random added to delay</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="am-notice" style={{ marginTop: 12 }}>
                Template helpers: <code>{'{{uuid}}'}</code>, <code>{"{{header 'X-Tenant'}}"}</code>, <code>{'{{now}}'}</code>, <code>{'{{pathParam id}}'}</code>.
              </div>

              {route.responses.length > 1 && (
                <button
                  className="am-btn danger"
                  style={{ marginTop: 12 }}
                  onClick={() => handleDeleteVariant(activeVariant.id)}
                  data-testid="api-mock-delete-variant"
                >
                  Delete variant
                </button>
              )}
            </div>
          </div>
        )}

        {activeVariant && (
          <aside className="am-response-preview" data-testid="api-mock-response-preview">
            <div className="am-section-heading">Rendered preview</div>
            <div className="am-preview-meta">
              <span className={`am-badge ${activeVariant.status >= 400 ? 'warning' : 'success'}`}>{activeVariant.status}</span>
              <span className="am-mono">{activeVariant.body.contentType || 'text/plain'}</span>
              {(activeVariant.behavior.delayMs > 0 || activeVariant.behavior.jitterMs > 0) && (
                <span className="am-badge info">
                  {activeVariant.behavior.delayMs}±{activeVariant.behavior.jitterMs} ms
                </span>
              )}
            </div>
            <pre className="am-code-block am-preview-body">{previewBody || '(empty body)'}</pre>
            <div className="am-section-heading">Timeline</div>
            <div className="am-timeline">
              <div className="am-timeline-bar match">Match</div>
              <div className="am-timeline-bar delay" style={{ flex: Math.max(1, activeVariant.behavior.delayMs / 40) }}>Delay</div>
              <div className="am-timeline-bar render">Render</div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
