import { useState, useMemo } from 'react';
import type { TestRun, Project, GlobalAuthProfile } from '../types';
import { saveJsonFile, buildExportFilename } from '../utils/fileSaver';

interface Props {
  project: Project;
  projects: Project[];
  appGlobalAuthProfiles: GlobalAuthProfile[];
  testRuns: TestRun[];
  onClose: () => void;
}

export default function ExportCenter({ project, projects, appGlobalAuthProfiles, testRuns, onClose }: Props) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set([project.id]));
  const [includeGlobalAuth, setIncludeGlobalAuth] = useState(appGlobalAuthProfiles.length > 0);
  const [includeRuns, setIncludeRuns] = useState(false);
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set());
  const [runsExpanded, setRunsExpanded] = useState(false);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const selectedProjects = useMemo(
    () => projects.filter((p) => selectedProjectIds.has(p.id)),
    [projects, selectedProjectIds],
  );

  const summary = useMemo(() => {
    const totalEnvs = selectedProjects.reduce((s, p) => s + p.environments.length, 0);
    const totalSvcs = selectedProjects.reduce((s, p) => s + p.microservices.length, 0);
    const totalAuth = selectedProjects.reduce((s, p) => s + p.globalAuthProfiles.length, 0);
    const totalFGs = selectedProjects.reduce((s, p) => s + p.featureGroups.length, 0);
    const totalScenarios = selectedProjects.reduce((s, p) =>
      s + p.featureGroups.reduce((fs, fg) => fs + fg.scenarios.length, 0), 0);
    const totalTests = selectedProjects.reduce((s, p) =>
      s + p.featureGroups.reduce((fs, fg) => fs + fg.scenarios.reduce((ts, sc) => ts + sc.tests.length, 0), 0), 0);
    return { totalEnvs, totalSvcs, totalAuth, totalFGs, totalScenarios, totalTests };
  }, [selectedProjects]);

  const handleExport = async () => {
    const data: Record<string, unknown> = {
      projects: selectedProjects,
      exportedAt: new Date().toISOString(),
      version: '2.0',
    };

    if (includeGlobalAuth && appGlobalAuthProfiles.length > 0) {
      data.appGlobalAuthProfiles = appGlobalAuthProfiles;
    }

    if (includeRuns && selectedRuns.size > 0) {
      data.testRuns = testRuns.filter((r) => selectedRuns.has(r.id));
    }

    const name = selectedProjects.length === 1
      ? selectedProjects[0].name.toLowerCase().replace(/\s+/g, '-')
      : `${selectedProjects.length}-projects`;
    const filename = buildExportFilename({ level: 'project', name });
    await saveJsonFile(data, filename);
  };

  return (
    <div className="modal-overlay settings-overlay" onClick={onClose}>
      <div className="modal settings-modal export-center-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Export Project</h3>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="export-center-body">
          <div className="export-section">
            <div className="export-section-header">
              <strong>Select Project(s) to Export</strong>
              <span className="export-count">{selectedProjectIds.size}/{projects.length}</span>
            </div>
            <div className="export-items">
              {projects.map((prj) => (
                <label key={prj.id} className="export-item">
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.has(prj.id)}
                    onChange={() => toggle(selectedProjectIds, prj.id, setSelectedProjectIds)}
                  />
                  <span>{prj.name}</span>
                  <span className="export-item-meta">
                    {prj.environments.length} envs · {prj.microservices.length} svcs · {prj.globalAuthProfiles.length} auth · {prj.featureGroups.length} features
                  </span>
                </label>
              ))}
            </div>
          </div>

          {selectedProjectIds.size > 0 && (
            <div className="export-section">
              <div className="export-section-header">
                <strong>Export Summary</strong>
              </div>
              <div className="export-items" style={{ padding: '8px 16px', opacity: 0.8, fontSize: '0.9em' }}>
                <div>{selectedProjectIds.size} project{selectedProjectIds.size > 1 ? 's' : ''}</div>
                <div>{summary.totalEnvs} environment{summary.totalEnvs !== 1 ? 's' : ''}</div>
                <div>{summary.totalSvcs} microservice{summary.totalSvcs !== 1 ? 's' : ''}</div>
                <div>{summary.totalAuth} auth profile{summary.totalAuth !== 1 ? 's' : ''}</div>
                <div>{summary.totalFGs} feature group{summary.totalFGs !== 1 ? 's' : ''} ({summary.totalScenarios} scenarios, {summary.totalTests} tests)</div>
              </div>
            </div>
          )}

          {appGlobalAuthProfiles.length > 0 && (
            <div className="export-section">
              <div className="export-section-header">
                <label className="export-item" style={{ margin: 0, padding: 0 }}>
                  <input type="checkbox" checked={includeGlobalAuth} onChange={(e) => setIncludeGlobalAuth(e.target.checked)} />
                  <strong>Include Global Auth Profiles</strong>
                </label>
                <span className="export-count">{appGlobalAuthProfiles.length} profile{appGlobalAuthProfiles.length !== 1 ? 's' : ''}</span>
              </div>
              {includeGlobalAuth && (
                <div className="export-items" style={{ padding: '4px 16px', opacity: 0.8, fontSize: '0.85em' }}>
                  {appGlobalAuthProfiles.map((p) => (
                    <div key={p.id}>{p.name} — {p.auth.type}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="export-section">
            <div className="export-section-header" onClick={() => setRunsExpanded(!runsExpanded)} style={{ cursor: 'pointer' }}>
              <label className="export-item" style={{ margin: 0, padding: 0 }} onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={includeRuns} onChange={(e) => { setIncludeRuns(e.target.checked); if (!e.target.checked) setSelectedRuns(new Set()); }} />
                <strong>Include Test Runs</strong>
              </label>
              <span className="export-count">{selectedRuns.size}/{testRuns.length}</span>
              {includeRuns && (
                <div className="export-section-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-xs" onClick={() => setSelectedRuns(new Set(testRuns.map((r) => r.id)))}>All</button>
                  <button className="btn btn-xs" onClick={() => setSelectedRuns(new Set())}>None</button>
                </div>
              )}
            </div>
            {includeRuns && runsExpanded && (
              <div className="export-items">
                {testRuns.length === 0 && <span className="empty-hint">No test runs recorded</span>}
                {testRuns.map((run) => (
                  <label key={run.id} className="export-item">
                    <input type="checkbox" checked={selectedRuns.has(run.id)} onChange={() => toggle(selectedRuns, run.id, setSelectedRuns)} />
                    <span>{new Date(run.timestamp).toLocaleString()}</span>
                    <span className="export-item-meta">
                      {run.svcName && <span className="export-tag svc">{run.svcName}</span>}
                      {run.envName && <span className="export-tag env">{run.envName}</span>}
                      {run.summary.totalRequests} reqs · {run.summary.tps.toFixed(1)} TPS
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="export-center-footer">
          <button className="btn btn-primary" onClick={handleExport} disabled={selectedProjectIds.size === 0}>
            Export JSON
          </button>
        </div>
      </div>
    </div>
  );
}
