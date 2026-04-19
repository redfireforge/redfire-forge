import { useState, useMemo } from 'react';
import type { TestRun, Environment, Microservice, FeatureGroup, GlobalAuthProfile } from '../types';
import { saveJsonFile, buildExportFilename } from '../utils/fileSaver';

interface Props {
  environments: Environment[];
  microservices: Microservice[];
  featureGroups: FeatureGroup[];
  appGlobalAuthProfiles: GlobalAuthProfile[];
  testRuns: TestRun[];
  onClose: () => void;
}

export default function ExportCenter({ environments, microservices, featureGroups, appGlobalAuthProfiles, testRuns, onClose }: Props) {
  const [includeGlobalAuth, setIncludeGlobalAuth] = useState(appGlobalAuthProfiles.length > 0);
  const [includeRuns, setIncludeRuns] = useState(false);
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set());
  const [runsExpanded, setRunsExpanded] = useState(false);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const summary = useMemo(() => {
    const totalScenarios = featureGroups.reduce((s, fg) => s + fg.scenarios.length, 0);
    const totalTests = featureGroups.reduce((s, fg) =>
      s + fg.scenarios.reduce((ts, sc) => ts + sc.tests.length, 0), 0);
    return { totalScenarios, totalTests };
  }, [featureGroups]);

  const handleExport = async () => {
    const data: Record<string, unknown> = {
      environments,
      microservices,
      featureGroups,
      exportedAt: new Date().toISOString(),
      version: '3.0',
    };

    if (includeGlobalAuth && appGlobalAuthProfiles.length > 0) {
      data.appGlobalAuthProfiles = appGlobalAuthProfiles;
    }

    if (includeRuns && selectedRuns.size > 0) {
      data.testRuns = testRuns.filter((r) => selectedRuns.has(r.id));
    }

    const filename = buildExportFilename({ level: 'data', name: 'redfire-export' });
    await saveJsonFile(data, filename);
  };

  return (
    <div className="modal-overlay settings-overlay" onClick={onClose}>
      <div className="modal settings-modal export-center-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Export Data</h3>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="export-center-body">
          <div className="export-section">
            <div className="export-section-header">
              <strong>Export Summary</strong>
            </div>
            <div className="export-items" style={{ padding: '8px 16px', opacity: 0.8, fontSize: '0.9em' }}>
              <div>{environments.length} environment{environments.length !== 1 ? 's' : ''}</div>
              <div>{microservices.length} microservice{microservices.length !== 1 ? 's' : ''}</div>
              <div>{appGlobalAuthProfiles.length} auth profile{appGlobalAuthProfiles.length !== 1 ? 's' : ''}</div>
              <div>{featureGroups.length} feature group{featureGroups.length !== 1 ? 's' : ''} ({summary.totalScenarios} scenarios, {summary.totalTests} tests)</div>
            </div>
          </div>

          {appGlobalAuthProfiles.length > 0 && (
            <div className="export-section">
              <div className="export-section-header">
                <label className="export-item" style={{ margin: 0, padding: 0 }}>
                  <input type="checkbox" checked={includeGlobalAuth} onChange={(e) => setIncludeGlobalAuth(e.target.checked)} />
                  <strong>Include Auth Profiles</strong>
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
          <button className="btn btn-primary" onClick={handleExport}>
            Export JSON
          </button>
        </div>
      </div>
    </div>
  );
}
