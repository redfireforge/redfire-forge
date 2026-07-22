import { useState, useMemo } from 'react';
import type { FeatureGroup, ScenarioKind } from '../../../shared/types';
import PopupModal from '../../../shared/components/PopupModal';
import { CustomSelect } from '../../../shared/components/CustomSelect';

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
  /** When moving a test, only show scenarios matching this kind */
  sourceScenarioKind?: ScenarioKind;
  onMove: (target: MoveTarget) => void;
  onClose: () => void;
}

export default function MoveModal({
  type, itemName, featureGroups, currentFgId, currentScenarioId,
  sourceScenarioKind, onMove, onClose,
}: Props) {
  const [targetFgId, setTargetFgId] = useState('');
  const [targetScenarioId, setTargetScenarioId] = useState('');

  const targetFG = useMemo(
    () => featureGroups.find((fg) => fg.id === targetFgId),
    [featureGroups, targetFgId],
  );

  const availableScenarios = useMemo(() => {
    if (type !== 'test' || !targetFG) return [];
    if (sourceScenarioKind) {
      return targetFG.scenarios.filter((sc) => sc.kind === sourceScenarioKind);
    }
    return targetFG.scenarios;
  }, [type, targetFG, sourceScenarioKind]);

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
    <PopupModal
      title={`Move ${typeLabel}`}
      onClose={onClose}
      footer={(
        <>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleMove} disabled={!canMove}>Move</button>
        </>
      )}
    >
          <div className="popup-modal-banner">
            Moving: <strong>{itemName}</strong>
          </div>

          <div className="popup-modal-field">
            <label>Target Feature Group</label>
            {featureGroups.length === 0 ? (
              <div className="popup-modal-empty">No feature groups available</div>
            ) : (
              <CustomSelect
                value={targetFgId}
                onChange={(v) => {
                  setTargetFgId(v);
                  setTargetScenarioId('');
                }}
                placeholder="— Select Feature Group —"
                options={featureGroups.map((fg) => {
                  const isCurrent = fg.id === currentFgId;
                  return {
                    value: fg.id,
                    label: `${fg.name} (${fg.scenarios.length} scenarios)${isCurrent ? ' (current)' : ''}`,
                  };
                })}
              />
            )}
          </div>

          {type === 'test' && targetFgId && (
            <div className="popup-modal-field">
              <label>Target Scenario</label>
              {availableScenarios.length === 0 ? (
                <div className="popup-modal-empty">
                {sourceScenarioKind && targetFG && targetFG.scenarios.length > 0
                  ? `No ${sourceScenarioKind === 'parameterized' ? 'parameterized' : 'standard'} scenarios in this feature group`
                  : 'No scenarios in this feature group'}
              </div>
              ) : (
                <CustomSelect
                  value={targetScenarioId}
                  onChange={(v) => setTargetScenarioId(v)}
                  placeholder="— Select Scenario —"
                  options={availableScenarios.map((sc) => {
                    const isCurrent = sc.id === currentScenarioId && targetFgId === currentFgId;
                    return {
                      value: sc.id,
                      label: `${sc.name} (${sc.tests.length} tests)${isCurrent ? ' (current)' : ''}`,
                    };
                  })}
                />
              )}
            </div>
          )}

          {isSameLocation && targetFgId && (
            <div className="popup-modal-warning">
              This is the current location. Select a different destination.
            </div>
          )}
    </PopupModal>
  );
}
