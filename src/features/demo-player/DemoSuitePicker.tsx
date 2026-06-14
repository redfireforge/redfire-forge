/** Demo Player — suite picker modal */
import type { DemoSuite } from './types-v1';

interface SuitePickerProps {
  suites: DemoSuite[];
  onSelect: (suite: DemoSuite) => void;
  onClose: () => void;
}

export default function DemoSuitePicker({ suites, onSelect, onClose }: SuitePickerProps) {
  return (
    <div className="demo-picker-overlay" onClick={onClose}>
      <div className="demo-picker" onClick={e => e.stopPropagation()}>
        <div className="demo-picker-header">
          <h2>Interactive Demos</h2>
          <p>Choose a guided walkthrough to learn RedfireForge features step by step.</p>
        </div>
        <div className="demo-picker-grid">
          {suites.map(suite => (
            <button
              key={suite.id}
              className="demo-suite-card"
              onClick={() => onSelect(suite)}
            >
              <span className="demo-suite-icon">{suite.icon}</span>
              <div className="demo-suite-info">
                <h3>{suite.name}</h3>
                <p>{suite.description}</p>
              </div>
              <span className="demo-suite-meta">
                {suite.steps.length} steps · ~{suite.estimatedMinutes} min
              </span>
            </button>
          ))}
        </div>
        <div className="demo-picker-footer">
          <button className="demo-btn demo-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
