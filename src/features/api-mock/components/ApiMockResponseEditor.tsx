import { useEffect, useMemo, useState } from 'react';
import type { ApiMockRouteV1, ApiMockResponseCookieV1, ApiMockResponseVariantV1, ApiMockVariableV1, ApiMockPredicateV1 } from '../../../shared/api-mock/contracts';
import { previewResponseBody } from '../../../shared/api-mock/templatePreview';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import { isPredicateGroup } from '../../../shared/api-mock/predicateTree';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { ApiMockVariantOutboundPanel } from './ApiMockVariantOutboundPanel';
import { ApiMockBodyEditor } from './ApiMockBodyEditor';
import DataMapperModal from '../../../shared/components/data-mapper/DataMapperModal';
import { createApiMockBodyAdapter } from '../../../shared/components/data-mapper/adapters/apiMockBodyAdapter';
import { parseBodyJson } from '../../../shared/components/data-mapper/adapters/requestBodyAdapter';
import {
  CONTENT_TYPE_PRESETS,
  COOKIE_FLAG_HELP,
  COOKIE_SAMESITE_OPTIONS,
  CUSTOM_CONTENT_TYPE,
  QUICK_STATUSES,
  STATUS_REASONS,
  kindFromContentType,
} from './apiMockResponseEditorConstants';
import { ApiMockStatusPickerModal } from './ApiMockStatusPickerModal';
import { ApiMockResponseFaultsPanel } from './ApiMockResponseFaultsPanel';
import { ApiMockResponseSelectionPanel } from './ApiMockResponseSelectionPanel';
import { ApiMockResponseTimingPanel } from './ApiMockResponseTimingPanel';
import { ApiMockTemplateHelperModal } from './ApiMockTemplateHelperModal';
import { insertTemplateSnippet } from '../../../shared/api-mock/templateHelperCatalog';

interface Props {
  route: ApiMockRouteV1;
  onUpdateRoute: (patch: Partial<ApiMockRouteV1>) => void;
  /** Live sequence cursor for this route (next index). */
  sequencePosition?: number;
  /** Server variables so `{{variables.key}}` resolves in the preview pane. */
  variables?: ApiMockVariableV1[];
  /** Server-wide Timeout hold ceiling forwarded to the Faults tab. */
  timeoutHoldMaxMs?: number;
}

type ContentTab = 'content' | 'headers' | 'timing' | 'faults' | 'selection' | 'outbound';

/**
 * Mockup 03-inspired response editor: variant sidebar + content tabs + live preview pane.
 */
