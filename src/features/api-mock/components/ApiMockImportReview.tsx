import { useState } from 'react';
import type { ApiMockRouteV1, ApiMockDiagnosticV1 } from '../../../shared/api-mock/contracts';
import { convertSourceToRule, type SourceRequest, type ConversionOptions } from '../../../shared/api-mock/sourceToRule';

interface Props {
  onImport: (routes: ApiMockRouteV1[]) => void;
  onCancel: () => void;
}

type ImportMode = 'merge' | 'replace' | 'copy';

export function ApiMockImportReview({ onImport, onCancel }: Props) {
  const [source, setSource] = useState<'curl' | 'openapi' | 'native'>('curl');
  const [curlInput, setCurlInput] = useState('');
  const [mode, setMode] = useState<ImportMode>('merge');
  const [preview, setPreview] = useState<{ route: ApiMockRouteV1; diagnostics: ApiMockDiagnosticV1[] } | null>(null);

  const handleParse = () => {
    if (source !== 'curl' || !curlInput.trim()) return;
    const parsed = parseCurlToSource(curlInput);
    const opts: ConversionOptions = { sourceKind: 'curl', sourceLabel: 'cURL import' };
    const result = convertSourceToRule(parsed, opts);
    setPreview({ route: result.route, diagnostics: result.diagnostics });
  };

  const handleConfirm = () => {
    if (!preview) return;
    onImport([preview.route]);
  };

  return (
    <div className="api-mock-root api-mock-import-review" data-testid="api-mock-import-review">
      <div className="am-editor-header">
        <div className="am-editor-title">Import &amp; Promotion</div>
        <span className="am-spacer" />
        <span className="am-muted" style={{ fontSize: 11 }}>Mode</span>
        <div className="am-segmented">
          {(['merge', 'replace', 'copy'] as ImportMode[]).map(m => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)} data-testid={`api-mock-import-mode-${m}`}>{m}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 0, flex: 1, minHeight: 0 }}>
        <div style={{ padding: 10, borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="am-section-heading">Source</div>
          {(['curl', 'openapi', 'native'] as const).map(s => (
            <button key={s} className={`am-btn small${source === s ? ' primary' : ''}`} style={{ width: '100%', marginBottom: 5, justifyContent: 'flex-start' }}
              onClick={() => setSource(s)} data-testid={`api-mock-import-source-${s}`}>
              {s === 'curl' ? 'cURL command' : s === 'openapi' ? 'OpenAPI/Swagger' : 'RedfireForge/WireMock'}
            </button>
          ))}
        </div>

        <div style={{ padding: 14, overflow: 'auto' }}>
          {source === 'curl' && (
            <>
              <div className="am-section-heading">cURL input</div>
              <textarea
                className="am-textarea"
                rows={4}
                value={curlInput}
                onChange={e => setCurlInput(e.target.value)}
                placeholder="curl -X POST https://api.example.com/users -H ..."
                data-testid="api-mock-curl-input"
              />
              <button className="am-btn primary" style={{ marginTop: 8 }} onClick={handleParse} data-testid="api-mock-curl-parse">
                Parse
              </button>

              {preview && (
                <div style={{ marginTop: 14 }}>
                  {preview.diagnostics.length > 0 && (
                    <div className="am-section-heading">Diagnostics</div>
                  )}
                  {preview.diagnostics.map((d, i) => (
                    <div key={i} className={`am-notice ${d.severity === 'error' ? 'danger' : d.severity === 'warning' ? 'warning' : ''}`} style={{ marginBottom: 6 }}>
                      <span><strong>{d.code}:</strong> {d.message}</span>
                    </div>
                  ))}
                  <div className="am-section-heading">Generated route (exact-by-default)</div>
                  <div className="am-form-grid">
                    <div className="am-form-row">
                      <div className="am-form-label">Method</div>
                      <div className="am-form-control"><span className={`am-method ${preview.route.method.toLowerCase()}`}>{preview.route.method}</span></div>
                    </div>
                    <div className="am-form-row">
                      <div className="am-form-label">Path</div>
                      <div className="am-form-control"><span className="am-mono">{preview.route.path.value}</span></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', marginTop: 12, gap: 8 }}>
                    <button className="am-btn primary" onClick={handleConfirm} data-testid="api-mock-import-confirm">
                      Import as draft
                    </button>
                    <button className="am-btn" onClick={onCancel} data-testid="api-mock-import-cancel">Cancel</button>
                  </div>
                  <div className="am-notice" style={{ marginTop: 8 }}>
                    <span>The imported route will be <strong>inactive</strong> until you enable it.</span>
                  </div>
                </div>
              )}
            </>
          )}
          {source !== 'curl' && (
            <div className="am-empty-conditions">
              {source === 'openapi' ? 'OpenAPI/Swagger import — paste or select a spec file.' : 'RedfireForge/WireMock import — select a definition file.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function parseCurlToSource(curl: string): SourceRequest {
  const method = curl.match(/-X\s+(\w+)/i)?.[1] ?? 'GET';
  const urlMatch = curl.match(/(?:curl\s+)?(?:-[^\s]+\s+)*['"]?(https?:\/\/[^\s'"]+)/i) ?? curl.match(/['"]?(\/[^\s'"]*)/);
  const rawUrl = urlMatch?.[1] ?? '/';
  let path: string;
  try { path = new URL(rawUrl).pathname; } catch { path = rawUrl.split('?')[0]; }
  const headers: Record<string, string> = {};
  for (const m of curl.matchAll(/-H\s+['"]([^'"]+)['"]/gi)) {
    const [key, ...rest] = m[1].split(':');
    if (key) headers[key.trim()] = rest.join(':').trim();
  }
  const bodyMatch = curl.match(/-d\s+['"]([^'"]*)['"]/i) ?? curl.match(/--data(?:-raw)?\s+['"]([^'"]*)['"]/i);
  const body = bodyMatch?.[1];
  const ct = headers['Content-Type'] || headers['content-type'];

  return { method, path, headers, body, contentType: ct };
}
