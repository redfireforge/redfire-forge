import { useState } from 'react';
import type { Scenario, FeatureGroup } from '../types';
import { useModalDrag } from '../hooks/useModalDrag';
import { useModalExpand } from '../hooks/useModalExpand';
import { useModalResize } from '../hooks/useModalResize';
import ModalExpandButton from './shared/ModalExpandButton';
import ModalResizeHandles from './shared/ModalResizeHandles';

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
  const { onDragStart, overlayStyle, modalStyle } = useModalDrag(true);
  const { expanded, toggleExpand, expandClass } = useModalExpand();
  const { resizeStyle, onRightEdge, onCorner } = useModalResize();

  return (
    <div className="modal-overlay" onClick={onClose} style={overlayStyle}>
      <div className={`modal copy-modal ${expandClass}`} role="dialog" onClick={(e) => e.stopPropagation()} style={{ ...modalStyle, ...resizeStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'move' }} onMouseDown={onDragStart}>
          <h3 style={{ flex: 1 }}>Copy Test To...</h3>
          <ModalExpandButton expanded={expanded} onToggle={toggleExpand} />
        </div>
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
          <ModalExpandButton expanded={expanded} onToggle={toggleExpand} position="footer" />
        </div>
        <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} />
      </div>
    </div>
  );
}
