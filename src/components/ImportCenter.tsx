import { useState, useMemo, useRef, useCallback } from 'react';
import type { Environment, Microservice, FeatureGroup, TestRun, GlobalAuthProfile } from '../types';
import { isTauri } from '../utils/platform';
import { openJsonFile } from '../utils/fileSaver';

interface ParsedImport {
  environments: Environment[];
  microservices: Microservice[];
  featureGroups: FeatureGroup[];
  globalAuthProfiles: GlobalAuthProfile[];
  testRuns: TestRun[];
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
  onClose: () => void;
}

export default function ImportCenter({ environments, microservices, featureGroups, appGlobalAuthProfiles, onImport, onClose }: Props) {
  void featureGroups;
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [includeGlobalAuth, setIncludeGlobalAuth] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processJson = useCallback((jsonText: string, name: string) => {
    setFileName(name);
    setParseError(null);
    setParsed(null);

    try {
      const data = JSON.parse(jsonText);

      // v3 flat format: { environments, microservices, featureGroups, ... }
      if (Array.isArray(data.environments) || Array.isArray(data.microservices) || Array.isArray(data.featureGroups)) {
        // Could also be a v2 project wrapper — check for projects array
        if (data.projects && Array.isArray(data.projects)) {
          // v2 format: extract from first project + merge all
          const projects = data.projects as Array<{
            environments?: Environment[]; microservices?: Microservice[];
            globalAuthProfiles?: GlobalAuthProfile[]; featureGroups?: FeatureGroup[];
          }>;
          let envs: Environment[] = [];
          let svcs: Microservice[] = [];
          let fgs: FeatureGroup[] = [];
          let auth: GlobalAuthProfile[] = [];
          const envIds = new Set<string>();
          const svcIds = new Set<string>();
          const authIds = new Set<string>();
          for (const p of projects) {
            for (const e of (p.environments ?? [])) if (!envIds.has(e.id)) { envs.push(e); envIds.add(e.id); }
            for (const s of (p.microservices ?? [])) if (!svcIds.has(s.id)) { svcs.push(s); svcIds.add(s.id); }
            for (const a of (p.globalAuthProfiles ?? [])) if (!authIds.has(a.id)) { auth.push(a); authIds.add(a.id); }
            fgs.push(...(p.featureGroups ?? []));
          }
          const appAuth: GlobalAuthProfile[] = data.appGlobalAuthProfiles ?? [];
          for (const a of appAuth) if (!authIds.has(a.id)) { auth.push(a); authIds.add(a.id); }

          setParsed({
            environments: envs,
            microservices: svcs,
            featureGroups: fgs,
            globalAuthProfiles: auth,
            testRuns: data.testRuns ?? [],
            exportedAt: data.exportedAt,
            version: data.version,
          });
          return;
        }

        // v3 or legacy flat
        let fgs: FeatureGroup[] = data.featureGroups ?? [];
        fgs = fgs.map((fg: FeatureGroup) => {
          const copy = { ...fg };
          if ('projectId' in copy) delete (copy as Record<string, unknown>).projectId;
          return copy;
        });

        const auth: GlobalAuthProfile[] = [
          ...(data.globalAuthProfiles ?? []),
          ...(data.appGlobalAuthProfiles ?? []),
        ];

        setParsed({
          environments: data.environments ?? [],
          microservices: data.microservices ?? [],
          featureGroups: fgs,
          globalAuthProfiles: auth,
          testRuns: data.testRuns ?? [],
          exportedAt: data.exportedAt,
          version: data.version,
        });
        return;
      }

      setParseError('File does not contain any recognizable data (no environments, microservices, or feature groups found).');
    } catch {
      setParseError('Invalid JSON file. Please select a valid export file.');
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

  const summary = useMemo(() => {
    if (!parsed) return null;
    const existingEnvIds = new Set(environments.map(e => e.id));
    const existingSvcIds = new Set(microservices.map(s => s.id));
    const existingAuthIds = new Set(appGlobalAuthProfiles.map(a => a.id));
    const newEnvs = parsed.environments.filter(e => !existingEnvIds.has(e.id));
    const newSvcs = parsed.microservices.filter(s => !existingSvcIds.has(s.id));
    const newAuth = parsed.globalAuthProfiles.filter(a => !existingAuthIds.has(a.id));
    return { newEnvs: newEnvs.length, newSvcs: newSvcs.length, newAuth: newAuth.length, newFGs: parsed.featureGroups.length, ...parsed };
  }, [parsed, environments, microservices, appGlobalAuthProfiles]);

  const handleImport = () => {
    if (!parsed) return;
    const existingEnvIds = new Set(environments.map(e => e.id));
    const existingSvcIds = new Set(microservices.map(s => s.id));
    const existingAuthIds = new Set(appGlobalAuthProfiles.map(a => a.id));

    onImport({
      environments: parsed.environments.filter(e => !existingEnvIds.has(e.id)),
      microservices: parsed.microservices.filter(s => !existingSvcIds.has(s.id)),
      featureGroups: parsed.featureGroups,
      globalAuthProfiles: includeGlobalAuth ? parsed.globalAuthProfiles.filter(a => !existingAuthIds.has(a.id)) : undefined,
    });
  };

  return (
    <div className="modal-overlay settings-overlay" onClick={onClose}>
      <div className={`modal settings-modal import-center-modal ${maximized ? 'modal-maximized' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Import Data</h3>
          <div className="import-header-actions">
            <button className="btn btn-sm" onClick={() => setMaximized((v) => !v)} title={maximized ? 'Restore' : 'Maximize'}>
              {maximized ? '⊡' : '⊞'}
            </button>
            <button className="btn btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="import-center-body">
          <div className="import-file-section">
            <p className="settings-section-desc">
              Select a previously exported JSON file. Supports both current (v3) and legacy (v2) formats.
            </p>
            <div className="import-file-row">
              <button className="btn btn-sm btn-primary" onClick={isTauri() ? handleTauriOpen : () => fileRef.current?.click()}>Choose File</button>
              <span className="import-file-name">{fileName || 'No file selected'}</span>
              {!isTauri() && <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelect} />}
            </div>
            {parseError && <div className="import-error">{parseError}</div>}
          </div>

          {parsed && (
            <>
              {parsed.exportedAt && (
                <div className="import-meta">
                  Exported: {new Date(parsed.exportedAt).toLocaleString()}
                  {parsed.version && <> · v{parsed.version}</>}
                </div>
              )}

              <div className="import-sections">
                <div className="import-section-card">
                  <div className="import-item-row">
                    <div className="import-item-main">
                      <span style={{ fontWeight: 600 }}>Data to Import</span>
                    </div>
                  </div>
                  <div style={{ padding: '8px 16px', fontSize: '0.9em' }}>
                    {parsed.environments.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontWeight: 500 }}>{parsed.environments.length} environment{parsed.environments.length !== 1 ? 's' : ''}</span>
                        {summary && summary.newEnvs < parsed.environments.length && (
                          <span style={{ opacity: 0.6, marginLeft: 8 }}>({parsed.environments.length - summary.newEnvs} already exist, will skip)</span>
                        )}
                      </div>
                    )}
                    {parsed.microservices.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontWeight: 500 }}>{parsed.microservices.length} microservice{parsed.microservices.length !== 1 ? 's' : ''}</span>
                        {summary && summary.newSvcs < parsed.microservices.length && (
                          <span style={{ opacity: 0.6, marginLeft: 8 }}>({parsed.microservices.length - summary.newSvcs} already exist, will skip)</span>
                        )}
                      </div>
                    )}
                    {parsed.featureGroups.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontWeight: 500 }}>{parsed.featureGroups.length} feature group{parsed.featureGroups.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>

                {parsed.globalAuthProfiles.length > 0 && (
                  <div className="import-section-card" style={{ marginTop: 8 }}>
                    <div className="import-item-row">
                      <div className="import-item-main">
                        <input type="checkbox" checked={includeGlobalAuth} onChange={(e) => setIncludeGlobalAuth(e.target.checked)} />
                        <span style={{ fontWeight: 500 }}>Include {parsed.globalAuthProfiles.length} auth profile{parsed.globalAuthProfiles.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    {includeGlobalAuth && (
                      <div style={{ padding: '4px 16px 8px 40px', opacity: 0.8, fontSize: '0.85em' }}>
                        {parsed.globalAuthProfiles.map((p) => (
                          <div key={p.id} style={{ marginBottom: 2 }}>
                            {p.name} — {p.auth.type}
                            {appGlobalAuthProfiles.some((g) => g.id === p.id) && <span style={{ opacity: 0.5, marginLeft: 8 }}>(already exists, will skip)</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="import-center-footer">
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!parsed}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
