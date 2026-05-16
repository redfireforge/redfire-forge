import { forwardRef } from 'react';
import { createPortal } from 'react-dom';
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
  isRenamable?: boolean;
  onClose: () => void;
  onOpenOperatorPicker: () => void;
  onToggleMappingNegate?: (mappingId: string) => void;
  onEditExpression?: (mappingId: string) => void;
  onRemoveMapping?: (id: string) => void;
  onAddArrayAssertion?: (arrayPath: string, assertionType: 'length' | 'contains' | 'each' | 'subset') => void;
  onRename?: () => void;
}

const TargetNodeContextMenu = forwardRef<HTMLDivElement, TargetNodeContextMenuProps>(
  function TargetNodeContextMenu(
    {
      position,
      node,
      capabilities,
      isMapped,
      mapping,
      isRenamable,
      onClose,
      onOpenOperatorPicker,
      onToggleMappingNegate,
      onEditExpression,
      onRemoveMapping,
      onAddArrayAssertion,
      onRename,
    },
    ref,
  ) {
    const close = (fn?: () => void) => () => { onClose(); fn?.(); };

    return createPortal(
      <div
        ref={ref}
        className="dm-context-menu"
        style={{ position: 'fixed', top: position.y, left: position.x, zIndex: 100001 }}
        onClick={(e) => e.stopPropagation()}
      >
        {isRenamable && onRename && (
          <button
            type="button"
            className="dm-context-menu-item"
            onClick={close(onRename)}
          >
            Rename…
          </button>
        )}
        {isMapped && mapping && (
          <>
            {isRenamable && onRename && <div className="dm-context-menu-divider" />}
            {capabilities?.operators && (
              <button
                type="button"
                className="dm-context-menu-item"
                onClick={close(onOpenOperatorPicker)}
              >
                Set operator…
              </button>
            )}
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
              className="dm-context-menu-item dm-context-menu-item--described"
              disabled={!onAddArrayAssertion}
              onClick={close(() => onAddArrayAssertion?.(node.path, 'length'))}
            >
              <span className="dm-context-menu-item-title">Check array size</span>
              <span className="dm-context-menu-item-desc">e.g. {node.key} has &gt;= 3 items</span>
            </button>
            <button
              type="button"
              className="dm-context-menu-item dm-context-menu-item--described"
              disabled={!onAddArrayAssertion}
              onClick={close(() => onAddArrayAssertion?.(node.path, 'contains'))}
            >
              <span className="dm-context-menu-item-title">Contains value (exact match)</span>
              <span className="dm-context-menu-item-desc">e.g. {node.key} has an item equal to &quot;premium&quot;</span>
            </button>
            <button
              type="button"
              className="dm-context-menu-item dm-context-menu-item--described"
              disabled={!onAddArrayAssertion}
              onClick={close(() => onAddArrayAssertion?.(node.path, 'each'))}
            >
              <span className="dm-context-menu-item-title">Every item must match</span>
              <span className="dm-context-menu-item-desc">e.g. every item in {node.key} has &quot;id&quot;</span>
            </button>
            <button
              type="button"
              className="dm-context-menu-item dm-context-menu-item--described"
              disabled={!onAddArrayAssertion}
              onClick={close(() => onAddArrayAssertion?.(node.path, 'subset'))}
            >
              <span className="dm-context-menu-item-title">Contains object (deep partial match)</span>
              <span className="dm-context-menu-item-desc">e.g. {node.key} has item matching {'{'}&quot;type&quot;: &quot;active&quot;, ...{'}'}</span>
            </button>
          </>
        )}
      </div>,
      document.body,
    );
  },
);

export default TargetNodeContextMenu;
