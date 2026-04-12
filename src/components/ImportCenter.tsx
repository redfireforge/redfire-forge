import { useState, useMemo, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Environment, Microservice, FeatureGroup, TestRun, GlobalAuthProfile, Project } from '../types';
import { isTauri } from '../utils/platform';
import { openJsonFile } from '../utils/fileSaver';

type ConflictAction = 'add' | 'skip' | 'overwrite' | 'keepBoth';

interface ProjectImportItem {
  project: Project;
  status: 'new' | 'conflict-id' | 'conflict-name';
  existingProject?: Project;
  action: ConflictAction;
  checked: boolean;
}

interface LegacyData {
  environments?: Environment[];
  microservices?: Microservice[];
  globalAuthProfiles?: GlobalAuthProfile[];
  featureGroups?: FeatureGroup[];
}

interface ParsedImport {
  format: 'v2' | 'legacy';
  projectItems: ProjectImportItem[];
  importGlobalAuthProfiles: GlobalAuthProfile[];
  testRuns: TestRun[];
  exportedAt?: string;
  version?: string;
}

interface Props {
  projects: Project[];
  appGlobalAuthProfiles: GlobalAuthProfile[];
  onImport: (project: Project) => void;
  onImportGlobalAuth: (profiles: GlobalAuthProfile[]) => void;
  onClose: () => void;
}