export function ApiMockResponseEditor({ route, onUpdateRoute, sequencePosition, variables = [], timeoutHoldMaxMs }: Props) {
  const [activeVariantId, setActiveVariantId] = useState(route.responses[0]?.id);
  const [contentTab, setContentTab] = useState<ContentTab>('content');
  const [helpersOpen, setHelpersOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  useEffect(() => {
    if (!route.responses.some(v => v.id === activeVariantId)) {
      setActiveVariantId(route.responses[0]?.id);
    }
  }, [route.responses, activeVariantId]);
  const activeVariant = route.responses.find(v => v.id === activeVariantId) ?? route.responses[0];

  const templatePreview = useMemo(() => {
    if (!activeVariant) {
      return { text: '', errors: [] as string[], isTemplate: false, samplePath: '/', sampleMethod: 'GET' };
    }
    return previewResponseBody(
      activeVariant.body.content ?? '',
      activeVariant.body.contentType,
      route,
      variables,
    );
  }, [activeVariant, route, variables]);
  const previewBody = templatePreview.text;

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

  const addCookie = () => {
    const variant = activeVariant as ApiMockResponseVariantV1;
    const cookie: ApiMockResponseCookieV1 = {
      id: `ck-${crypto.randomUUID().slice(0, 8)}`,
      name: 'session',
      value: "{{uuid}}",
      enabled: true,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
    };
    handleUpdateVariant(variant.id, { cookies: [...variant.cookies, cookie] });
  };

  const updateCookie = (cookieId: string, patch: Partial<ApiMockResponseCookieV1>) => {
    const variant = activeVariant as ApiMockResponseVariantV1;
    handleUpdateVariant(variant.id, {
      cookies: variant.cookies.map(c => c.id === cookieId ? { ...c, ...patch } : c),
    });
  };

  const removeCookie = (cookieId: string) => {
    const variant = activeVariant as ApiMockResponseVariantV1;
    handleUpdateVariant(variant.id, {
      cookies: variant.cookies.filter(c => c.id !== cookieId),
    });
  };

  const [formatError, setFormatError] = useState<string | undefined>();
  const [customContentType, setCustomContentType] = useState(false);
  const [mapperSession, setMapperSession] = useState<{
    adapter: ReturnType<typeof createApiMockBodyAdapter>;
    initial: string;
    variantId: string;
  } | null>(null);

  useEffect(() => {
    if (mapperSession && mapperSession.variantId !== activeVariant?.id) {
      setMapperSession(null);
    }
  }, [activeVariant?.id, mapperSession]);

  const contentTypeValue = activeVariant?.body.contentType;
  // Sticky so picking "Custom…" reveals the field before anything is typed.
  const isCustomContentType = customContentType
    || (!!contentTypeValue && !CONTENT_TYPE_PRESETS.includes(contentTypeValue));
  const bodyText = activeVariant?.body.content ?? '';
  const bodyIsTemplate = /\{\{[^}]+\}\}/.test(bodyText);
  const bodyBytes = new TextEncoder().encode(bodyText).length;
  const canMapBody = !bodyText.trim() || parseBodyJson(bodyText) != null;

  const setBody = (content: string) => {
    if (!activeVariant) return;
    setFormatError(undefined);
    handleUpdateVariant(activeVariant.id, { body: { ...activeVariant.body, content } });
  };

  /** Pretty-print JSON bodies; templates are left alone since they aren't valid JSON. */
  const formatBody = () => {
    if (!bodyText.trim()) return;
    try {
      setBody(JSON.stringify(JSON.parse(bodyText), null, 2));
    } catch (err) {
      setFormatError(
        bodyIsTemplate
          ? 'Body contains template expressions, so it is not valid JSON yet.'
          : err instanceof Error ? err.message : 'Body is not valid JSON.',
      );
    }
  };

  /**
   * Weights are mode-specific. JSONPath conditions stay: a Rules → Sequence glance
   * must not throw away a 404 predicate such as `$.sku = MISSING`.
   */
  const handleModeChange = (mode: ApiMockRouteV1['responseMode']) => {
    const responses = route.responses.map(r => (
      mode === 'weighted' ? { ...r, weight: r.weight ?? 1 } : { ...r, weight: undefined }
    ));
    onUpdateRoute({ responseMode: mode, responses });
  };

  /** Short "why this variant" line shown under each variant card (mockup 03). */
  const variantSummary = (v: ApiMockResponseVariantV1, index: number): string => {
    if (route.responseMode === 'sequence') return `Step ${index + 1} of ${route.responses.length}`;
    if (route.responseMode === 'weighted') return `Weight ${v.weight ?? 1}`;
    if (route.responseMode === 'state') {
      return v.transition?.currentState ? `When state = ${v.transition.currentState}` : 'Any state';
    }
    if (v.isDefault) return 'Default response';
    const conditionCount = v.conditions?.children?.length ?? 0;
    return conditionCount > 0 ? `${conditionCount} condition(s)` : 'No extra condition';
  };

  const conditionLabel = (() => {
    if (!activeVariant) return 'None';
    if (route.responseMode === 'state' && activeVariant.transition?.currentState) {
      return `state = ${activeVariant.transition.currentState}`;
    }
    if (route.responseMode === 'weighted' && activeVariant.weight != null) {
      return `weight ${activeVariant.weight}`;
    }
    if (activeVariant.isDefault) return 'Default variant';
    const jsonPath = activeVariant.conditions?.children?.find(
      (c): c is ApiMockPredicateV1 => !isPredicateGroup(c) && c.operator === 'jsonPath_equals',
    );
    if (jsonPath && Array.isArray(jsonPath.expected) && jsonPath.expected.length >= 2) {
      return `${jsonPath.expected[0]} = ${jsonPath.expected[1]}`;
    }
    return 'No extra condition';
  })();

  const patchActiveVariant = (patch: Partial<ApiMockResponseVariantV1>) => {
    if (!activeVariant) return;
    handleUpdateVariant(activeVariant.id, patch);
  };

  return (
    <div className="api-mock-root api-mock-response-editor" data-testid="api-mock-response-editor">
      <div className="am-response-mode-bar" data-testid="api-mock-response-mode-bar">
        <span className="am-section-heading" style={{ margin: 0 }}>Selection mode</span>
        <div className="am-segmented" role="group" aria-label="Response selection mode">
          {([
            ['rules', 'Rules'],
            ['sequence', 'Sequence'],
            ['weighted', 'Weighted'],
            ['state', 'State'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={route.responseMode === mode ? 'active' : ''}
              aria-pressed={route.responseMode === mode}
              onClick={() => handleModeChange(mode)}
              data-testid={`api-mock-response-mode-${mode}`}
            >{label}</button>
          ))}
        </div>
        <span className="am-spacer" />
        {route.responseMode === 'sequence' && (
          <span className="am-hint" data-testid="api-mock-sequence-order-note">
            Order is top to bottom. Exhaustion cycles from the start.
          </span>
        )}
        <span className="am-hint">{route.responses.length} variant{route.responses.length === 1 ? '' : 's'}</span>
      </div>
      <div className="am-response-layout">
        <aside className="am-variant-sidebar" data-testid="api-mock-variant-sidebar">
          <div className="am-variant-list" data-testid="api-mock-variant-list">
            {route.responses.map((v, i) => (
              <button
                key={v.id}
                type="button"
                className={`am-variant-card${v.id === activeVariant?.id ? ' active' : ''}`}
                data-testid={`api-mock-variant-tab-${v.id}`}
                onClick={() => setActiveVariantId(v.id)}
              >
                <span className="am-variant-card-head">
                  <span className={`am-badge ${v.status >= 400 ? 'warning' : 'success'}`}>{v.status}</span>
                  <span className="am-variant-name">{v.name}</span>
                  {v.isDefault && <span className="am-badge info" data-testid="api-mock-variant-default-badge">Default</span>}
                  {route.responses.length > 1 && (
                    <span
                      className="am-variant-delete"
                      role="button"
                      tabIndex={0}
                      aria-label={`Delete ${v.name}`}
                      data-testid={`api-mock-delete-variant-${v.id}`}
                      onClick={e => { e.stopPropagation(); handleDeleteVariant(v.id); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); handleDeleteVariant(v.id); } }}
                    >×</span>
                  )}
                </span>
                <span className="am-variant-desc">{variantSummary(v, i)}</span>
              </button>
            ))}
          </div>
          <button className="am-btn small" onClick={handleAddVariant} aria-label="Add response variant" title="Add response variant" data-testid="api-mock-add-variant">+ Variant</button>
        </aside>

        {activeVariant && (
          <div className="am-response-main">
            <div className="am-builder-tabs" role="tablist" aria-label="Response editor sections">
              {([
                ['content', 'Content'],
                ['headers', 'Headers & cookies'],
                ['timing', 'Timing'],
                ['faults', 'Faults'],
                ['selection', 'Selection'],
                ['outbound', 'Outbound'],
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

            <div className={`am-editor-body${contentTab === 'content' ? ' am-editor-body--fill' : ''}`}>
              {contentTab === 'content' && (
                <>
                  <div className="am-form-grid">
                    <div className="am-form-row">
                      <div className="am-form-label">Status</div>
                      <div className="am-form-control">
                        <input
                          className="am-input num mono"
                          type="number"
                          value={activeVariant.status}
                          onChange={e => {
                            const status = parseInt(e.target.value, 10) || 200;
                            const prevDefault = STATUS_REASONS[activeVariant.status];
                            const keepCustom = Boolean(activeVariant.reasonPhrase && activeVariant.reasonPhrase !== prevDefault);
                            handleUpdateVariant(activeVariant.id, {
                              status,
                              reasonPhrase: keepCustom ? activeVariant.reasonPhrase : (STATUS_REASONS[status] ?? ''),
                            });
                          }}
                          data-testid="api-mock-variant-status"
                        />
                        <input
                          className="am-input mono am-reason"
                          value={activeVariant.reasonPhrase ?? STATUS_REASONS[activeVariant.status] ?? ''}
                          onChange={e => handleUpdateVariant(activeVariant.id, { reasonPhrase: e.target.value })}
                          placeholder="Custom status"
                          aria-label="Reason phrase"
                          data-testid="api-mock-variant-status-reason"
                        />
                        <span className="am-spacer" />
                        <div className="am-status-quick">
                          {QUICK_STATUSES.map(s => (
                            <button
                              key={s}
                              type="button"
                              className={`am-chip${activeVariant.status === s ? ' active' : ''}`}
                              title={`${s} ${STATUS_REASONS[s] ?? ''}`.trim()}
                              onClick={() => handleUpdateVariant(activeVariant.id, {
                                status: s,
                                reasonPhrase: STATUS_REASONS[s] ?? '',
                              })}
                              data-testid={`api-mock-variant-status-quick-${s}`}
                            >{s}</button>
                          ))}
                          <button
                            type="button"
                            className="am-status-more-btn"
                            onClick={() => setStatusPickerOpen(true)}
                            title="Browse all HTTP status codes"
                            data-testid="api-mock-status-picker-open"
                          >
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="6.5" cy="6.5" r="5" /><line x1="10.2" y1="10.2" x2="14.5" y2="14.5" />
                            </svg>
                            More
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="am-form-row">
                      <div className="am-form-label">Name</div>
                      <div className="am-form-control">
                        <input
                          className="am-input wide"
                          value={activeVariant.name}
                          placeholder="Customer found"
                          onChange={e => handleUpdateVariant(activeVariant.id, { name: e.target.value })}
                          aria-label="Variant name"
                          data-testid="api-mock-variant-name"
                        />
                      </div>
                    </div>
                    <div className="am-form-row">
                      <div className="am-form-label">Content-Type</div>
                      <div className="am-form-control">
                        <CustomSelect
                          value={isCustomContentType ? CUSTOM_CONTENT_TYPE : (contentTypeValue ?? '')}
                          onChange={v => {
                            setCustomContentType(v === CUSTOM_CONTENT_TYPE);
                            handleUpdateVariant(activeVariant.id, {
                              body: {
                                ...activeVariant.body,
                                contentType: v === CUSTOM_CONTENT_TYPE ? '' : (v || undefined),
                                kind: v === CUSTOM_CONTENT_TYPE ? activeVariant.body.kind : kindFromContentType(v),
                              },
                            });
                          }}
                          options={[
                            { value: '', label: 'Not set (sent as text/plain)' },
                            ...CONTENT_TYPE_PRESETS.map(t => ({ value: t, label: t })),
                            { value: CUSTOM_CONTENT_TYPE, label: 'Custom…' },
                          ]}
                          className="am-cs am-cs--md"
                          aria-label="Response content type"
                          data-testid="api-mock-variant-content-type-select"
                        />
                        {isCustomContentType && (
                          <input
                            className="am-input mono am-input--md"
                            value={contentTypeValue ?? ''}
                            placeholder="application/vnd.acme+json"
                            onChange={e => handleUpdateVariant(activeVariant.id, {
                              body: { ...activeVariant.body, contentType: e.target.value },
                            })}
                            aria-label="Custom content type"
                            data-testid="api-mock-variant-content-type"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="am-body-block">
                    <div className="am-body-head">
                      <h4 className="am-body-title">Response body</h4>
                      <span className="am-faint" data-testid="api-mock-body-size">{bodyBytes} B</span>
                      <span className="am-spacer" />
                      <button
                        type="button"
                        className="am-btn small ghost"
                        onClick={() => {
                          if (!activeVariant) return;
                          setMapperSession({
                            adapter: createApiMockBodyAdapter({
                              existingBody: bodyText,
                              pathParams: route.path.paramNames ?? [],
                              pathPattern: route.path.value,
                            }),
                            initial: bodyText,
                            variantId: activeVariant.id,
                          });
                        }}
                        disabled={!canMapBody}
                        title={canMapBody ? 'Map request helpers onto this JSON body' : 'Map body works on JSON object bodies'}
                        data-testid="api-mock-body-map"
                      >Map body</button>
                      <button
                        type="button"
                        className="am-btn small ghost"
                        onClick={formatBody}
                        disabled={!bodyText.trim()}
                        title="Pretty-print JSON"
                        data-testid="api-mock-body-format"
                      >Format</button>
                      <button
                        type="button"
                        className="am-btn small ghost"
                        onClick={() => setBody('')}
                        disabled={!bodyText}
                        data-testid="api-mock-body-clear"
                      >Clear</button>
                    </div>
                    <ApiMockBodyEditor
                      value={bodyText}
                      onChange={setBody}
                      height="100%"
                      language={
                        (activeVariant.body.contentType ?? '').includes('xml') || activeVariant.body.kind === 'xml'
                          ? 'xml'
                          : (activeVariant.body.contentType ?? '').includes('html') || activeVariant.body.kind === 'html'
                            ? 'html'
                            : (activeVariant.body.contentType ?? '').includes('json') || activeVariant.body.kind === 'json'
                              ? 'json'
                              : 'plaintext'
                      }
                    />
                    {mapperSession && mapperSession.variantId === activeVariant?.id && (
                      <div data-testid="api-mock-body-mapper">
                        <DataMapperModal
                          adapter={mapperSession.adapter}
                          initialData={mapperSession.initial}
                          onSave={output => { setBody(output); setMapperSession(null); }}
                          onCancel={() => setMapperSession(null)}
                          doneLabel="Apply body"
                        />
                      </div>
                    )}
                    {formatError && (
                      <div className="am-hint am-hint--error" data-testid="api-mock-body-format-error">{formatError}</div>
                    )}
                    {kindFromContentType(activeVariant.body.contentType) === 'binary_base64' && (
                      <div className="am-notice" data-testid="api-mock-body-binary-hint">
                        Body is treated as base64 and decoded to bytes on the wire.
                      </div>
                    )}
                    <div className="am-notice am-body-helpers">
                      <span>
                        Template helpers: <code>{'{{uuid}}'}</code>, <code>{"{{header 'X-Tenant'}}"}</code>, <code>{'{{now}}'}</code>, <code>{"{{pathParam 'id'}}"}</code>.
                        {' '}Type <code>{'{{'}</code> for autocomplete.
                      </span>
                      {bodyIsTemplate && (
                        <button
                          type="button"
                          className="am-btn small ghost am-template-badge-button"
                          aria-label="Browse template helpers"
                          title="Browse template helpers"
                          data-testid="api-mock-template-helpers-browse"
                          onClick={() => setHelpersOpen(true)}
                        >
                          <span className="am-badge info" data-testid="api-mock-body-template-badge">TEMPLATE</span>
                        </button>
                      )}
                    </div>
                    {helpersOpen && (
                      <ApiMockTemplateHelperModal
                        onInsert={snippet => setBody(insertTemplateSnippet(bodyText, snippet))}
                        onClose={() => setHelpersOpen(false)}
                      />
                    )}
                  </div>
                </>
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
                  <div data-testid="api-mock-header-list">
                  {activeVariant.headers.map(h => (
                    <div key={h.id} className="am-matcher-row" style={{ gridTemplateColumns: '1fr 1fr auto' }} data-testid="api-mock-header-row">
                      <input className="am-input mono" value={h.key} onChange={e => updateHeader(h.id, { key: e.target.value })} aria-label="Header name" data-testid="api-mock-header-key" />
                      <input className="am-input mono" value={h.value} onChange={e => updateHeader(h.id, { value: e.target.value })} aria-label="Header value" data-testid="api-mock-header-value" />
                      <button type="button" className="am-icon-btn" aria-label="Remove header" onClick={() => removeHeader(h.id)}>×</button>
                    </div>
                  ))}
                  </div>

                  <div className="am-section-heading">
                    Cookies
                    <span className="am-count-badge">{activeVariant.cookies.length}</span>
                    <span className="am-spacer" />
                    <button type="button" className="am-btn small ghost" onClick={addCookie} data-testid="api-mock-add-cookie">+ Cookie</button>
                  </div>
                  <ul className="am-cookie-flag-help" data-testid="api-mock-cookie-flag-help">
                    {COOKIE_FLAG_HELP.map(item => (
                      <li key={item.term}>
                        <strong>{item.term}</strong>
                        {' — '}
                        {item.meaning}
                      </li>
                    ))}
                  </ul>
                  {activeVariant.cookies.length === 0 && (
                    <div className="am-empty-conditions">No cookies.</div>
                  )}
                  {activeVariant.cookies.map(c => (
                    <div key={c.id} className="am-cookie-card" data-testid="api-mock-cookie-row">
                      <div className="am-matcher-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                        <input
                          className="am-input mono"
                          value={c.name}
                          aria-label="Cookie name"
                          data-testid="api-mock-cookie-name"
                          onChange={e => updateCookie(c.id, { name: e.target.value })}
                        />
                        <input
                          className="am-input mono"
                          value={c.value}
                          aria-label="Cookie value"
                          data-testid="api-mock-cookie-value"
                          onChange={e => updateCookie(c.id, { value: e.target.value })}
                        />
                        <button type="button" className="am-icon-btn" aria-label="Remove cookie" data-testid={`api-mock-cookie-delete-${c.id}`} onClick={() => removeCookie(c.id)}>×</button>
                      </div>
                      <div className="am-cookie-flags">
                        <label
                          className={`am-chip${c.httpOnly ? ' active' : ''}`}
                          title={COOKIE_FLAG_HELP.find(h => h.term === 'HttpOnly')?.meaning}
                        >
                          <input type="checkbox" checked={!!c.httpOnly} onChange={e => updateCookie(c.id, { httpOnly: e.target.checked })} data-testid="api-mock-cookie-httpOnly" /> HttpOnly
                        </label>
                        <label
                          className={`am-chip${c.secure ? ' active' : ''}`}
                          title={COOKIE_FLAG_HELP.find(h => h.term === 'Secure')?.meaning}
                        >
                          <input type="checkbox" checked={!!c.secure} onChange={e => updateCookie(c.id, { secure: e.target.checked })} data-testid={`api-mock-cookie-secure-${c.id}`} /> Secure
                        </label>
                        <CustomSelect
                          value={c.sameSite ?? 'Lax'}
                          onChange={v => updateCookie(c.id, { sameSite: v as ApiMockResponseCookieV1['sameSite'] })}
                          options={[...COOKIE_SAMESITE_OPTIONS]}
                          className="am-cs"
                          aria-label="SameSite"
                          menuMinWidth={320}
                          data-testid={`api-mock-cookie-samesite-${c.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}

              {contentTab === 'timing' && (
                <ApiMockResponseTimingPanel variant={activeVariant} onUpdateVariant={patchActiveVariant} />
              )}

              {contentTab === 'faults' && (
                <ApiMockResponseFaultsPanel
                  variant={activeVariant}
                  onUpdateVariant={patchActiveVariant}
                  timeoutHoldMaxMs={timeoutHoldMaxMs}
                />
              )}

              {contentTab === 'selection' && (
                <ApiMockResponseSelectionPanel
                  route={route}
                  activeVariant={activeVariant}
                  sequencePosition={sequencePosition}
                  conditionLabel={conditionLabel}
                  onUpdateRoute={onUpdateRoute}
                  onUpdateVariant={patchActiveVariant}
                  onModeChange={handleModeChange}
                />
              )}

              {contentTab === 'outbound' && (
                <ApiMockVariantOutboundPanel
                  variant={activeVariant}
                  onUpdate={patch => handleUpdateVariant(activeVariant.id, patch)}
                />
              )}
            </div>
          </div>
        )}

        {activeVariant && (
          <aside className="am-response-preview" data-testid="api-mock-response-preview">
            <div className="am-preview-stack">
              <div className="am-section-heading">Rendered preview</div>
              {templatePreview.isTemplate && (
                <div className="am-faint" data-testid="api-mock-preview-sample">
                  Preview uses {templatePreview.sampleMethod} {templatePreview.samplePath}
                </div>
              )}
              {templatePreview.errors.length > 0 && (
                <div className="am-hint am-hint--error" data-testid="api-mock-template-error">
                  {templatePreview.errors[0]}
                  {templatePreview.errors.length > 1 ? ` (+${templatePreview.errors.length - 1} more)` : ''}
                </div>
              )}
              <div className="am-preview-meta">
                <span
                  className={`am-badge ${activeVariant.status >= 400 ? 'warning' : 'success'}`}
                  data-testid="api-mock-preview-status"
                >
                  {activeVariant.status} {activeVariant.reasonPhrase || STATUS_REASONS[activeVariant.status] || ''}
                </span>
                <span className="am-badge">{activeVariant.body.contentType || 'text/plain'}</span>
                {(activeVariant.behavior.delayMs > 0 || activeVariant.behavior.jitterMs > 0) && (
                  <span className="am-badge info" data-testid="api-mock-preview-spread">
                    {activeVariant.behavior.delayMs}±{activeVariant.behavior.jitterMs} ms
                  </span>
                )}
                {activeVariant.headers.length > 0 && (
                  <span className="am-badge" data-testid="api-mock-preview-headers">
                    {activeVariant.headers.length} header{activeVariant.headers.length === 1 ? '' : 's'}
                  </span>
                )}
                {activeVariant.cookies.length > 0 && (
                  <span className="am-badge" data-testid="api-mock-preview-cookies">
                    {activeVariant.cookies.length} cookie{activeVariant.cookies.length === 1 ? '' : 's'}
                  </span>
                )}
                {activeVariant.behavior.fault && activeVariant.behavior.fault !== 'none' && (
                  <span className="am-badge danger">fault: {activeVariant.behavior.fault}</span>
                )}
              </div>
              <pre className="am-code-block am-preview-body" data-testid="api-mock-preview-body">{previewBody || '(empty body)'}</pre>
            </div>
            <div className="am-preview-timeline">
              <div className="am-section-heading">Timeline</div>
              <div className="am-timing-lines" data-testid="api-mock-timing-lines">
                <div className="am-timing-line">
                  <span className="am-muted">Match</span>
                  <div className="am-timing-bar"><span style={{ width: '8%' }} /></div>
                  <span className="am-mono">1 ms</span>
                </div>
                <div className="am-timing-line">
                  <span className="am-muted">Delay</span>
                  <div className="am-timing-bar">
                    <span className="delay" style={{ width: `${Math.min(100, Math.max(8, activeVariant.behavior.delayMs / 2))}%` }} />
                  </div>
                  <span className="am-mono">{activeVariant.behavior.delayMs}±{activeVariant.behavior.jitterMs} ms</span>
                </div>
                <div className="am-timing-line">
                  <span className="am-muted">Render</span>
                  <div className="am-timing-bar"><span className="render" style={{ width: '12%' }} /></div>
                  <span className="am-mono">2 ms</span>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {statusPickerOpen && activeVariant && (
        <ApiMockStatusPickerModal
          currentStatus={activeVariant.status}
          onPick={(code, reason) => handleUpdateVariant(activeVariant.id, {
            status: code,
            reasonPhrase: reason,
          })}
          onClose={() => setStatusPickerOpen(false)}
        />
      )}
    </div>
  );
}
