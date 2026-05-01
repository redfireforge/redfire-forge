import { useState } from 'react';
import type { Scenario, FeatureGroup } from '../../../shared/types';
import PopupModal from '../../../shared/components/PopupModal';

interface Props {
  test: Scenario;
  sourceFeatureId: string;
  sourceScenarioId: string;
  featureGroups: FeatureGroup[];
  onConfirm: (featureId: string, scenarioId: string) => void;
  onClose: () => void;
}

export default function CopyTestModal({ test, sourceFeatureId, sourceScenarioId, featureGroups, onConfirm, onClose }: Props) {
  const [targetFeature, setTargetFeature] = useState(sourceFeatureId);
  const [targetScenario, setTargetScenario] = useState(sourceScenarioId);

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
          <select value={targetFeature} onChange={(e) => {
            setTargetFeature(e.target.value);
            const fg = featureGroups.find((f) => f.id === e.target.value);
            setTargetScenario(fg?.scenarios[0]?.id || '');
          }}>
            {featureGroups.map((fg) => (
              <option key={fg.id} value={fg.id}>{fg.name}</option>
            ))}
          </select>
        </div>

        <div className="popup-modal-field">
          <label>Scenario</label>
          <select value={targetScenario} onChange={(e) => setTargetScenario(e.target.value)}>
            {featureGroups.find((f) => f.id === targetFeature)?.scenarios.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
                {sc.id === sourceScenarioId && targetFeature === sourceFeatureId ? ' (current)' : ''}
              </option>
            )) || <option value="">No scenarios</option>}
          </select>
        </div>

    </PopupModal>
  );
}
