import { useState, useMemo, useRef, useCallback } from 'react';
import type { Environment, Microservice, FeatureGroup, GlobalAuthProfile } from '../../shared/types';
import { saveJsonFile, buildExportFilename, openJsonFile } from '../../shared/utils/fileSaver';
import { isTauri } from '../../shared/utils/platform';
import { countVersions, hasVersionData, stripVersions } from '../scenarios/utils/scenarioImportExport';

interface ParsedImport {
  environments: Environment[];
  microservices: Microservice[];
  featureGroups: FeatureGroup[];
  globalAuthProfiles: GlobalAuthProfile[];
  exportedAt?: string;
  version?: string;
}

interface Props {
  environments: Environment[];
  microservices: Microservice[];
  featureGroups: FeatureGroup[];
  appGlobalAuthProfiles: GlobalAuthProfile[];
  onImport: (data: {
    environments?: Environment[];
    microservices?: Microservice[];
    featureGroups?: FeatureGroup[];
    globalAuthProfiles?: GlobalAuthProfile[];
  }) => void;
}

export default function SettingsExportImportTab({ environments, microservices, featureGroups, appGlobalAuthProfiles, onImport }: Props) {
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // ── Export state ──
  const [exportEnvs, setExportEnvs] = useState<Set<string>>(() => new Set(environments.map(e => e.id)));
  const [exportAuth, setExportAuth] = useState<Set<string>>(() => new Set(appGlobalAuthProfiles.map(a => a.id)));
  const [maskSecrets, setMaskSecrets] = useState(false);
  const [includeResponseVersions, setIncludeResponseVersions] = useState(true);
  const [includeRulesVersions, setIncludeRulesVersions] = useState(true);

  // ── Import state ──
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [importAuth, setImportAuth] = useState(true);
  const [importResponseVersions, setImportResponseVersions] = useState(true);
  const [importRulesVersions, setImportRulesVersions] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalSelected = exportEnvs.size + exportAuth.size;
  const exportVersionCounts = useMemo(() => countVersions(featureGroups), [featureGroups]);

  const toggleAll = (ids: string[], set: Set<string>, setter: (s: Set<string>) => void) => {
    if (ids.every(id => set.has(id))) setter(new Set());
    else setter(new Set(ids));
  };

  const toggle = (id: string, set: Set<string>, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  // ── Export handler ──
  const handleExport = async () => {
    const selectedEnvs = environments.filter(e => exportEnvs.has(e.id));
    const selectedSvcs = microservices.filter(s => {
      const envIds = Object.keys(s.baseUrls ?? {});
      return envIds.some(eid => exportEnvs.has(eid));
    });

    let exportFgs = featureGroups;
    if (!includeResponseVersions || !includeRulesVersions) {
      exportFgs = stripVersions(featureGroups, { includeResponseVersions, includeRulesVersions, includeDefinitionVersions: true, includeStructureLog: true }) as FeatureGroup[];
    }

    const data: Record<string, unknown> = {
      environments: selectedEnvs,
      microservices: selectedSvcs,
      featureGroups: exportFgs,
      exportedAt: new Date().toISOString(),
      version: '3.0',
    };

    if (exportAuth.size > 0) {
      let profiles = appGlobalAuthProfiles.filter(a => exportAuth.has(a.id));
      if (maskSecrets) {
        profiles = profiles.map(p => ({
          ...p,
          auth: { ...p.auth, clientSecret: p.auth.type === 'oauth2' ? '***masked***' : (p.auth as Record<string, unknown>).clientSecret } as typeof p.auth,
        }));
      }
      data.appGlobalAuthProfiles = profiles;
    }

    const filename = buildExportFilename({ level: 'data', name: 'redfire-export' });
    await saveJsonFile(data, filename);
  };

  // ── Import file processing ──
  const processJson = useCallback((jsonText: string, name: string) => {
    setFileName(name);
    setParseError(null);
    setParsed(null);
    try {
      const data = JSON.parse(jsonText);
      if (Array.isArray(data.environments) || Array.isArray(data.microservices) || Array.isArray(data.featureGroups)) {
        let fgs: FeatureGroup[] = data.featureGroups ?? [];
        fgs = fgs.map((fg: FeatureGroup) => {
          const copy = { ...fg };
          if ('projectId' in copy) delete (copy as Record<string, unknown>).projectId;
          return copy;
        });
        const auth: GlobalAuthProfile[] = [...(data.globalAuthProfiles ?? []), ...(data.appGlobalAuthProfiles ?? [])];
        setParsed({
          environments: data.environments ?? [],
          microservices: data.microservices ?? [],
          featureGroups: fgs,
          globalAuthProfiles: auth,
          exportedAt: data.exportedAt,
          version: data.version,
        });
        return;
      }
      setParseError('File does not contain recognizable data.');
    } catch {
      setParseError('Invalid JSON file.');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => processJson(reader.result as string, file.name);
    reader.onerror = () => setParseError('Failed to read file.');
    reader.readAsText(file);
  };

  const handleTauriOpen = useCallback(async () => {
    const result = await openJsonFile();
    if (!result) return;
    processJson(result.content, result.name);
  }, [processJson]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => processJson(reader.result as string, file.name);
    reader.onerror = () => setParseError('Failed to read file.');
    reader.readAsText(file);
  }, [processJson]);

  const handleImport = () => {
    if (!parsed) return;
    const existingEnvIds = new Set(environments.map(e => e.id));
    const existingSvcIds = new Set(microservices.map(s => s.id));
    const existingAuthIds = new Set(appGlobalAuthProfiles.map(a => a.id));
    let fgs = parsed.featureGroups;
    if (!importResponseVersions || !importRulesVersions) {
      fgs = stripVersions(fgs, { includeResponseVersions: importResponseVersions, includeRulesVersions: importRulesVersions, includeDefinitionVersions: true, includeStructureLog: true }) as FeatureGroup[];
    }
    onImport({
      environments: parsed.environments.filter(e => !existingEnvIds.has(e.id)),
      microservices: parsed.microservices.filter(s => !existingSvcIds.has(s.id)),
      featureGroups: fgs,
      globalAuthProfiles: importAuth ? parsed.globalAuthProfiles.filter(a => !existingAuthIds.has(a.id)) : undefined,
    });
    setParsed(null);
    setFileName('');
  };

  const importSummary = useMemo(() => {
    if (!parsed) return null;
    const existingEnvIds = new Set(environments.map(e => e.id));
    const existingSvcIds = new Set(microservices.map(s => s.id));
    return {
      newEnvs: parsed.environments.filter(e => !existingEnvIds.has(e.id)).length,
      totalEnvs: parsed.environments.length,
      newSvcs: parsed.microservices.filter(s => !existingSvcIds.has(s.id)).length,
      totalSvcs: parsed.microservices.length,
      fgs: parsed.featureGroups.length,
      auth: parsed.globalAuthProfiles.length,
      ...countVersions(parsed.featureGroups),
    };
  }, [parsed, environments, microservices]);

  return (
    <div className="settings-section exi-inline">
      <h4>EXPORT &amp; IMPORT</h4>
      <p className="settings-section-desc">Export all environments and auth profiles to a JSON file, or import from one.</p>

      <div className="exi-card">
        {/* ── Tab bar ── */}
        <div className="exi-tabs">
          <button
            className={`exi-tab${activeTab === 'export' ? ' active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <span className="exi-tab-icon">↓</span>
            Export
          </button>
          <button
            className={`exi-tab${activeTab === 'import' ? ' active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            <span className="exi-tab-icon">↑</span>
            Import
          </button>
        </div>

        {/* ── Export pane ── */}
        {activeTab === 'export' && (
          <div className="exi-pane">
            <p className="exi-hint">Select items to include in the export file.</p>

            <div className="exi-checklist">
              <label className="exi-group-header">
                <input
                  type="checkbox"
                  checked={environments.length > 0 && environments.every(e => exportEnvs.has(e.id))}
                  onChange={() => toggleAll(environments.map(e => e.id), exportEnvs, setExportEnvs)}
                />
                <strong>Environments</strong>
                <span className="exi-count">({exportEnvs.size}/{environments.length})</span>
              </label>
              <div className="exi-items">
                {environments.map(e => (
                  <label key={e.id} className="exi-item">
                    <input type="checkbox" checked={exportEnvs.has(e.id)} onChange={() => toggle(e.id, exportEnvs, setExportEnvs)} />
                    <span className="exi-item-name">{e.name}</span>
                  </label>
                ))}
              </div>

              {appGlobalAuthProfiles.length > 0 && (
                <>
                  <label className="exi-group-header">
                    <input
                      type="checkbox"
                      checked={appGlobalAuthProfiles.every(a => exportAuth.has(a.id))}
                      onChange={() => toggleAll(appGlobalAuthProfiles.map(a => a.id), exportAuth, setExportAuth)}
                    />
                    <strong>Global Auth Profiles</strong>
                    <span className="exi-count">({exportAuth.size}/{appGlobalAuthProfiles.length})</span>
                  </label>
                  <div className="exi-items">
                    {appGlobalAuthProfiles.map(a => (
                      <label key={a.id} className="exi-item">
                        <input type="checkbox" checked={exportAuth.has(a.id)} onChange={() => toggle(a.id, exportAuth, setExportAuth)} />
                        <span className="exi-item-name">{a.name}</span>
                        <span className="exi-tag">{a.auth.type.toUpperCase()}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="exi-pane-footer">
              <label className="exi-item exi-mask">
                <input type="checkbox" checked={maskSecrets} onChange={(e) => setMaskSecrets(e.target.checked)} />
                Mask secrets on export
              </label>
              {hasVersionData(featureGroups) && (
                <div className="exi-version-opts">
                  {exportVersionCounts.responseVersionCount > 0 && (
                    <label className="exi-item">
                      <input type="checkbox" checked={includeResponseVersions} onChange={(e) => setIncludeResponseVersions(e.target.checked)} />
                      Include response versions ({exportVersionCounts.responseVersionCount})
                    </label>
                  )}
                  {exportVersionCounts.rulesVersionCount > 0 && (
                    <label className="exi-item">
                      <input type="checkbox" checked={includeRulesVersions} onChange={(e) => setIncludeRulesVersions(e.target.checked)} />
                      Include rules versions ({exportVersionCounts.rulesVersionCount})
                    </label>
                  )}
                </div>
              )}
              <button className="btn btn-primary exi-action-btn" onClick={handleExport} disabled={totalSelected === 0}>
                ↓ Export ({totalSelected} selected)
              </button>
            </div>
          </div>
        )}

        {/* ── Import pane ── */}
        {activeTab === 'import' && (
          <div className="exi-pane">
            <p className="exi-hint">Drop a JSON file or click to browse.</p>

            {!parsed ? (
              <div
                className={`exi-dropzone${dragging ? ' dragging' : ''}`}
                onClick={isTauri() ? handleTauriOpen : () => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div className="exi-dropzone-visual">
                  <span className="exi-dropzone-icon">⇧</span>
                  <span className="exi-dropzone-label">Drop file here</span>
                  <span className="exi-dropzone-or">or</span>
                  <span className="exi-dropzone-browse">Browse files</span>
                </div>
                <span className="exi-dropzone-formats">.json</span>
                {!isTauri() && <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelect} />}
              </div>
            ) : (
              <div className="exi-import-preview">
                <div className="exi-import-file">
                  <span className="exi-import-file-icon">📄</span>
                  <div className="exi-import-file-info">
                    <span className="exi-import-file-name">{fileName}</span>
                    {parsed.version && <span className="exi-import-file-meta">v{parsed.version}{parsed.exportedAt ? ` · ${new Date(parsed.exportedAt).toLocaleDateString()}` : ''}</span>}
                  </div>
                  <button className="btn btn-xs btn-ghost" onClick={() => { setParsed(null); setFileName(''); }}>✕</button>
                </div>

                {importSummary && (
                  <div className="exi-import-summary">
                    <div className="exi-import-summary-title">Contents</div>
                    {importSummary.totalEnvs > 0 && (
                      <div className="exi-import-row">
                        <span>{importSummary.newEnvs} new environment{importSummary.newEnvs !== 1 ? 's' : ''}</span>
                        {importSummary.totalEnvs !== importSummary.newEnvs && <span className="exi-skip">{importSummary.totalEnvs - importSummary.newEnvs} exist</span>}
                      </div>
                    )}
                    {importSummary.totalSvcs > 0 && (
                      <div className="exi-import-row">
                        <span>{importSummary.newSvcs} new microservice{importSummary.newSvcs !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {importSummary.fgs > 0 && (
                      <div className="exi-import-row">
                        <span>{importSummary.fgs} feature group{importSummary.fgs !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                )}

                {parsed.globalAuthProfiles.length > 0 && (
                  <label className="exi-item">
                    <input type="checkbox" checked={importAuth} onChange={(e) => setImportAuth(e.target.checked)} />
                    Include {parsed.globalAuthProfiles.length} auth profile{parsed.globalAuthProfiles.length !== 1 ? 's' : ''}
                  </label>
                )}

                {importSummary && hasVersionData(parsed?.featureGroups) && (
                  <div className="exi-version-opts">
                    {importSummary.responseVersionCount > 0 && (
                      <label className="exi-item">
                        <input type="checkbox" checked={importResponseVersions} onChange={(e) => setImportResponseVersions(e.target.checked)} />
                        Include response versions ({importSummary.responseVersionCount})
                      </label>
                    )}
                    {importSummary.rulesVersionCount > 0 && (
                      <label className="exi-item">
                        <input type="checkbox" checked={importRulesVersions} onChange={(e) => setImportRulesVersions(e.target.checked)} />
                        Include rules versions ({importSummary.rulesVersionCount})
                      </label>
                    )}
                  </div>
                )}

                <button className="btn btn-primary exi-action-btn" onClick={handleImport}>
                  ↑ Import
                </button>
              </div>
            )}
            {parseError && <div className="exi-error">{parseError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
