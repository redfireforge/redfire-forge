import { useState, useMemo } from 'react';
import type { Project } from '../types';

export type MoveType = 'featureGroup' | 'scenario' | 'test';

export interface MoveTarget {
  projectId: string;
  fgId?: string;
  scenarioId?: string;
}

interface Props {
  type: MoveType;
  itemName: string;
  projects: Project[];
  currentProjectId: string;
  currentFgId?: string;
  currentScenarioId?: string;
  fgEnvironmentId?: string;
  fgMicroserviceId?: string;
  fgAuthProfileId?: string;
  appGlobalAuthProfileIds?: Set<string>;
  onMove: (target: MoveTarget) => void;
  onClose: () => void;
}

export default function MoveDialog({
  type, itemName, projects, currentProjectId, currentFgId, currentScenarioId,
  fgEnvironmentId, fgMicroserviceId, fgAuthProfileId, appGlobalAuthProfileIds,
  onMove, onClose,
}: Props) {
  const [targetProjectId, setTargetProjectId] = useState(currentProjectId);
  const [targetFgId, setTargetFgId] = useState('');
  const [targetScenarioId, setTargetScenarioId] = useState('');

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId),
    [projects, currentProjectId],
  );

  const targetProject = useMemo(
    () => projects.find((p) => p.id === targetProjectId),
    [projects, targetProjectId],
  );

  const availableFGs = useMemo(() => {
    if (!targetProject) return [];
    if (type === 'featureGroup') return [];
    return targetProject.featureGroups;
  }, [targetProject, type]);

  const targetFG = useMemo(
    () => availableFGs.find((fg) => fg.id === targetFgId),
    [availableFGs, targetFgId],
  );

  const availableScenarios = useMemo(() => {
    if (type !== 'test' || !targetFG) return [];
    return targetFG.scenarios;
  }, [type, targetFG]);

  const isSameLocation = (() => {
    if (type === 'featureGroup') {
      return targetProjectId === currentProjectId;
    }
    if (type === 'scenario') {
      return targetProjectId === currentProjectId && targetFgId === currentFgId;
    }
    return targetProjectId === currentProjectId && targetFgId === currentFgId && targetScenarioId === currentScenarioId;
  })();

  const canMove = (() => {
    if (type === 'featureGroup') return !!targetProjectId && !isSameLocation;
    if (type === 'scenario') return !!targetProjectId && !!targetFgId && !isSameLocation;
    return !!targetProjectId && !!targetFgId && !!targetScenarioId && !isSameLocation;
  })();

  // For FG moves: figure out what entities will be auto-copied to the target project
  const willCopy = useMemo(() => {
    if (type !== 'featureGroup' || !targetProject || !currentProject || targetProjectId === currentProjectId) return [];
    const items: string[] = [];

    if (fgEnvironmentId && !targetProject.environments.some((e) => e.id === fgEnvironmentId)) {
      const env = currentProject.environments.find((e) => e.id === fgEnvironmentId);
      if (env) items.push(`Environment: ${env.name}`);
    }
    if (fgMicroserviceId && !targetProject.microservices.some((s) => s.id === fgMicroserviceId)) {
      const svc = currentProject.microservices.find((s) => s.id === fgMicroserviceId);
      if (svc) {
        const urlCount = Object.keys(svc.baseUrls).length;
        items.push(`Microservice: ${svc.name}${urlCount > 0 ? ` (with ${urlCount} base URL${urlCount > 1 ? 's' : ''})` : ''}`);
        // Check if the svc references environments that also need copying
        for (const envId of Object.keys(svc.baseUrls)) {
          if (envId !== fgEnvironmentId && !targetProject.environments.some((e) => e.id === envId)) {
            const env = currentProject.environments.find((e) => e.id === envId);
            if (env) items.push(`Environment: ${env.name} (referenced by microservice)`);
          }
        }
      }
    }
    const isAppGlobal = fgAuthProfileId && appGlobalAuthProfileIds?.has(fgAuthProfileId);
    if (fgAuthProfileId && !isAppGlobal && !targetProject.globalAuthProfiles.some((a) => a.id === fgAuthProfileId)) {
      const auth = currentProject.globalAuthProfiles.find((a) => a.id === fgAuthProfileId);
      if (auth) items.push(`Auth Profile: ${auth.name}`);
    }
    return items;
  }, [type, targetProject, currentProject, targetProjectId, currentProjectId, fgEnvironmentId, fgMicroserviceId, fgAuthProfileId, appGlobalAuthProfileIds]);

  const handleMove = () => {
    if (!canMove) return;
    onMove({
      projectId: targetProjectId,
      fgId: targetFgId || undefined,
      scenarioId: targetScenarioId || undefined,
    });
  };

  const typeLabel = type === 'featureGroup' ? 'Feature Group' : type === 'scenario' ? 'Scenario' : 'Test';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal move-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="move-dialog-header">
          <h3>Move {typeLabel}</h3>
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
        </div>

        <div className="move-dialog-body">
          <div className="move-dialog-item">
            Moving: <strong>{itemName}</strong>
          </div>

          <div className="move-dialog-step">
            <label>Target Project</label>
            <select
              value={targetProjectId}
              onChange={(e) => {
                setTargetProjectId(e.target.value);
                setTargetFgId('');
                setTargetScenarioId('');
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.id === currentProjectId ? ' (current)' : ''}
                </option>
              ))}
            </select>
            {targetProject && (
              <span className="move-dialog-hint">
                {targetProject.featureGroups.length} feature group{targetProject.featureGroups.length !== 1 ? 's' : ''} · {targetProject.environments.length} envs · {targetProject.microservices.length} svcs
              </span>
            )}
          </div>

          {(type === 'scenario' || type === 'test') && (
            <div className="move-dialog-step">
              <label>Target Feature Group</label>
              {availableFGs.length === 0 ? (
                <div className="move-dialog-empty">No feature groups in this project</div>
              ) : (
                <select
                  value={targetFgId}
                  onChange={(e) => {
                    setTargetFgId(e.target.value);
                    setTargetScenarioId('');
                  }}
                >
                  <option value="">— Select Feature Group —</option>
                  {availableFGs.map((fg) => {
                    const isCurrent = fg.id === currentFgId && targetProjectId === currentProjectId;
                    return (
                      <option key={fg.id} value={fg.id}>
                        {fg.name} ({fg.scenarios.length} scenarios){isCurrent ? ' (current)' : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          {type === 'test' && targetFgId && (
            <div className="move-dialog-step">
              <label>Target Scenario</label>
              {availableScenarios.length === 0 ? (
                <div className="move-dialog-empty">No scenarios in this feature group</div>
              ) : (
                <select
                  value={targetScenarioId}
                  onChange={(e) => setTargetScenarioId(e.target.value)}
                >
                  <option value="">— Select Scenario —</option>
                  {availableScenarios.map((sc) => {
                    const isCurrent = sc.id === currentScenarioId && targetFgId === currentFgId && targetProjectId === currentProjectId;
                    return (
                      <option key={sc.id} value={sc.id}>
                        {sc.name} ({sc.tests.length} tests){isCurrent ? ' (current)' : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          {willCopy.length > 0 && (
            <div className="move-dialog-info">
              <strong>Will also copy to target project:</strong>
              {willCopy.map((item, i) => (
                <div key={i} className="move-dialog-info-item">{item}</div>
              ))}
            </div>
          )}

          {isSameLocation && targetProjectId && (
            <div className="move-dialog-warning">
              This is the current location. Select a different destination.
            </div>
          )}
        </div>

        <div className="move-dialog-footer">
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleMove} disabled={!canMove}>
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
