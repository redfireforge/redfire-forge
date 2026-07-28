import type { EvalStep } from './utils/expressionStepDebugger';
import { prettyDebugValue, truncateDebugValue } from './utils/expressionDebugHelpers';

export interface ExpressionEditorStepDebuggerProps {
  debugSteps: EvalStep[];
  activeStep: number;
  expandedSteps: Set<number>;
  onActiveStepChange: (step: number) => void;
  onToggleStepExpand: (index: number) => void;
  onToggleExpandAll: () => void;
  onDetailStep: (step: EvalStep) => void;
}

export default function ExpressionEditorStepDebugger({
  debugSteps,
  activeStep,
  expandedSteps,
  onActiveStepChange,
  onToggleStepExpand,
  onToggleExpandAll,
  onDetailStep,
}: ExpressionEditorStepDebuggerProps) {
  const stepHeaderKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleStepExpand(i);
    }
  };

  const stepResultKeyDown = (step: EvalStep, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDetailStep(step);
    }
  };

  return (
    <div className="dm-expr-step-debugger" role="region" aria-label="Step-through debugger">
      <div className="dm-expr-step-controls">
        <button
          className="dm-expr-step-btn"
          disabled={activeStep <= 0}
          onClick={() => onActiveStepChange(Math.max(0, activeStep - 1))}
          aria-label="Previous step"
        >
          ◀
        </button>
        <span className="dm-expr-step-counter">
          Step {activeStep + 1} / {debugSteps.length}
        </span>
        <button
          className="dm-expr-step-btn"
          disabled={activeStep >= debugSteps.length - 1}
          onClick={() => onActiveStepChange(Math.min(debugSteps.length - 1, activeStep + 1))}
          aria-label="Next step"
        >
          ▶
        </button>
        <button
          className="dm-expr-step-btn dm-expr-step-btn--toggle-all"
          onClick={onToggleExpandAll}
          aria-label={expandedSteps.size === debugSteps.length ? 'Collapse all' : 'Expand all'}
        >
          {expandedSteps.size === debugSteps.length ? '▴ Collapse All' : '▾ Expand All'}
        </button>
      </div>
      <div className="dm-expr-step-list">
        {debugSteps.map((step, i) => {
          const isOpen = expandedSteps.has(i);
          const isFinal = i === debugSteps.length - 1;
          return (
            <div
              key={i}
              className={`dm-expr-step ${i === activeStep ? 'dm-expr-step--active' : ''} ${i < activeStep ? 'dm-expr-step--done' : ''} ${step.error ? 'dm-expr-step--error' : ''}`}
            >
              <span className="dm-expr-step-badge">{i + 1}</span>
              <div className="dm-expr-step-content">
                <div
                  className="dm-expr-step-header"
                  onClick={() => onToggleStepExpand(i)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => stepHeaderKeyDown(i, e)}
                >
                  <span className={`dm-expr-step-chevron ${isOpen ? 'dm-expr-step-chevron--open' : ''}`}>▸</span>
                  <span className={`dm-expr-step-label${isFinal ? ' dm-expr-step-label--final' : ''}`}>{step.label}</span>
                  <code className="dm-expr-step-expression">{truncateDebugValue(step.expression)}</code>
                </div>
                {isOpen && (
                  <div
                    className="dm-expr-step-result"
                    onClick={() => onDetailStep(step)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => stepResultKeyDown(step, e)}
                    title="Click to view full detail"
                  >
                    <span className="dm-expr-step-arrow">→</span>
                    <code className={`dm-expr-step-value ${step.error ? 'dm-expr-step-value--error' : ''}`}>
                      {prettyDebugValue(step.displayValue)}
                    </code>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
