import { useState } from 'react';
import type { Scenario, FeatureGroup } from '../types';

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal copy-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Copy Test To...</h3>
        <p className="copy-test-name">Copying: <strong>{test.name}</strong></p>

        <div className="form-row">
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

        <div className="form-row">
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

        <div className="copy-modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onConfirm(targetFeature, targetScenario)} disabled={!targetScenario}>Copy Here</button>
        </div>
      </div>
    </div>
  );
}
