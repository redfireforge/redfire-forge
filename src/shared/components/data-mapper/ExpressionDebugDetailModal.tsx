import { useState, useRef, useCallback } from 'react';
import type { EvalStep } from './utils/expressionStepDebugger';
import { prettyDebugValue } from './utils/expressionDebugHelpers';

interface Props {
  step: EvalStep;
  onClose: () => void;
}

export default function ExpressionDebugDetailModal({ step, onClose }: Props) {
  const [drag, setDrag] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: drag.x, origY: drag.y };
    const handleMove = (ev: MouseEvent) => {
      /* v8 ignore next */
      if (!dragRef.current) return;
      setDrag({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };
    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [drag]);

  return (
    <div
      className="dm-expr-detail-overlay"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-label="Debug step detail"
    >
      <div
        className="dm-expr-detail-modal"
        onClick={(e) => e.stopPropagation()}
        style={(drag.x || drag.y) ? { transform: `translate(${drag.x}px, ${drag.y}px)` } : undefined}
      >
        <div className="dm-expr-detail-header" onMouseDown={handleDragStart} style={{ cursor: 'grab' }}>
          <span className="dm-expr-detail-badge">{step.label}</span>
        </div>
        <div className="dm-expr-detail-body">
          <div className="dm-expr-detail-section">
            <div className="dm-expr-detail-section-label">Expression</div>
            <pre className="dm-expr-detail-code">{step.expression}</pre>
          </div>
          <div className="dm-expr-detail-section">
            <div className="dm-expr-detail-section-label">{step.error ? 'Error' : 'Result'}</div>
            <pre className={`dm-expr-detail-code ${step.error ? 'dm-expr-detail-code--error' : 'dm-expr-detail-code--result'}`}>
              {prettyDebugValue(step.displayValue)}
            </pre>
          </div>
        </div>
        <div className="dm-expr-detail-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