export default function ImportCenter({ projects, appGlobalAuthProfiles, onImport, onImportGlobalAuth, onClose }: Props) {
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [legacyProjectName, setLegacyProjectName] = useState('Imported Project');
  const [includeGlobalAuth, setIncludeGlobalAuth] = useState(true);
  const [includeRuns, setIncludeRuns] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const resolveProjectItems = useCallback((incoming: Project[]): ProjectImportItem[] => {
    const existingById = new Map(projects.map((p) => [p.id, p]));
    const existingByName = new Map(projects.map((p) => [p.name.toLowerCase(), p]));

    return incoming.map((proj) => {
      const byId = existingById.get(proj.id);
      if (byId) {
        return { project: proj, status: 'conflict-id', existingProject: byId, action: 'overwrite', checked: true };
      }
      const byName = existingByName.get(proj.name.toLowerCase());
      if (byName) {
        return { project: proj, status: 'conflict-name', existingProject: byName, action: 'overwrite', checked: true };
      }
      return { project: proj, status: 'new', action: 'add', checked: true };
    });
  }, [projects]);

  const wrapLegacyAsProject = useCallback((data: LegacyData, name: string): Project => {
    const fgs = (data.featureGroups ?? []).map((fg) => {
      const { ...rest } = fg;
      if ('projectId' in rest) delete (rest as Record<string, unknown>).projectId;
      return rest;
    });
    return {
      id: uuidv4(),
      name,
      description: 'Imported from legacy format',
      createdAt: Date.now(),
      environments: data.environments ?? [],
      microservices: data.microservices ?? [],
      globalAuthProfiles: data.globalAuthProfiles ?? [],
      featureGroups: fgs,
    };
  }, []);

  const processJson = useCallback((jsonText: string, name: string) => {
    setFileName(name);
    setParseError(null);
    setParsed(null);
    setExpandedItems(new Set());

    try {
      const data = JSON.parse(jsonText);

      // Detect v2 format: { projects: Project[], ... }
      if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
        const firstProject = data.projects[0];
        const isV2 = Array.isArray(firstProject.environments) ||
                      Array.isArray(firstProject.microservices) ||
                      Array.isArray(firstProject.featureGroups);

        if (isV2) {
          const projectItems = resolveProjectItems(data.projects as Project[]);
          const incomingGlobalAuth: GlobalAuthProfile[] = data.appGlobalAuthProfiles ?? [];
          setParsed({
            format: 'v2',
            projectItems,
            importGlobalAuthProfiles: incomingGlobalAuth,
            testRuns: data.testRuns ?? [],
            exportedAt: data.exportedAt,
            version: data.version,
          });
          return;
        }
      }

      // Legacy format: { environments?, microservices?, globalAuthProfiles?, featureGroups?, ... }
      const hasLegacy = data.environments || data.microservices || data.globalAuthProfiles || data.featureGroups;
      if (hasLegacy) {
        const legacyName = name.replace(/\.json$/i, '').replace(/[-_]/g, ' ') || 'Imported Project';
        setLegacyProjectName(legacyName);
        const project = wrapLegacyAsProject(data as LegacyData, legacyName);
        const projectItems = resolveProjectItems([project]);

        setParsed({
          format: 'legacy',
          projectItems,
          importGlobalAuthProfiles: [],
          testRuns: data.testRuns ?? [],
          exportedAt: data.exportedAt,
          version: data.version,
        });
        return;
      }

      setParseError('File does not contain any recognizable data (no projects, environments, microservices, or feature groups found).');
    } catch {
      setParseError('Invalid JSON file. Please select a valid export file.');
    }
  }, [resolveProjectItems, wrapLegacyAsProject]);

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

  const updateLegacyName = (newName: string) => {
    setLegacyProjectName(newName);
    if (parsed && parsed.format === 'legacy' && parsed.projectItems.length > 0) {
      setParsed({
        ...parsed,
        projectItems: parsed.projectItems.map((pi) => ({
          ...pi,
          project: { ...pi.project, name: newName },
        })),
      });
    }
  };

  const updateItemAction = (idx: number, action: ConflictAction) => {
    if (!parsed) return;
    setParsed({
      ...parsed,
      projectItems: parsed.projectItems.map((pi, i) =>
        i === idx ? { ...pi, action } : pi
      ),
    });
  };

  const toggleItemChecked = (idx: number) => {
    if (!parsed) return;
    setParsed({
      ...parsed,
      projectItems: parsed.projectItems.map((pi, i) =>
        i === idx ? { ...pi, checked: !pi.checked } : pi
      ),
    });
  };

  const summary = useMemo(() => {
    if (!parsed) return null;
    const active = parsed.projectItems.filter((pi) => pi.checked && !(pi.status !== 'new' && pi.action === 'skip'));
    const totalEnvs = active.reduce((s, pi) => s + pi.project.environments.length, 0);
    const totalSvcs = active.reduce((s, pi) => s + pi.project.microservices.length, 0);
    const totalAuth = active.reduce((s, pi) => s + pi.project.globalAuthProfiles.length, 0);
    const totalFGs = active.reduce((s, pi) => s + pi.project.featureGroups.length, 0);
    return { count: active.length, totalEnvs, totalSvcs, totalAuth, totalFGs };
  }, [parsed]);

  const handleImport = () => {
    if (!parsed) return;
    const activeItems = parsed.projectItems.filter((pi) => pi.checked && !(pi.status !== 'new' && pi.action === 'skip'));

    for (const pi of activeItems) {
      let projectToImport = pi.project;

      if (pi.action === 'keepBoth') {
        projectToImport = { ...pi.project, id: uuidv4(), name: `${pi.project.name} (copy)` };
      } else if (pi.action === 'overwrite' && pi.existingProject) {
        projectToImport = { ...pi.project, id: pi.existingProject.id };
      }

      onImport(projectToImport);
    }

    if (includeGlobalAuth && parsed.importGlobalAuthProfiles.length > 0) {
      const existingIds = new Set(appGlobalAuthProfiles.map((p) => p.id));
      const newProfiles = parsed.importGlobalAuthProfiles.filter((p) => !existingIds.has(p.id));
      if (newProfiles.length > 0) {
        onImportGlobalAuth(newProfiles);
      }
    }
  };

  const activeCount = parsed?.projectItems.filter((pi) => pi.checked && !(pi.status !== 'new' && pi.action === 'skip')).length ?? 0;

  return (
    <div className="modal-overlay settings-overlay" onClick={onClose}>
      <div className={`modal settings-modal import-center-modal ${maximized ? 'modal-maximized' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Import Project</h3>
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
              Select a previously exported JSON file. Each project contains its own environments, microservices, auth profiles, and feature groups.
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
                  {parsed.format === 'legacy' && <span className="import-badge import-badge-conflict" style={{ marginLeft: 8 }}>Legacy Format</span>}
                </div>
              )}

              {parsed.format === 'legacy' && (
                <div className="import-project-assign">
                  <div className="import-project-assign-header">
                    <strong>Legacy File Detected</strong>
                  </div>
                  <div className="import-project-assign-body">
                    <p className="settings-section-desc">
                      This file uses the old format without project containers. All data will be wrapped into a single project. Choose a name for it:
                    </p>
                    <div className="import-project-create">
                      <label>Project name:</label>
                      <input
                        value={legacyProjectName}
                        onChange={(e) => updateLegacyName(e.target.value)}
                        placeholder="e.g. My Project"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="import-sections">
                {parsed.projectItems.map((pi, idx) => {
                  const isExpanded = expandedItems.has(pi.project.id);
                  const p = pi.project;
                  return (
                    <div key={pi.project.id} className={`import-section-card ${!pi.checked ? 'import-item-disabled' : ''}`}>
                      <div className="import-item-row">
                        <div className="import-item-main">
                          <input type="checkbox" checked={pi.checked} onChange={() => toggleItemChecked(idx)} />
                          <div className="import-item-info" onClick={() => setExpandedItems((prev) => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}>
                            <span className="import-item-name" style={{ fontWeight: 600 }}>{p.name}</span>
                            <span className="export-item-meta">
                              {p.environments.length} envs · {p.microservices.length} svcs · {p.globalAuthProfiles.length} auth · {p.featureGroups.length} features
                            </span>
                            {pi.status === 'new' && <span className="import-badge import-badge-new">NEW</span>}
                            {pi.status === 'conflict-id' && <span className="import-badge import-badge-conflict">ID MATCH</span>}
                            {pi.status === 'conflict-name' && <span className="import-badge import-badge-conflict">NAME MATCH</span>}
                            {pi.status !== 'new' && <span className="import-item-existing">exists as "{pi.existingProject?.name}"</span>}
                            <span className={`import-item-expand ${isExpanded ? 'expanded' : ''}`}>▸</span>
                          </div>
                          {pi.status !== 'new' && pi.checked && (
                            <select className="import-action-select" value={pi.action} onChange={(e) => updateItemAction(idx, e.target.value as ConflictAction)}>
                              <option value="skip">Skip</option>
                              <option value="overwrite">Overwrite existing</option>
                              <option value="keepBoth">Import as copy</option>
                            </select>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="import-item-details" style={{ padding: '12px 16px' }}>
                          {p.description && <div style={{ marginBottom: 8, opacity: 0.7, fontStyle: 'italic' }}>{p.description}</div>}

                          {p.environments.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85em' }}>Environments ({p.environments.length})</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {p.environments.map((e) => <span key={e.id} className="import-badge" style={{ background: 'rgba(66,153,225,0.15)', color: '#4299e5' }}>{e.name}</span>)}
                              </div>
                            </div>
                          )}

                          {p.microservices.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85em' }}>Microservices ({p.microservices.length})</div>
                              {p.microservices.map((s) => (
                                <div key={s.id} style={{ marginBottom: 4 }}>
                                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                                  <span style={{ opacity: 0.6, marginLeft: 8, fontSize: '0.85em' }}>{Object.keys(s.baseUrls).length} base URL(s)</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {p.globalAuthProfiles.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85em' }}>Auth Profiles ({p.globalAuthProfiles.length})</div>
                              {p.globalAuthProfiles.map((ap) => (
                                <div key={ap.id} style={{ marginBottom: 2 }}>
                                  <span>{ap.name}</span>
                                  <span className="import-badge" style={{ marginLeft: 8, background: 'rgba(159,122,234,0.15)', color: '#9f7aea' }}>{ap.auth.type.toUpperCase()}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {p.featureGroups.length > 0 && (
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85em' }}>Feature Groups ({p.featureGroups.length})</div>
                              {p.featureGroups.map((fg) => {
                                const scenarioCount = fg.scenarios.length;
                                const testCount = fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0);
                                return (
                                  <div key={fg.id} style={{ marginBottom: 2, fontSize: '0.9em' }}>
                                    <span style={{ fontWeight: 500 }}>{fg.name}</span>
                                    <span style={{ opacity: 0.6, marginLeft: 8 }}>{scenarioCount} scenarios · {testCount} tests</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {pi.existingProject && (
                            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
                              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85em', opacity: 0.7 }}>Existing project will be {pi.action === 'overwrite' ? 'replaced' : pi.action === 'skip' ? 'kept' : 'kept alongside copy'}</div>
                              <div style={{ fontSize: '0.85em', opacity: 0.6 }}>
                                {pi.existingProject.environments.length} envs · {pi.existingProject.microservices.length} svcs · {pi.existingProject.featureGroups.length} features
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {summary && summary.count > 0 && (
                <div className="import-summary-bar">
                  <span className="import-stat import-stat-new">
                    {summary.count} project{summary.count > 1 ? 's' : ''}: {summary.totalEnvs} envs, {summary.totalSvcs} svcs, {summary.totalAuth} auth, {summary.totalFGs} features
                  </span>
                </div>
              )}

              {parsed.importGlobalAuthProfiles.length > 0 && (
                <div className="import-section-card" style={{ marginTop: 8 }}>
                  <div className="import-item-row">
                    <div className="import-item-main">
                      <input type="checkbox" checked={includeGlobalAuth} onChange={(e) => setIncludeGlobalAuth(e.target.checked)} />
                      <span style={{ fontWeight: 500 }}>Include {parsed.importGlobalAuthProfiles.length} global auth profile{parsed.importGlobalAuthProfiles.length !== 1 ? 's' : ''}</span>
                      <span className="import-badge" style={{ background: 'rgba(159,122,234,0.15)', color: '#9f7aea', marginLeft: 8 }}>GLOBAL</span>
                    </div>
                  </div>
                  {includeGlobalAuth && (
                    <div style={{ padding: '4px 16px 8px 40px', opacity: 0.8, fontSize: '0.85em' }}>
                      {parsed.importGlobalAuthProfiles.map((p) => (
                        <div key={p.id} style={{ marginBottom: 2 }}>
                          {p.name} — {p.auth.type}
                          {appGlobalAuthProfiles.some((g) => g.id === p.id) && <span style={{ opacity: 0.5, marginLeft: 8 }}>(already exists, will skip)</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {parsed.testRuns.length > 0 && (
                <div className="import-section-card" style={{ marginTop: 8 }}>
                  <div className="import-item-row">
                    <div className="import-item-main">
                      <input type="checkbox" checked={includeRuns} onChange={(e) => setIncludeRuns(e.target.checked)} />
                      <span style={{ fontWeight: 500 }}>Include {parsed.testRuns.length} test run{parsed.testRuns.length !== 1 ? 's' : ''}</span>
                      <span className="export-item-meta" style={{ opacity: 0.6 }}>
                        ({parsed.testRuns.reduce((s, r) => s + r.summary.totalRequests, 0).toLocaleString()} total requests)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="import-center-footer">
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!parsed || activeCount === 0}
          >
            Import{activeCount > 0 ? ` ${activeCount} project${activeCount > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
