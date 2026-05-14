import { forwardRef } from 'react';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { Mapping, AdapterCapabilities } from './types';

/**
 * Right-click context menu shown when the user right-clicks a target tree
 * node. Offers operator/negation/expression/remove actions for mapped nodes
 * and array-assertion shortcuts for array nodes. Extracted from
 * `TargetTreeNode.tsx` so the menu can be reasoned about (and tested) in
 * isolation from the rest of the row.
 */
interface TargetNodeContextMenuProps {
  position: { x: number; y: number };
  node: JsonTreeNode;
  capabilities?: Required<AdapterCapabilities>;
  isMapped: boolean;
  mapping: Mapping | undefined;
  onClose: () => void;
  onOpenOperatorPicker: () => void;
  onToggleMappingNegate?: (mappingId: string) => void;
  onEditExpression?: (mappingId: string) => void;
  onRemoveMapping?: (id: string) => void;
  onAddArrayAssertion?: (arrayPath: string, assertionType: 'length' | 'contains' | 'each' | 'subset') => void;
}

const TargetNodeContextMenu = forwardRef<HTMLDivElement, TargetNodeContextMenuProps>(
  function TargetNodeContextMenu(
    {
      position,
      node,
      capabilities,
      isMapped,
      mapping,
      onClose,
      onOpenOperatorPicker,
      onToggleMappingNegate,
      onEditExpression,
      onRemoveMapping,
      onAddArrayAssertion,
    },
    ref,
  ) {
    const close = (fn?: () => void) => () => { onClose(); fn?.(); };

    return (
      <div
        ref={ref}
        className="dm-context-menu"
        style={{ position: 'fixed', top: position.y, left: position.x, zIndex: 10001 }}
        onClick={(e) => e.stopPropagation()}
      >
        {isMapped && mapping && (
          <>
            <button
              type="button"
              className="dm-context-menu-item"
              onClick={close(onOpenOperatorPicker)}
            >
              Set operator…
            </button>
            {onToggleMappingNegate && (
              <button
                type="button"
                className={`dm-context-menu-item${mapping.negate ? ' dm-context-menu-item--active' : ''}`}
                onClick={close(() => onToggleMappingNegate(mapping.id))}
              >
                {mapping.negate ? '✓ Negated (NOT)' : 'Negate (NOT)'}
              </button>
            )}
            {onEditExpression && (
              <button
                type="button"
                className="dm-context-menu-item"
                onClick={close(() => onEditExpression(mapping.id))}
              >
                Edit expression…
              </button>
            )}
            {onRemoveMapping && (
              <button
                type="button"
                className="dm-context-menu-item dm-context-menu-item--danger"
                onClick={close(() => onRemoveMapping(mapping.id))}
              >
                Remove mapping
              </button>
            )}
          </>
        )}
        {node.type === 'array' && capabilities?.arrayAssertions && (
          <>
            {isMapped && mapping && <div className="dm-context-menu-divider" />}
            <div className="dm-context-menu-label">Array Assertions</div>
            <button
              type="button"
              className="dm-context-menu-item"
              disabled={!onAddArrayAssertion}
              onClick={close(() => onAddArrayAssertion?.(node.path, 'length'))}
            >
              Add length assertion
            </button>
            <button
              type="button"
              className="dm-context-menu-item"
              disabled={!onAddArrayAssertion}
              onClick={close(() => onAddArrayAssertion?.(node.path, 'contains'))}
            >
              Add contains assertion
            </button>
            <button
              type="button"
              className="dm-context-menu-item"
              disabled={!onAddArrayAssertion}
              onClick={close(() => onAddArrayAssertion?.(node.path, 'each'))}
            >
              Add each assertion
            </button>
            <button
              type="button"
              className="dm-context-menu-item"
              disabled={!onAddArrayAssertion}
              onClick={close(() => onAddArrayAssertion?.(node.path, 'subset'))}
            >
              Add subset assertion
            </button>
          </>
        )}
      </div>
    );
  },
);

export default TargetNodeContextMenu;
