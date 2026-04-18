import { useState, useRef, useCallback } from 'react';
import type { ParsedSpec, CatalogEntry } from '../../types/catalog';
import { parseOpenApiSpec, getSpecFormatLabel, countEndpoints } from '../../utils/openApiParser';
import { isTauri } from '../../utils/platform';

interface Props {
  existingEntries: CatalogEntry[];
  onImport: (entry: CatalogEntry, rawSpec: string) => void;
  onReimport?: (entryId: string, parsed: ParsedSpec) => void;
  onClose: () => void;
  reimportEntryId?: string;
}

type Step = 'pick' | 'preview' | 'error';
type InputMode = 'file' | 'paste';

export default function CatalogImportModal({ existingEntries, onImport, onReimport, onClose, reimportEntryId }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [parsed, setParsed] = useState<ParsedSpec | null>(null);
  const [fileName, setFileName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (text: string, name: string) => {
    setFileName(name);
    try {
      const result = await parseOpenApiSpec(text);
      setParsed(result);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  }, []);

  const handleParsePaste = useCallback(() => {
    if (!pasteText.trim()) return;
    handleFile(pasteText, 'pasted-spec.yaml');
  }, [pasteText, handleFile]);

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
    <div className="cat-modal-overlay" onClick={onClose}>
      <div className="cat-modal" onClick={e => e.stopPropagation()}>
        <div className="cat-modal-header">
          <h3>{reimportEntryId ? 'Re-import / Update Specification' : 'Import OpenAPI Specification'}</h3>
          <button className="cat-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="cat-modal-body">
          {step === 'pick' && (
            <>
              <div className="cat-import-tabs">
                <button className={`cat-import-tab ${inputMode === 'file' ? 'active' : ''}`}
                  onClick={() => setInputMode('file')}>Upload File</button>
                <button className={`cat-import-tab ${inputMode === 'paste' ? 'active' : ''}`}
                  onClick={() => setInputMode('paste')}>Paste YAML / JSON</button>
              </div>

              {inputMode === 'file' ? (
                <div
                  className="cat-import-dropzone"
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <div className="cat-dropzone-icon">📄</div>
                  <div className="cat-dropzone-text">
                    Drag & drop a .yaml or .json file
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
              ) : (
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
              )}
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
        </div>

        <div className="cat-modal-footer">
          <button className="cat-btn" onClick={step === 'error' || step === 'preview'
            ? () => { setStep('pick'); setParsed(null); setError(''); }
            : onClose
          }>
            {step === 'pick' ? 'Cancel' : 'Back'}
          </button>
          {step === 'preview' && (
            <button className="cat-btn cat-btn-primary" onClick={handleImport}>
              {duplicate && !hashMatch ? 'Update' : hashMatch ? 'Import Anyway' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
