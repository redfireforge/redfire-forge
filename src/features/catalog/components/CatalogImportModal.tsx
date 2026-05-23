import { useState, useRef, useCallback, useEffect } from 'react';
import type { ParsedSpec, CatalogEntry } from '../types/catalog';
import { parseOpenApiSpec, getSpecFormatLabel, countEndpoints } from '../utils/openApiParser';
import { isTauri } from '../../../shared/utils/platform';
import { httpFetch } from '../../../shared/utils/httpClient';
import FullPanelModal from '../../../shared/components/FullPanelModal';
import { catalogSpecCatalog, CATALOG_SPEC_CATEGORIES, type CatalogSpecCategory } from '../../../data/galleries/catalog-specs';
import { toErrorMessage } from '../../../shared/utils/helpers';

interface Props {
  existingEntries: CatalogEntry[];
  onImport: (entry: CatalogEntry, rawSpec: string) => void;
  onReimport?: (entryId: string, parsed: ParsedSpec) => void;
  onClose: () => void;
  reimportEntryId?: string;
  /** Pre-fill the import modal with a spec (e.g. from gallery). Auto-parses and goes to preview. */
  initialSpec?: { yaml: string; name: string };
}

type Step = 'pick' | 'preview' | 'error';
type InputMode = 'file' | 'paste' | 'url' | 'gallery';

