import { useState, useMemo } from 'react';
import type { Environment, Microservice, FeatureGroup, TestRun } from '../types';
import { saveJsonFile } from '../utils/fileSaver';

interface Props {
  environments: Environment[];
  microservices: Microservice[];
  featureGroups: FeatureGroup[];
  testRuns: TestRun[];
  onClose: () => void;
}

type Section = 'environments' | 'microservices' | 'features' | 'runs';

export default function ExportCenter({ environments, microservices, featureGroups, testRuns, onClose }: Props) {
  const [selectedEnvs, setSelectedEnvs] = useState<Set<string>>(new Set());
  const [selectedSvcs, setSelectedSvcs] = useState<Set<string>>(new Set());
  const [selectedFGs, setSelectedFGs] = useState<Set<string>>(new Set());
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<Section>>(new Set(['environments', 'microservices', 'features']));

  const toggleSection = (s: Section) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const selectAll = (ids: string[], setter: (s: Set<string>) => void) => setter(new Set(ids));
  const clearAll = (setter: (s: Set<string>) => void) => setter(new Set());

  const envMap = useMemo(() => new Map(environments.map((e) => [e.id, e.name])), [environments]);
  const svcMap = useMemo(() => new Map(microservices.map((s) => [s.id, s.name])), [microservices]);

  const totalSelected = selectedEnvs.size + selectedSvcs.size + selectedFGs.size + selectedRuns.size;

  const summaryLines = useMemo(() => {
    const lines: string[] = [];
    if (selectedEnvs.size > 0) {
      const names = environments.filter((e) => selectedEnvs.has(e.id)).map((e) => e.name);
      lines.push(`${selectedEnvs.size} environment${selectedEnvs.size > 1 ? 's' : ''}: ${names.join(', ')}`);
    }
    if (selectedSvcs.size > 0) {
      const svcs = microservices.filter((s) => selectedSvcs.has(s.id));
      const totalUrls = svcs.reduce((sum, s) => sum + Object.keys(s.baseUrls).length, 0);
      const names = svcs.map((s) => s.name);
      lines.push(`${selectedSvcs.size} microservice${selectedSvcs.size > 1 ? 's' : ''}: ${names.join(', ')} (${totalUrls} base URLs)`);
    }
    if (selectedFGs.size > 0) {
      const fgs = featureGroups.filter((fg) => selectedFGs.has(fg.id));
      const totalScenarios = fgs.reduce((sum, fg) => sum + fg.scenarios.length, 0);
      const totalTests = fgs.reduce((sum, fg) => sum + fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0), 0);
      lines.push(`${selectedFGs.size} feature group${selectedFGs.size > 1 ? 's' : ''} (${totalScenarios} scenarios, ${totalTests} tests)`);
    }
    if (selectedRuns.size > 0) {
      const runs = testRuns.filter((r) => selectedRuns.has(r.id));
      const totalReqs = runs.reduce((sum, r) => sum + r.summary.totalRequests, 0);
      lines.push(`${selectedRuns.size} test run${selectedRuns.size > 1 ? 's' : ''} (${totalReqs.toLocaleString()} total requests)`);
    }
    return lines;
  }, [selectedEnvs, selectedSvcs, selectedFGs, selectedRuns, environments, microservices, featureGroups, testRuns]);

  const handleExport = async () => {
    const data: Record<string, unknown> = {};

    if (selectedEnvs.size > 0) {
      data.environments = environments.filter((e) => selectedEnvs.has(e.id));
    }
    if (selectedSvcs.size > 0) {
      const svcs = microservices.filter((s) => selectedSvcs.has(s.id));
      data.microservices = svcs;
      const referencedEnvIds = new Set<string>();
      for (const svc of svcs) {
        for (const envId of Object.keys(svc.baseUrls)) referencedEnvIds.add(envId);
      }
      const extraEnvs = environments.filter((e) => referencedEnvIds.has(e.id) && !selectedEnvs.has(e.id));
      if (extraEnvs.length > 0) {
        data.environments = [
          ...((data.environments as Environment[]) ?? []),
          ...extraEnvs,
        ];
      }
    }
    if (selectedFGs.size > 0) {
      data.featureGroups = featureGroups.filter((fg) => selectedFGs.has(fg.id));
    }
    if (selectedRuns.size > 0) {
      data.testRuns = testRuns.filter((r) => selectedRuns.has(r.id));
    }

    data.exportedAt = new Date().toISOString();
    data.version = '1.0';

    const parts: string[] = [];
    if (selectedEnvs.size > 0) parts.push('envs');
    if (selectedSvcs.size > 0) parts.push('svcs');
    if (selectedFGs.size > 0) parts.push('features');
    if (selectedRuns.size > 0) parts.push('runs');
    const filename = `perf-test-export-${parts.join('-')}-${new Date().toISOString().slice(0, 10)}.json`;

    await saveJsonFile(data, filename);
  };

  const quickSelectAll = () => {
    selectAll(environments.map((e) => e.id), setSelectedEnvs);
    selectAll(microservices.map((s) => s.id), setSelectedSvcs);
    selectAll(featureGroups.map((f) => f.id), setSelectedFGs);
    selectAll(testRuns.map((r) => r.id), setSelectedRuns);
  };

  const quickClearAll = () => {
    clearAll(setSelectedEnvs);
    clearAll(setSelectedSvcs);
    clearAll(setSelectedFGs);
    clearAll(setSelectedRuns);
  };

  return (
    <div className="modal-overlay settings-overlay" onClick={onClose}>
      <div className="modal settings-modal export-center-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Export Data</h3>
          <div className="export-header-actions">
            <button className="btn btn-sm" onClick={quickSelectAll}>Select All</button>
            <button className="btn btn-sm" onClick={quickClearAll}>Clear All</button>
            <button className="btn btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="export-center-body">
          {/* Environments */}
          <div className="export-section">
            <div className="export-section-header" onClick={() => toggleSection('environments')}>
              <span className={`expand-icon ${expandedSections.has('environments') ? 'expanded' : ''}`}>▸</span>
              <strong>Environments</strong>
              <span className="export-count">{selectedEnvs.size}/{environments.length}</span>
              <div className="export-section-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-xs" onClick={() => selectAll(environments.map((e) => e.id), setSelectedEnvs)}>All</button>
                <button className="btn btn-xs" onClick={() => clearAll(setSelectedEnvs)}>None</button>
              </div>
            </div>
            {expandedSections.has('environments') && (
              <div className="export-items">
                {environments.length === 0 && <span className="empty-hint">No environments configured</span>}
                {environments.map((env) => (
                  <label key={env.id} className="export-item">
                    <input type="checkbox" checked={selectedEnvs.has(env.id)} onChange={() => toggle(selectedEnvs, env.id, setSelectedEnvs)} />
                    <span>{env.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Microservices */}
          <div className="export-section">
            <div className="export-section-header" onClick={() => toggleSection('microservices')}>
              <span className={`expand-icon ${expandedSections.has('microservices') ? 'expanded' : ''}`}>▸</span>
              <strong>Microservices</strong>
              <span className="export-count">{selectedSvcs.size}/{microservices.length}</span>
              <div className="export-section-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-xs" onClick={() => selectAll(microservices.map((s) => s.id), setSelectedSvcs)}>All</button>
                <button className="btn btn-xs" onClick={() => clearAll(setSelectedSvcs)}>None</button>
              </div>
            </div>
            {expandedSections.has('microservices') && (
              <div className="export-items">
                {microservices.length === 0 && <span className="empty-hint">No microservices configured</span>}
                {microservices.map((svc) => {
                  const envCount = Object.keys(svc.baseUrls).length;
                  const fgCount = featureGroups.filter((fg) => fg.microserviceId === svc.id).length;
                  return (
                    <label key={svc.id} className="export-item">
                      <input type="checkbox" checked={selectedSvcs.has(svc.id)} onChange={() => toggle(selectedSvcs, svc.id, setSelectedSvcs)} />
                      <span>{svc.name}</span>
                      <span className="export-item-meta">{envCount} envs · {fgCount} feature groups</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Feature Groups */}
          <div className="export-section">
            <div className="export-section-header" onClick={() => toggleSection('features')}>
              <span className={`expand-icon ${expandedSections.has('features') ? 'expanded' : ''}`}>▸</span>
              <strong>Feature Groups</strong>
              <span className="export-count">{selectedFGs.size}/{featureGroups.length}</span>
              <div className="export-section-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-xs" onClick={() => selectAll(featureGroups.map((f) => f.id), setSelectedFGs)}>All</button>
                <button className="btn btn-xs" onClick={() => clearAll(setSelectedFGs)}>None</button>
              </div>
            </div>
            {expandedSections.has('features') && (
              <div className="export-items">
                {featureGroups.length === 0 && <span className="empty-hint">No feature groups created</span>}
                {featureGroups.map((fg) => {
                  const svcName = fg.microserviceId ? svcMap.get(fg.microserviceId) : undefined;
                  const envName = fg.environmentId ? envMap.get(fg.environmentId) : undefined;
                  const scenarioCount = fg.scenarios.length;
                  const testCount = fg.scenarios.reduce((sum, sc) => sum + sc.tests.length, 0);
                  return (
                    <label key={fg.id} className="export-item">
                      <input type="checkbox" checked={selectedFGs.has(fg.id)} onChange={() => toggle(selectedFGs, fg.id, setSelectedFGs)} />
                      <span>{fg.name}</span>
                      <span className="export-item-meta">
                        {svcName && <span className="export-tag svc">{svcName}</span>}
                        {envName && <span className="export-tag env">{envName}</span>}
                        {scenarioCount} scenarios · {testCount} tests
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Test Runs */}
          <div className="export-section">
            <div className="export-section-header" onClick={() => toggleSection('runs')}>
              <span className={`expand-icon ${expandedSections.has('runs') ? 'expanded' : ''}`}>▸</span>
              <strong>Test Runs</strong>
              <span className="export-count">{selectedRuns.size}/{testRuns.length}</span>
              <div className="export-section-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-xs" onClick={() => selectAll(testRuns.map((r) => r.id), setSelectedRuns)}>All</button>
                <button className="btn btn-xs" onClick={() => clearAll(setSelectedRuns)}>None</button>
              </div>
            </div>
            {expandedSections.has('runs') && (
              <div className="export-items">
                {testRuns.length === 0 && <span className="empty-hint">No test runs recorded</span>}
                {testRuns.map((run) => {
                  const date = new Date(run.timestamp).toLocaleString();
                  return (
                    <label key={run.id} className="export-item">
                      <input type="checkbox" checked={selectedRuns.has(run.id)} onChange={() => toggle(selectedRuns, run.id, setSelectedRuns)} />
                      <span>{date}</span>
                      <span className="export-item-meta">
                        {run.svcName && <span className="export-tag svc">{run.svcName}</span>}
                        {run.envName && <span className="export-tag env">{run.envName}</span>}
                        {run.summary.totalRequests} reqs · {run.summary.tps.toFixed(1)} TPS
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="export-center-footer">
          <div className="export-summary">
            {totalSelected === 0 ? (
              <span className="export-summary-empty">Select items above to export</span>
            ) : (
              <div className="export-summary-lines">
                <strong>Export will include:</strong>
                {summaryLines.map((line, i) => (
                  <div key={i} className="export-summary-line">{line}</div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={handleExport} disabled={totalSelected === 0}>
            Export JSON
          </button>
        </div>
      </div>
    </div>
  );
}
