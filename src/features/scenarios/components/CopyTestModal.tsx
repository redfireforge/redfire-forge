import { useState, useMemo } from 'react';
import type { Scenario, FeatureGroup, ScenarioKind } from '@shared/types';
import PopupModal from '@shared/components/PopupModal';
import { CustomSelect } from '@shared/components/CustomSelect';

interface Props {
  test: Scenario;
  sourceFeatureId: string;
  sourceScenarioId: string;
  featureGroups: FeatureGroup[];
  /** Only show scenarios matching this kind */
  sourceScenarioKind?: ScenarioKind;
  onConfirm: (featureId: string, scenarioId: string) => void;
  onClose: () => void;
}

export default function CopyTestModal({ test, sourceFeatureId, sourceScenarioId, featureGroups, sourceScenarioKind, onConfirm, onClose }: Props) {
  const [targetFeature, setTargetFeature] = useState(sourceFeatureId);
  const [targetScenario, setTargetScenario] = useState(sourceScenarioId);

  const filteredScenarios = useMemo(() => {
    const fg = featureGroups.find((f) => f.id === targetFeature);
    if (!fg) return [];
    if (sourceScenarioKind) {
      return fg.scenarios.filter((sc) => sc.kind === sourceScenarioKind);
    }
    return fg.scenarios;
  }, [featureGroups, targetFeature, sourceScenarioKind]);

  return (
    <PopupModal
      title="Copy Test To..."
      onClose={onClose}
      footer={(
        <>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onConfirm(targetFeature, targetScenario)} disabled={!targetScenario}>Copy Here</button>
        </>
      )}
    >
        <p className="popup-modal-banner">Copying: <strong>{test.name}</strong></p>

        <div className="popup-modal-field">
          <label>Feature Group</label>
          <CustomSelect
            value={targetFeature}
            onChange={(v) => {
              setTargetFeature(v);
              const fg = featureGroups.find((f) => f.id === v);
              const candidates = sourceScenarioKind
                ? fg?.scenarios.filter((sc) => sc.kind === sourceScenarioKind)
                : fg?.scenarios;
              setTargetScenario(candidates?.[0]?.id || '');
            }}
            options={featureGroups.map((fg) => ({ value: fg.id, label: fg.name }))}
          />
        </div>

        <div className="popup-modal-field">
          <label>Scenario</label>
          {filteredScenarios.length === 0 ? (
            <div className="popup-modal-empty">
              {sourceScenarioKind
                ? `No ${sourceScenarioKind === 'parameterized' ? 'parameterized' : 'standard'} scenarios in this feature group`
                : 'No scenarios in this feature group'}
            </div>
          ) : (
            <CustomSelect
              value={targetScenario}
              onChange={(v) => setTargetScenario(v)}
              options={filteredScenarios.map((sc) => ({
                value: sc.id,
                label: `${sc.name}${sc.id === sourceScenarioId && targetFeature === sourceFeatureId ? ' (current)' : ''}`,
              }))}
            />
          )}
        </div>

    </PopupModal>
  );
}
