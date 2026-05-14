/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TargetNodeContextMenu from './TargetNodeContextMenu';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { Mapping, AdapterCapabilities } from './types';

const objectNode: JsonTreeNode = { key: 'id', path: 'data.id', type: 'string', value: '' };
const arrayNode: JsonTreeNode = { key: 'offers', path: 'offers', type: 'array', children: [] };

const baseMapping: Mapping = {
  id: 'm1',
  sourcePath: '$.src',
  sourceId: 'sid',
  targetPath: 'data.id',
};

const fullCaps: Required<AdapterCapabilities> = {
  operators: true,
  arrayAssertions: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

function renderMenu(overrides: Partial<{
  node: JsonTreeNode;
  capabilities: Required<AdapterCapabilities>;
  isMapped: boolean;
  mapping: Mapping | undefined;
  onClose: () => void;
  onOpenOperatorPicker: () => void;
  onToggleMappingNegate: ((mappingId: string) => void) | undefined;
  onEditExpression: ((mappingId: string) => void) | undefined;
  onRemoveMapping: ((id: string) => void) | undefined;
  onAddArrayAssertion: ((arrayPath: string, type: 'length' | 'contains' | 'each' | 'subset') => void) | undefined;
}> = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onOpenOperatorPicker = overrides.onOpenOperatorPicker ?? vi.fn();
  return {
    onClose,
    onOpenOperatorPicker,
    ...render(
      <TargetNodeContextMenu
        position={{ x: 10, y: 20 }}
        node={overrides.node ?? objectNode}
        capabilities={overrides.capabilities ?? fullCaps}
        isMapped={overrides.isMapped ?? true}
        mapping={'mapping' in overrides ? overrides.mapping : baseMapping}
        onClose={onClose}
        onOpenOperatorPicker={onOpenOperatorPicker}
        onToggleMappingNegate={overrides.onToggleMappingNegate}
        onEditExpression={overrides.onEditExpression}
        onRemoveMapping={overrides.onRemoveMapping}
        onAddArrayAssertion={overrides.onAddArrayAssertion}
      />,
    ),
  };
}

describe('TargetNodeContextMenu', () => {
  it('renders "Set operator…" for mapped nodes', () => {
    renderMenu();
    expect(screen.getByText('Set operator…')).toBeInTheDocument();
  });

  it('"Set operator…" closes menu and opens picker', () => {
    const onClose = vi.fn();
    const onOpenOperatorPicker = vi.fn();
    renderMenu({ onClose, onOpenOperatorPicker });
    fireEvent.click(screen.getByText('Set operator…'));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenOperatorPicker).toHaveBeenCalled();
  });

  it('shows "Negate (NOT)" when handler provided and mapping not negated', () => {
    const onToggleMappingNegate = vi.fn();
    renderMenu({ onToggleMappingNegate });
    const btn = screen.getByText('Negate (NOT)');
    fireEvent.click(btn);
    expect(onToggleMappingNegate).toHaveBeenCalledWith('m1');
  });

  it('shows checked "✓ Negated (NOT)" when mapping.negate is true', () => {
    renderMenu({
      mapping: { ...baseMapping, negate: true },
      onToggleMappingNegate: vi.fn(),
    });
    expect(screen.getByText('✓ Negated (NOT)')).toBeInTheDocument();
  });

  it('does NOT render negate button when handler omitted', () => {
    renderMenu({ onToggleMappingNegate: undefined });
    expect(screen.queryByText('Negate (NOT)')).not.toBeInTheDocument();
  });

  it('shows "Edit expression…" only when handler provided', () => {
    const onEditExpression = vi.fn();
    const { rerender } = renderMenu({ onEditExpression });
    fireEvent.click(screen.getByText('Edit expression…'));
    expect(onEditExpression).toHaveBeenCalledWith('m1');

    rerender(
      <TargetNodeContextMenu
        position={{ x: 0, y: 0 }}
        node={objectNode}
        capabilities={fullCaps}
        isMapped
        mapping={baseMapping}
        onClose={vi.fn()}
        onOpenOperatorPicker={vi.fn()}
      />,
    );
    expect(screen.queryByText('Edit expression…')).not.toBeInTheDocument();
  });

  it('shows "Remove mapping" only when handler provided', () => {
    const onRemoveMapping = vi.fn();
    renderMenu({ onRemoveMapping });
    fireEvent.click(screen.getByText('Remove mapping'));
    expect(onRemoveMapping).toHaveBeenCalledWith('m1');
  });

  it('hides mapping section when isMapped is false', () => {
    renderMenu({ isMapped: false, mapping: undefined });
    expect(screen.queryByText('Set operator…')).not.toBeInTheDocument();
  });

  it('shows array-assertion section for array nodes', () => {
    const onAddArrayAssertion = vi.fn();
    renderMenu({ node: arrayNode, onAddArrayAssertion, isMapped: false, mapping: undefined });
    expect(screen.getByText('Array Assertions')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add length assertion'));
    expect(onAddArrayAssertion).toHaveBeenCalledWith('offers', 'length');
  });

  it('dispatches all four assertion types', () => {
    const onAddArrayAssertion = vi.fn();
    renderMenu({ node: arrayNode, onAddArrayAssertion, isMapped: false, mapping: undefined });
    fireEvent.click(screen.getByText('Add length assertion'));
    fireEvent.click(screen.getByText('Add contains assertion'));
    fireEvent.click(screen.getByText('Add each assertion'));
    fireEvent.click(screen.getByText('Add subset assertion'));
    expect(onAddArrayAssertion).toHaveBeenCalledTimes(4);
    expect(onAddArrayAssertion.mock.calls.map(c => c[1])).toEqual(['length', 'contains', 'each', 'subset']);
  });

  it('renders assertion section divider when mapped + array node', () => {
    const { container } = renderMenu({ node: arrayNode, onAddArrayAssertion: vi.fn() });
    expect(container.querySelector('.dm-context-menu-divider')).toBeInTheDocument();
  });

  it('disables assertion buttons when onAddArrayAssertion is omitted', () => {
    renderMenu({ node: arrayNode, onAddArrayAssertion: undefined, isMapped: false, mapping: undefined });
    const btn = screen.getByText('Add length assertion').closest('button');
    expect(btn).toBeDisabled();
  });

  it('hides array-assertions section when arrayAssertions capability is false', () => {
    const caps: Required<AdapterCapabilities> = { ...fullCaps, arrayAssertions: false };
    renderMenu({ node: arrayNode, capabilities: caps, isMapped: false, mapping: undefined });
    expect(screen.queryByText('Array Assertions')).not.toBeInTheDocument();
  });

  it('renders nothing meaningful when not mapped and not array', () => {
    renderMenu({ isMapped: false, mapping: undefined });
    expect(screen.queryByText('Set operator…')).not.toBeInTheDocument();
    expect(screen.queryByText('Array Assertions')).not.toBeInTheDocument();
  });
});
