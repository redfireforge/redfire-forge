import { useState, useMemo } from 'react';
import type { FeatureGroup } from '../types';

export type MoveType = 'scenario' | 'test';

export interface MoveTarget {
  fgId?: string;
  scenarioId?: string;
}

interface Props {
  type: MoveType;
  itemName: string;
  featureGroups: FeatureGroup[];
  currentFgId?: string;
  currentScenarioId?: string;
  onMove: (target: MoveTarget) => void;
  onClose: () => void;
}

export default function MoveDialog({
  type, itemName, featureGroups, currentFgId, currentScenarioId,
  onMove, onClose,
}: Props) {
  const [targetFgId, setTargetFgId] = useState('');
  const [targetScenarioId, setTargetScenarioId] = useState('');

  const targetFG = useMemo(
    () => featureGroups.find((fg) => fg.id === targetFgId),
    [featureGroups, targetFgId],
  );

  const availableScenarios = useMemo(() => {
    if (type !== 'test' || !targetFG) return [];
    return targetFG.scenarios;
  }, [type, targetFG]);

  const isSameLocation = (() => {
    if (type === 'scenario') {
      return targetFgId === currentFgId;
    }
    return targetFgId === currentFgId && targetScenarioId === currentScenarioId;
  })();

  const canMove = (() => {
    if (type === 'scenario') return !!targetFgId && !isSameLocation;
    return !!targetFgId && !!targetScenarioId && !isSameLocation;
  })();

  const handleMove = () => {
    if (!canMove) return;
    onMove({
      fgId: targetFgId || undefined,
      scenarioId: targetScenarioId || undefined,
    });
  };

  const typeLabel = type === 'scenario' ? 'Scenario' : 'Test';

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
            <label>Target Feature Group</label>
            {featureGroups.length === 0 ? (
              <div className="move-dialog-empty">No feature groups available</div>
            ) : (
              <select
                value={targetFgId}
                onChange={(e) => {
                  setTargetFgId(e.target.value);
                  setTargetScenarioId('');
                }}
              >
                <option value="">— Select Feature Group —</option>
                {featureGroups.map((fg) => {
                  const isCurrent = fg.id === currentFgId;
                  return (
                    <option key={fg.id} value={fg.id}>
                      {fg.name} ({fg.scenarios.length} scenarios){isCurrent ? ' (current)' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

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
                    const isCurrent = sc.id === currentScenarioId && targetFgId === currentFgId;
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

          {isSameLocation && targetFgId && (
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