export default function CatalogImportModal({ existingEntries, onImport, onReimport, onClose, reimportEntryId, initialSpec }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [parsed, setParsed] = useState<ParsedSpec | null>(null);
  const [fileName, setFileName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const [tauriDragHover, setTauriDragHover] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryCategory, setGalleryCategory] = useState<CatalogSpecCategory | 'all'>('all');
  const [specUrl, setSpecUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFileRef = useRef<(text: string, name: string) => void>(undefined);

  const handleFile = useCallback(async (text: string, name: string, importSourceUrl?: string) => {
    setFileName(name);
    try {
      const result = await parseOpenApiSpec(text, importSourceUrl);
      setParsed(result);
      setStep('preview');
    } catch (err) {
      setError(toErrorMessage(err));
      setStep('error');
    }
  }, []);

  handleFileRef.current = handleFile;

  // Auto-parse initial spec (e.g. from gallery "Import Spec" click)
  useEffect(() => {
    if (initialSpec) {
      handleFile(initialSpec.yaml, initialSpec.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
          const { type } = event.payload;
          if (type === 'over' || type === 'enter') {
            setTauriDragHover(true);
          } else if (type === 'leave') {
            setTauriDragHover(false);
          } else if (type === 'drop') {
            setTauriDragHover(false);
            const paths: string[] = (event.payload as { type: 'drop'; paths: string[] }).paths;
            const filePath = paths[0];
            if (!filePath) return;
            const ext = filePath.split('.').pop()?.toLowerCase();
            if (!ext || !['yaml', 'yml', 'json'].includes(ext)) return;
            const text = await readTextFile(filePath);
            const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'spec.yaml';
            handleFileRef.current?.(text, name);
          }
        });
      } catch { /* Tauri drag-drop not available */ }
    })();

    return () => { unlisten?.(); };
  }, []);

  const handleParsePaste = useCallback(() => {
    if (!pasteText.trim()) return;
    handleFile(pasteText, 'pasted-spec.yaml');
  }, [pasteText, handleFile]);

  const handleFetchUrl = useCallback(async () => {
    const trimmedUrl = specUrl.trim();
    if (!trimmedUrl) return;

    setUrlLoading(true);
    setError('');

    try {
      const response = await httpFetch(trimmedUrl, 'GET', {
        'Accept': 'application/json, application/x-yaml, text/yaml, */*',
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const urlFileName = trimmedUrl.split('/').pop()?.split('?')[0] || 'spec-from-url.yaml';
      handleFile(response.body, urlFileName, trimmedUrl);
    } catch (err) {
      setError(toErrorMessage(err));
      setStep('error');
    } finally {
      setUrlLoading(false);
    }
  }, [specUrl, handleFile]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    handleFile(text, file.name);
  }, [handleFile]);

  const handleTauriOpen = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const path = await open({
        filters: [{ name: 'API Spec', extensions: ['yaml', 'yml', 'json'] }],
        multiple: false,
        directory: false,
      });
      if (!path) return;
      const text = await readTextFile(path as string);
      const name = (path as string).split('/').pop() || (path as string).split('\\').pop() || 'spec.yaml';
      handleFile(text, name);
    } catch { /* cancelled or error */ }
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    file.text().then(text => handleFile(text, file.name));
  }, [handleFile]);

  const handleImport = useCallback(() => {
    if (!parsed) return;

    const targetEntry = reimportEntryId
      ? existingEntries.find(e => e.id === reimportEntryId)
      : existingEntries.find(e => e.name.toLowerCase() === parsed.entry.name.toLowerCase());

    if (targetEntry && onReimport) {
      onReimport(targetEntry.id, parsed);
    } else {
      onImport(parsed.entry, parsed.rawSpec);
    }
    onClose();
  }, [parsed, existingEntries, reimportEntryId, onImport, onReimport, onClose]);

  const duplicate = parsed ? (
    reimportEntryId
      ? existingEntries.find(e => e.id === reimportEntryId)
      : existingEntries.find(e => e.name.toLowerCase() === parsed.entry.name.toLowerCase())
  ) : null;

  const hashMatch = duplicate && parsed
    ? duplicate.versions.some(v => v.specHash === parsed.entry.versions[0]?.specHash)
    : false;

  return (
    <FullPanelModal
      title={reimportEntryId ? 'Re-import / Update Specification' : 'Import OpenAPI Specification'}
      onClose={onClose}
      dialogClassName="cat-modal"
      footer={(
        <>
          <button
            className="cat-btn"
            onClick={step === 'error' || step === 'preview' ? () => { setStep('pick'); setParsed(null); setError(''); } : onClose}
          >
            {step === 'pick' ? 'Close' : 'Back'}
          </button>
          {step === 'preview' && (
            <button className="cat-btn cat-btn-primary" onClick={handleImport}>
              {duplicate && !hashMatch ? 'Update' : hashMatch ? 'Import Anyway' : 'Import'}
            </button>
          )}
        </>
      )}
    >
          {step === 'pick' && (
            <>
              <div className="cat-import-tabs">
                <button className={`cat-import-tab ${inputMode === 'file' ? 'active' : ''}`}
                  onClick={() => setInputMode('file')}>Upload File</button>
                <button className={`cat-import-tab ${inputMode === 'paste' ? 'active' : ''}`}
                  onClick={() => setInputMode('paste')}>Paste YAML / JSON</button>
                <button className={`cat-import-tab ${inputMode === 'url' ? 'active' : ''}`}
                  onClick={() => setInputMode('url')}>From URL</button>
                <button className={`cat-import-tab ${inputMode === 'gallery' ? 'active' : ''}`}
                  onClick={() => setInputMode('gallery')}>Sample Gallery</button>
              </div>

              {inputMode === 'file' ? (
                <div
                  className={`cat-import-dropzone${tauriDragHover ? ' cat-dropzone-hover' : ''}`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <div className="cat-dropzone-icon">📄</div>
                  <div className="cat-dropzone-text">
                    {tauriDragHover ? 'Drop file here' : 'Drag & drop a .yaml or .json file'}
                  </div>
                  <div className="cat-dropzone-actions">
                    {isTauri() ? (
                      <button className="cat-btn cat-btn-primary" onClick={handleTauriOpen}>
                        Browse Files
                      </button>
                    ) : (
                      <>
                        <button className="cat-btn cat-btn-primary" onClick={() => fileRef.current?.click()}>
                          Browse Files
                        </button>
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".yaml,.yml,.json"
                          style={{ display: 'none' }}
                          onChange={handleFileInput}
                        />
                      </>
                    )}
                  </div>
                  <div className="cat-dropzone-hint">
                    Supported: OpenAPI 3.0, 3.1, Swagger 2.0
                  </div>
                </div>
              ) : inputMode === 'paste' ? (
                <div className="cat-import-paste">
                  <textarea
                    className="cat-paste-textarea"
                    placeholder="Paste your OpenAPI / Swagger YAML or JSON here..."
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    spellCheck={false}
                    rows={14}
                  />
                  <div className="cat-paste-actions">
                    <button className="cat-btn cat-btn-primary" onClick={handleParsePaste}
                      disabled={!pasteText.trim()}>
                      Parse
                    </button>
                    <span className="cat-dropzone-hint">
                      Supported: OpenAPI 3.0, 3.1, Swagger 2.0
                    </span>
                  </div>
                </div>
              ) : inputMode === 'url' ? (
                <div className="cat-import-url">
                  <div className="cat-url-description">
                    Enter the URL of an OpenAPI / Swagger specification file (YAML or JSON).
                  </div>
                  <div className="cat-url-input-row">
                    <input
                      type="url"
                      className="cat-url-input"
                      placeholder="https://api.example.com/openapi.yaml"
                      value={specUrl}
                      onChange={e => setSpecUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && specUrl.trim()) handleFetchUrl(); }}
                      disabled={urlLoading}
                      spellCheck={false}
                    />
                    <button
                      className="cat-btn cat-btn-primary"
                      onClick={handleFetchUrl}
                      disabled={!specUrl.trim() || urlLoading}
                    >
                      {urlLoading ? 'Fetching...' : 'Fetch'}
                    </button>
                  </div>
                  <div className="cat-url-examples">
                    <div className="cat-url-examples-label">Examples:</div>
                    <button
                      className="cat-url-example"
                      onClick={() => setSpecUrl('https://petstore3.swagger.io/api/v3/openapi.json')}
                    >
                      Petstore v3
                    </button>
                    <button
                      className="cat-url-example"
                      onClick={() => setSpecUrl('https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/stripe.com/2022-11-15/openapi.yaml')}
                    >
                      Stripe API
                    </button>
                  </div>
                  <div className="cat-dropzone-hint">
                    Supported: OpenAPI 3.0, 3.1, Swagger 2.0
                  </div>
                </div>
              ) : inputMode === 'gallery' ? (
                <div className="cat-gallery">
                  <div className="cat-gallery-controls">
                    <input
                      className="cat-gallery-search"
                      type="text"
                      placeholder="Search sample APIs..."
                      value={gallerySearch}
                      onChange={e => setGallerySearch(e.target.value)}
                    />
                    <div className="cat-gallery-pills">
                      {CATALOG_SPEC_CATEGORIES.map(cat => (
                        <button
                          key={cat.key}
                          className={`cat-gallery-pill ${galleryCategory === cat.key ? 'active' : ''}`}
                          onClick={() => setGalleryCategory(cat.key)}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="cat-gallery-grid">
                    {catalogSpecCatalog
                      .filter(s => galleryCategory === 'all' || s.category === galleryCategory)
                      .filter(s => !gallerySearch || s.name.toLowerCase().includes(gallerySearch.toLowerCase()) || s.description.toLowerCase().includes(gallerySearch.toLowerCase()))
                      .map(sample => (
                        <button
                          key={sample.id}
                          className="cat-gallery-card"
                          onClick={() => handleFile(sample.specYaml, `${sample.name}.yaml`)}
                        >
                          <div className="cat-gallery-card-header">
                            <div className="cat-gallery-card-icon">{sample.icon}</div>
                            <div className="cat-gallery-card-name">{sample.name}</div>
                          </div>
                          <div className="cat-gallery-card-desc">{sample.description}</div>
                          <div className="cat-gallery-card-meta">
                            <span className={`cat-gallery-badge cat-gallery-badge-${sample.category}`}>{sample.category}</span>
                            <span className="cat-gallery-card-endpoints">{sample.endpointCount} endpoints</span>
                          </div>
                        </button>
                      ))}
                    {catalogSpecCatalog
                      .filter(s => galleryCategory === 'all' || s.category === galleryCategory)
                      .filter(s => !gallerySearch || s.name.toLowerCase().includes(gallerySearch.toLowerCase()) || s.description.toLowerCase().includes(gallerySearch.toLowerCase()))
                      .length === 0 && (
                      <div className="cat-gallery-empty">No samples match your search.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}

          {step === 'preview' && parsed && (
            <div className="cat-import-preview">
              <div className="cat-preview-status cat-preview-success">
                ✅ Valid {getSpecFormatLabel(parsed.rawSpec)} specification
              </div>
              <div className="cat-preview-filename">📄 {fileName}</div>

              <div className="cat-preview-details">
                <div className="cat-preview-row">
                  <span className="cat-preview-label">Title</span>
                  <span className="cat-preview-value">{parsed.entry.name}</span>
                </div>
                <div className="cat-preview-row">
                  <span className="cat-preview-label">Version</span>
                  <span className="cat-preview-value">{parsed.entry.versions[0]?.version}</span>
                </div>
                {parsed.entry.description && (
                  <div className="cat-preview-row">
                    <span className="cat-preview-label">Description</span>
                    <span className="cat-preview-value cat-preview-desc">{parsed.entry.description}</span>
                  </div>
                )}
                {parsed.entry.servers.length > 0 && (
                  <div className="cat-preview-row">
                    <span className="cat-preview-label">Servers</span>
                    <span className="cat-preview-value">
                      {parsed.entry.servers.map((s, i) => (
                        <div key={i} className="cat-preview-server">
                          {s.url} {s.description && <span className="cat-preview-server-desc">({s.description})</span>}
                        </div>
                      ))}
                    </span>
                  </div>
                )}
                <div className="cat-preview-row">
                  <span className="cat-preview-label">Endpoints</span>
                  <span className="cat-preview-value">
                    {parsed.entry.folders.map(f => (
                      <div key={f.id} className="cat-preview-tag">
                        {f.name} <span className="cat-preview-tag-count">{f.endpoints.length}</span>
                      </div>
                    ))}
                    {parsed.entry.endpoints.length > 0 && (
                      <div className="cat-preview-tag">
                        (untagged) <span className="cat-preview-tag-count">{parsed.entry.endpoints.length}</span>
                      </div>
                    )}
                    <div className="cat-preview-total">
                      Total: {countEndpoints(parsed.entry)} endpoints
                    </div>
                  </span>
                </div>
                {Object.keys(parsed.entry.securitySchemes).length > 0 && (
                  <div className="cat-preview-row">
                    <span className="cat-preview-label">Security</span>
                    <span className="cat-preview-value">
                      {Object.entries(parsed.entry.securitySchemes).map(([name, scheme]) => (
                        <div key={name} className="cat-preview-security">
                          {name} ({scheme.type}{scheme.scheme ? ` / ${scheme.scheme}` : ''})
                        </div>
                      ))}
                    </span>
                  </div>
                )}
              </div>

              {parsed.warnings.length > 0 && (
                <div className="cat-preview-warnings">
                  ⚠ {parsed.warnings.length} warning{parsed.warnings.length > 1 ? 's' : ''}:
                  {parsed.warnings.map((w, i) => (
                    <div key={i} className="cat-preview-warning-item">{w}</div>
                  ))}
                </div>
              )}

              {duplicate && hashMatch && (
                <div className="cat-preview-duplicate cat-preview-nochange">
                  ✅ No changes detected — the spec is identical to the current version ({duplicate.versions[0]?.version}).
                </div>
              )}
              {duplicate && !hashMatch && (
                <div className="cat-preview-duplicate cat-preview-update">
                  ↑ "{duplicate.name}" already exists (v{duplicate.versions[0]?.version}).
                  Importing will add a new version to the existing entry.
                </div>
              )}
            </div>
          )}

          {step === 'error' && (
            <div className="cat-import-error">
              <div className="cat-preview-status cat-preview-error">
                ❌ Invalid specification
              </div>
              {fileName && <div className="cat-preview-filename">📄 {fileName}</div>}
              <div className="cat-error-message">{error}</div>
              <div className="cat-error-hint">Please fix the specification and try again.</div>
            </div>
          )}
    </FullPanelModal>
  );
}
