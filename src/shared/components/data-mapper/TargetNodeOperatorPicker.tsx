import { forwardRef } from 'react';
import { createPortal } from 'react-dom';
import type { Mapping, FieldOperator } from './types';
import { OPERATOR_REGISTRY, OPERATOR_CATEGORIES, type OperatorMeta } from './utils/operatorRegistry';

/**
 * Floating popup that lets the user choose an operator (and toggle negation)
 * for a single mapping. Extracted from `TargetTreeNode.tsx` so it can be
 * tested in isolation.
 */
interface TargetNodeOperatorPickerProps {
  pickerPos: { top: number; left: number; openUp: boolean };
  operatorSearch: string;
  setOperatorSearch: (s: string) => void;
  filteredOperators: [FieldOperator, OperatorMeta][];
  currentOp: FieldOperator;
  mapping: Mapping | undefined;
  onToggleMappingNegate?: (mappingId: string) => void;
  handleOperatorSelect: (op: FieldOperator) => void;
}

const TargetNodeOperatorPicker = forwardRef<HTMLDivElement, TargetNodeOperatorPickerProps>(
  function TargetNodeOperatorPicker(
    {
      pickerPos,
      operatorSearch,
      setOperatorSearch,
      filteredOperators,
      currentOp,
      mapping,
      onToggleMappingNegate,
      handleOperatorSelect,
    },
    ref,
  ) {
    return createPortal(
      <div
        ref={ref}
        className={`dm-operator-picker ${pickerPos.openUp ? 'dm-operator-picker--up' : ''}`}
        style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, zIndex: 100000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dm-op-picker-header">
          <div className="dm-op-picker-title">Select Operator</div>
          <input
            className="dm-op-picker-search"
            placeholder="Search operators..."
            value={operatorSearch}
            onChange={(e) => setOperatorSearch(e.target.value)}
            autoFocus
          />
        </div>
        {onToggleMappingNegate && mapping && (
          <div className="dm-op-picker-negate-row">
            <button
              type="button"
              className={`dm-op-picker-negate-btn${mapping.negate ? ' dm-op-picker-negate-btn--active' : ''}`}
              onClick={() => onToggleMappingNegate(mapping.id)}
              aria-label="Toggle negation"
            >
              <span className="dm-op-picker-negate-icon">¬</span>
              <span className="dm-op-picker-negate-label">Negate (NOT)</span>
              {mapping.negate && <span className="dm-op-picker-negate-check">✓</span>}
            </button>
          </div>
        )}
        <div className="dm-op-picker-list" role="listbox" aria-label="Operators">
          {OPERATOR_CATEGORIES.map(cat => {
            const ops = filteredOperators.filter(([, m]) => m.category === cat.key);
            if (ops.length === 0) return null;
            return (
              <div key={cat.key} className="dm-op-picker-category">
                <div className="dm-op-picker-category-label">{cat.label}</div>
                {ops.map(([opKey, meta]) => (
                  <button
                    key={opKey}
                    type="button"
                    role="option"
                    aria-selected={opKey === currentOp}
                    className={`dm-op-picker-item ${opKey === currentOp ? 'dm-op-picker-item--active' : ''}`}
                    onClick={() => handleOperatorSelect(opKey)}
                  >
                    <span className={`dm-op-picker-icon dm-operator-pill--${meta.cssClass}`}>{meta.icon}</span>
                    <span className="dm-op-picker-label">{meta.label}</span>
                    {meta.needsValue && <span className="dm-op-picker-hint">value</span>}
                  </button>
                ))}
              </div>
            );
          })}
          {filteredOperators.length === 0 && (
            <div className="dm-op-picker-empty">No matching operators</div>
          )}
        </div>
      </div>,
      document.body,
    );
  },
);

export default TargetNodeOperatorPicker;
export { OPERATOR_REGISTRY };
