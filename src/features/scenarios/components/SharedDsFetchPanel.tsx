import type { SharedDataSource, SharedDataSourceFetchConfig } from '../../../shared/types';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import type { useSharedDsFetchConfig } from '../hooks/useSharedDsFetchConfig';
import type { UseSharedDsEditorPanelReturn } from '../hooks/useSharedDsEditorPanel';

type FetchConfigApi = ReturnType<typeof useSharedDsFetchConfig>;

type EditorPanelFetchApi = Pick<
  UseSharedDsEditorPanelReturn,
  | 'fetchDraftScenario'
  | 'fetchUrlRowRef'
  | 'fetchHeadersRef'
  | 'fetchAuthRef'
  | 'fetchBodyRef'
  | 'mappingSummary'
  | 'detectedParams'
  | 'headerCount'
  | 'fetchExpanded'
  | 'setFetchExpanded'
  | 'fetchTab'
  | 'setFetchTab'
>;

export interface SharedDsFetchPanelProps {
  selected: SharedDataSource;
  fetchConfig: FetchConfigApi;
  editorPanel: EditorPanelFetchApi;
  onShowPopulateFromApi: () => void;
  onOpenCreateTestModal?: () => void;
}

export default function SharedDsFetchPanel({
  selected,
  fetchConfig,
  editorPanel,
  onShowPopulateFromApi,
  onOpenCreateTestModal,
}: SharedDsFetchPanelProps) {
  return (
    <div className="shared-ds-fetch-panel">
      {/* ─── Action bar ─── */}
      <div className="shared-ds-fetch-actions">
        <button className="btn btn-sm" onClick={() => fetchConfig.setCurlImportExpanded(v => !v)}>
          cURL Import
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            if (editorPanel.fetchDraftScenario) {
              fetchConfig.setWizardScenario(editorPanel.fetchDraftScenario);
              fetchConfig.setShowSetupWizard(true);
            }
          }}
          disabled={!editorPanel.fetchDraftScenario}
          title={editorPanel.fetchDraftScenario ? 'Configure auth, path variables, and columns' : 'Set URL first'}
        >
          Configure Variables + Auth…
        </button>
        {selected.fetchConfig?.rawCurl?.trim() && (
          <span className="shared-ds-fetch-curl-badge">cURL template</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-sm"
            onClick={onShowPopulateFromApi}
            disabled={!editorPanel.fetchDraftScenario}
            title={editorPanel.fetchDraftScenario ? 'Populate rows from API response' : 'Set URL first'}
          >
            Populate Rows from API
          </button>
          {onOpenCreateTestModal && (
            <button
              className="btn btn-sm"
              onClick={onOpenCreateTestModal}
              title="Create a new test linked to this shared data source"
            >
              + Create Test
            </button>
          )}
        </div>
      </div>

      {/* ─── cURL Import section ─── */}
      {fetchConfig.curlImportExpanded && (
        <div className="shared-ds-curl-import">
          <label className="shared-ds-fetch-label">Paste cURL command</label>
          <textarea
            className="shared-ds-curl-input"
            value={fetchConfig.curlInput}
            onChange={e => fetchConfig.handleCurlInputChange(e.target.value)}
            rows={5}
            placeholder={'curl -X GET https://api.example.com/items -H "Authorization: Bearer {{token}}"'}
          />
          <div className="shared-ds-curl-actions">
            <button className="btn btn-sm btn-primary" disabled={!fetchConfig.curlInput.trim()} onClick={fetchConfig.handleImportCurl}>Import & Apply</button>
            <button className="btn btn-sm" onClick={() => fetchConfig.setCurlImportExpanded(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ─── Method + URL bar ─── */}
      <div className="shared-ds-fetch-url-bar" ref={editorPanel.fetchUrlRowRef}>
        <CustomSelect
          className="shared-ds-fetch-method"
          value={selected.fetchConfig?.method ?? 'GET'}
          onChange={(v) => fetchConfig.handleFetchConfigChange({ method: v as SharedDataSourceFetchConfig['method'] })}
          options={[
            { value: 'GET', label: 'GET' },
            { value: 'POST', label: 'POST' },
            { value: 'PUT', label: 'PUT' },
            { value: 'PATCH', label: 'PATCH' },
            { value: 'DELETE', label: 'DELETE' },
          ]}
        />
        <input
          className="shared-ds-fetch-url"
          type="text"
          value={selected.fetchConfig?.url ?? ''}
          onChange={e => fetchConfig.handleFetchConfigChange({ url: e.target.value })}
          placeholder="https://api.example.com/v1/items?channel={{channel}}"
        />
      </div>

      {/* ─── Mapping badges row ─── */}
      <div className="shared-ds-mapping-preview" aria-label="Mapping Preview">
        <button className="shared-ds-mapping-chip" data-map-type="path" onClick={() => { editorPanel.setFetchExpanded(true); editorPanel.setFetchTab('params'); }}>path:{editorPanel.mappingSummary.counts.path}</button>
        <button className="shared-ds-mapping-chip" data-map-type="param" onClick={() => { editorPanel.setFetchExpanded(true); editorPanel.setFetchTab('params'); }}>param:{editorPanel.mappingSummary.counts.param}</button>
        <button className="shared-ds-mapping-chip" data-map-type="header" onClick={() => { editorPanel.setFetchExpanded(true); editorPanel.setFetchTab('headers'); }}>header:{editorPanel.mappingSummary.counts.header}</button>
        <button className="shared-ds-mapping-chip" data-map-type="body" onClick={() => { editorPanel.setFetchExpanded(true); editorPanel.setFetchTab('body'); }}>body:{editorPanel.mappingSummary.counts.body}</button>
        <button className="shared-ds-mapping-chip" data-map-type="validate" onClick={() => editorPanel.setFetchExpanded(v => !v)}>validate:{editorPanel.mappingSummary.counts.validate}</button>
        {editorPanel.mappingSummary.warnings.length > 0 && (
          <button
            className="shared-ds-mapping-warning-count"
            onClick={() => { editorPanel.setFetchExpanded(true); editorPanel.setFetchTab('params'); }}
            title={editorPanel.mappingSummary.warnings.map(w => w.message).join('\n')}
          >
            {editorPanel.mappingSummary.warnings.length} issue{editorPanel.mappingSummary.warnings.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ─── Tabs ─── */}
      <div className="builder-tabs">
        <button
          type="button"
          className={`builder-tab ${editorPanel.fetchExpanded && editorPanel.fetchTab === 'params' ? 'active' : ''}`}
          onClick={() => { if (editorPanel.fetchExpanded && editorPanel.fetchTab === 'params') { editorPanel.setFetchExpanded(false); } else { editorPanel.setFetchExpanded(true); editorPanel.setFetchTab('params'); } }}
        >
          Params {editorPanel.detectedParams.length > 0 && <span className="tab-badge">{editorPanel.detectedParams.length}</span>}
        </button>
        <button
          type="button"
          className={`builder-tab ${editorPanel.fetchExpanded && editorPanel.fetchTab === 'auth' ? 'active' : ''}`}
          onClick={() => { if (editorPanel.fetchExpanded && editorPanel.fetchTab === 'auth') { editorPanel.setFetchExpanded(false); } else { editorPanel.setFetchExpanded(true); editorPanel.setFetchTab('auth'); } }}
        >
          Auth {(selected.fetchConfig?.auth?.type ?? 'none') !== 'none' && <span className="tab-badge-dot" />}
        </button>
        <button
          type="button"
          className={`builder-tab ${editorPanel.fetchExpanded && editorPanel.fetchTab === 'headers' ? 'active' : ''}`}
          onClick={() => { if (editorPanel.fetchExpanded && editorPanel.fetchTab === 'headers') { editorPanel.setFetchExpanded(false); } else { editorPanel.setFetchExpanded(true); editorPanel.setFetchTab('headers'); } }}
        >
          Headers {editorPanel.headerCount > 0 && <span className="tab-badge">{editorPanel.headerCount}</span>}
        </button>
        {(selected.fetchConfig?.method ?? 'GET') !== 'GET' && (
          <button
            type="button"
            className={`builder-tab ${editorPanel.fetchExpanded && editorPanel.fetchTab === 'body' ? 'active' : ''}`}
            onClick={() => { if (editorPanel.fetchExpanded && editorPanel.fetchTab === 'body') { editorPanel.setFetchExpanded(false); } else { editorPanel.setFetchExpanded(true); editorPanel.setFetchTab('body'); } }}
          >
            Body {(selected.fetchConfig?.body ?? '').trim() ? <span className="tab-badge-dot" /> : null}
          </button>
        )}
      </div>

      {/* ─── Tab content ─── */}
      {editorPanel.fetchExpanded && (
        <div className="builder-tab-content shared-ds-tab-content">

          {/* Params tab */}
          {editorPanel.fetchTab === 'params' && (
            <div className="shared-ds-params-tab">
              {editorPanel.detectedParams.length === 0 ? (
                <div className="shared-ds-params-empty">
                  No template variables detected. Use <code>{'{{variableName}}'}</code> in the URL to create parameterized fields.
                </div>
              ) : (
                <table className="shared-ds-params-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Source</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editorPanel.detectedParams.map(p => (
                      <tr key={`${p.source}-${p.name}`}>
                        <td className="shared-ds-param-name">{p.name}</td>
                        <td><span className={`shared-ds-param-source shared-ds-param-source-${p.source}`}>{p.source}</span></td>
                        <td className="shared-ds-param-value">
                          {'value' in p && p.value ? p.value : `{{${p.name}}}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {editorPanel.mappingSummary.warnings.length > 0 && (
                <div className="shared-ds-fetch-mapping-warnings" role="alert">
                  <div className="shared-ds-fetch-mapping-warnings-title">Mapping issues</div>
                  <ul>
                    {editorPanel.mappingSummary.warnings.map(w => (
                      <li key={`${w.type}:${w.mapping}`}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Auth tab */}
          {editorPanel.fetchTab === 'auth' && (
            <div className="shared-ds-auth-tab" ref={editorPanel.fetchAuthRef}>
              <CustomSelect
                className="shared-ds-fetch-auth-type"
                value={selected.fetchConfig?.auth?.type ?? 'none'}
                onChange={(v) => fetchConfig.handleFetchAuthTypeChange(v as 'none' | 'inherit' | 'basic' | 'bearer' | 'apikey' | 'digest' | 'oauth2')}
                options={[
                  { value: 'inherit', label: 'Inherit' },
                  { value: 'none', label: 'No Auth' },
                  { value: 'bearer', label: 'Bearer Token' },
                  { value: 'basic', label: 'Basic Auth' },
                  { value: 'apikey', label: 'API Key' },
                  { value: 'oauth2', label: 'OAuth2 Client Credentials' },
                ]}
              />

              {(selected.fetchConfig?.auth?.type ?? 'none') === 'bearer' && (
                <div className="shared-ds-fetch-auth-fields">
                  <input className="shared-ds-fetch-auth-input" type="text" placeholder="Prefix (Bearer)" value={selected.fetchConfig?.auth?.prefix ?? 'Bearer'} onChange={e => fetchConfig.handleFetchAuthPatch({ prefix: e.target.value })} />
                  <input className="shared-ds-fetch-auth-input" type="text" placeholder="Token" value={selected.fetchConfig?.auth?.token ?? ''} onChange={e => fetchConfig.handleFetchAuthPatch({ token: e.target.value })} />
                </div>
              )}

              {(selected.fetchConfig?.auth?.type ?? 'none') === 'basic' && (
                <div className="shared-ds-fetch-auth-fields">
                  <input className="shared-ds-fetch-auth-input" type="text" placeholder="Username" value={selected.fetchConfig?.auth?.username ?? ''} onChange={e => fetchConfig.handleFetchAuthPatch({ username: e.target.value })} />
                  <input className="shared-ds-fetch-auth-input" type="password" placeholder="Password" value={selected.fetchConfig?.auth?.password ?? ''} onChange={e => fetchConfig.handleFetchAuthPatch({ password: e.target.value })} />
                </div>
              )}

              {(selected.fetchConfig?.auth?.type ?? 'none') === 'apikey' && (
                <div className="shared-ds-fetch-auth-fields">
                  <input className="shared-ds-fetch-auth-input" type="text" placeholder="Key Name" value={selected.fetchConfig?.auth?.apiKeyName ?? ''} onChange={e => fetchConfig.handleFetchAuthPatch({ apiKeyName: e.target.value })} />
                  <input className="shared-ds-fetch-auth-input" type="text" placeholder="Key Value" value={selected.fetchConfig?.auth?.apiKeyValue ?? ''} onChange={e => fetchConfig.handleFetchAuthPatch({ apiKeyValue: e.target.value })} />
                  <CustomSelect
                    className="shared-ds-fetch-auth-type"
                    value={selected.fetchConfig?.auth?.apiKeyIn ?? 'header'}
                    onChange={(v) => fetchConfig.handleFetchAuthPatch({ apiKeyIn: v as 'header' | 'query' })}
                    options={[
                      { value: 'header', label: 'Header' },
                      { value: 'query', label: 'Query String' },
                    ]}
                  />
                </div>
              )}

              {(selected.fetchConfig?.auth?.type ?? 'none') === 'oauth2' && (
                <div className="shared-ds-fetch-auth-fields">
                  <input className="shared-ds-fetch-auth-input" type="text" placeholder="Token URL" value={selected.fetchConfig?.auth?.tokenUrl ?? ''} onChange={e => fetchConfig.handleFetchAuthPatch({ tokenUrl: e.target.value })} />
                  <input className="shared-ds-fetch-auth-input" type="text" placeholder="Client ID" value={selected.fetchConfig?.auth?.clientId ?? ''} onChange={e => fetchConfig.handleFetchAuthPatch({ clientId: e.target.value })} />
                  <input className="shared-ds-fetch-auth-input" type="password" placeholder="Client Secret" value={selected.fetchConfig?.auth?.clientSecret ?? ''} onChange={e => fetchConfig.handleFetchAuthPatch({ clientSecret: e.target.value })} />
                </div>
              )}
            </div>
          )}

          {/* Headers tab */}
          {editorPanel.fetchTab === 'headers' && (
            <div className="shared-ds-headers-tab" ref={editorPanel.fetchHeadersRef}>
              {(selected.fetchConfig?.headers ?? [{ key: '', value: '' }]).map((h, idx) => (
                <div key={`${idx}-${h.key}`} className="shared-ds-fetch-header-row">
                  <input className="shared-ds-fetch-header-key" type="text" value={h.key} placeholder="Header" onChange={e => fetchConfig.handleFetchHeaderChange(idx, 'key', e.target.value)} />
                  <input className="shared-ds-fetch-header-value" type="text" value={h.value} placeholder="Value" onChange={e => fetchConfig.handleFetchHeaderChange(idx, 'value', e.target.value)} />
                  <button className="btn-icon" onClick={() => fetchConfig.handleRemoveFetchHeader(idx)} title="Remove header">×</button>
                </div>
              ))}
              <button className="btn btn-sm" onClick={fetchConfig.handleAddFetchHeader}>+ Header</button>
            </div>
          )}

          {/* Body tab */}
          {editorPanel.fetchTab === 'body' && (
            <div className="shared-ds-body-tab" ref={editorPanel.fetchBodyRef}>
              <textarea
                className="shared-ds-fetch-body-input"
                value={selected.fetchConfig?.body ?? ''}
                onChange={e => fetchConfig.handleFetchConfigChange({ body: e.target.value })}
                rows={4}
                placeholder="Optional request body"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
