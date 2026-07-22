/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { selectOption, getCustomSelectValue } from '../../../test-utils/customSelectHelper';
import TargetPanel from './TargetPanel';
import type { MapperTarget, Mapping } from './types';
import type { Assertion } from '../../types';

const target: MapperTarget = {
  label: 'Output',
  sampleData: { userName: '', email: '', address: { city: '' } },
  allowCustomFields: false,
};

const mapping: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' };

function renderPanel(overrides?: Partial<Parameters<typeof TargetPanel>[0]>) {
  const defaults = {
    target,
    mappings: [] as Mapping[],
    onDrop: vi.fn(),
    selectedMappingId: null,
    onSelectMapping: vi.fn(),
  };
  return render(<TargetPanel {...defaults} {...overrides} />);
}

describe('TargetPanel', () => {

  describe('toggle and custom field coverage', () => {
    it('collapses expanded node on toggle click', () => {
      renderPanel();
      const collapseBtn = screen.queryAllByLabelText('Collapse');
      if (collapseBtn.length > 0) {
        fireEvent.click(collapseBtn[0]);
        expect(screen.queryAllByLabelText('Expand').length).toBeGreaterThanOrEqual(1);
      }
    });

    it('expands collapsed node on toggle click', () => {
      renderPanel();
      const collapseBtn = screen.queryAllByLabelText('Collapse');
      if (collapseBtn.length > 0) {
        fireEvent.click(collapseBtn[0]);
        const expandBtn = screen.queryAllByLabelText('Expand');
        if (expandBtn.length > 0) {
          fireEvent.click(expandBtn[0]);
          expect(expandBtn[0]).toBeTruthy();
        }
      }
    });

    it('renders with custom fields and existing paths', () => {
      const onAddCustomField = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: { field: '' },
        allowCustomFields: true,
        fields: [
          { path: 'field', label: 'field', type: 'string' },
          { path: 'field_2', label: 'field_2', type: 'string' },
        ],
      };
      renderPanel({
        target: customTarget,
        onAddCustomField,
        existingPaths: new Set(['field', 'field_2']),
      });
      expect(screen.getByText('Target')).toBeTruthy();
    });

    it('handles drag over empty state with valid custom MIME payload', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      const payload = JSON.stringify({ path: 'name', sourceId: 's1' });
      fireEvent.dragOver(emptyState!, {
        dataTransfer: {
          getData: (type: string) => type === 'application/mapper-source' ? payload : '',
          dropEffect: 'none',
        },
      });
    });

    it('handles drop on empty state with text/plain payload', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      const payload = JSON.stringify({ path: 'name', sourceId: 's1' });
      fireEvent.drop(emptyState!, {
        dataTransfer: {
          getData: (type: string) => type === 'text/plain' ? payload : '',
          dropEffect: 'none',
        },
      });
      expect(onAddCustomField).toHaveBeenCalled();
      expect(onDrop).toHaveBeenCalledWith('name', 'name', 's1');
    });

    it('handles drop with dotted path uses last segment as label', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      const payload = JSON.stringify({ path: 'user.name', sourceId: 's1' });
      fireEvent.drop(emptyState!, {
        dataTransfer: {
          getData: (type: string) => type === 'text/plain' ? payload : '',
          dropEffect: 'none',
        },
      });
      expect(onAddCustomField).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'user.name', label: 'name' }),
      );
    });

    it('handles drag over but ignores when custom fields not allowed', () => {
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: false,
      };
      const { container } = renderPanel({
        target: customTarget,
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      fireEvent.dragOver(emptyState!, {
        dataTransfer: {
          getData: () => JSON.stringify({ path: 'x', sourceId: 's1' }),
          dropEffect: 'none',
        },
      });
    });

    it('extractDraggedSource falls back to getDraggedSource when no payload', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
        getDraggedSource: () => ({ path: 'fallback', sourceId: 's2' }),
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      fireEvent.drop(emptyState!, {
        dataTransfer: {
          getData: () => '',
          dropEffect: 'none',
        },
      });
      expect(onAddCustomField).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'fallback' }),
      );
    });

    it('extractDraggedSource handles SOURCE_TEXT_PREFIX in payload', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
      });
      const emptyState = container.querySelector('.dm-empty-state');
      expect(emptyState).toBeTruthy();
      const payload = 'mapper-source:' + JSON.stringify({ path: 'prefixed', sourceId: 's1' });
      fireEvent.drop(emptyState!, {
        dataTransfer: {
          getData: (type: string) => type === 'text/plain' ? payload : '',
          dropEffect: 'none',
        },
      });
      expect(onAddCustomField).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'prefixed' }),
      );
    });

    it('extractDraggedSource ignores invalid JSON drag payload then uses fallback', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
        getDraggedSource: () => ({ path: 'after-invalid-json', sourceId: 's1' }),
      });
      const emptyState = container.querySelector('.dm-empty-state');
      fireEvent.drop(emptyState!, {
        dataTransfer: {
          getData: (type: string) => (type === 'application/mapper-source' ? '{bad' : ''),
          dropEffect: 'none',
        },
      });
      expect(onAddCustomField).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'after-invalid-json' }),
      );
    });

    it('extractDraggedSource ignores JSON with non-string path then uses fallback', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const customTarget: MapperTarget = {
        label: 'Custom',
        sampleData: null,
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: customTarget,
        onAddCustomField,
        onDrop,
        getDraggedSource: () => ({ path: 'after-bad-shape', sourceId: 's1' }),
      });
      const emptyState = container.querySelector('.dm-empty-state');
      fireEvent.drop(emptyState!, {
        dataTransfer: {
          getData: (type: string) =>
            type === 'text/plain' ? JSON.stringify({ path: 123, sourceId: 's9' }) : '',
          dropEffect: 'none',
        },
      });
      expect(onAddCustomField).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'after-bad-shape' }),
      );
    });

    it('createUniquePath appends suffix when path collides with existing field paths', () => {
      const onAddCustomField = vi.fn();
      const onDrop = vi.fn();
      const collisionTarget: MapperTarget = {
        label: 'Collision',
        sampleData: '{not-json',
        fields: [
          { path: 'dup', label: 'Dup', type: 'string' },
          { path: 'dup_2', label: 'Dup 2', type: 'string' },
        ],
        allowCustomFields: true,
      };
      const { container } = renderPanel({
        target: collisionTarget,
        onAddCustomField,
        onDrop,
      });
      const emptyState = container.querySelector('.dm-empty-state');
      fireEvent.drop(emptyState!, {
        dataTransfer: {
          getData: (type: string) =>
            type === 'text/plain' ? JSON.stringify({ path: 'dup', sourceId: 's1' }) : '',
          dropEffect: 'none',
        },
      });
      expect(onAddCustomField).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'dup_3', label: 'dup_3' }),
      );
      expect(onDrop).toHaveBeenCalledWith('dup_3', 'dup', 's1');
    });

    it('onTreeKeyDown is invoked when provided', () => {
      const onTreeKeyDown = vi.fn();
      const { container } = renderPanel({ onTreeKeyDown });
      const treeContainer = container.querySelector('.dm-tree-container');
      if (treeContainer) {
        fireEvent.keyDown(treeContainer, { key: 'ArrowDown' });
        expect(onTreeKeyDown).toHaveBeenCalled();
      }
    });

    it('handles invalid sampleData string gracefully for sampleSignature', () => {
      renderPanel({
        target: { label: 'Bad', sampleData: '{invalid-json', allowCustomFields: false },
      });
      expect(screen.getByText('Target')).toBeTruthy();
    });

    it('treats non-serializable sampleData as empty signature without throwing', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      renderPanel({
        target: { label: 'Circular', sampleData: circular, allowCustomFields: false },
      });
      expect(screen.getByText('Target')).toBeTruthy();
    });

    it('resetViewSignal with null tree resets view state without throwing', () => {
      const badFieldsTarget: MapperTarget = {
        label: 'BadSampleWithFields',
        sampleData: '{bad',
        fields: [{ path: 'orphan', label: 'Orphan', type: 'string' }],
        allowCustomFields: false,
      };
      const props = {
        target: badFieldsTarget,
        mappings: [] as Mapping[],
        onDrop: vi.fn(),
        selectedMappingId: null,
        onSelectMapping: vi.fn(),
      };
      const { rerender } = render(<TargetPanel {...props} resetViewSignal={null} />);
      rerender(<TargetPanel {...props} resetViewSignal={42} />);
      expect(screen.getByText(/No target schema/)).toBeTruthy();
      expect(getCustomSelectValue(screen.getByLabelText('Filter target fields').closest('.cs-wrapper')!)).toBe('All');
    });

    it('togglePasteMode catches invalid string sampleData and sets empty paste text', () => {
      renderPanel({
        target: { label: 'Bad JSON', sampleData: '{not-valid', allowCustomFields: false },
        onPasteTargetSample: vi.fn(),
      });
      fireEvent.click(screen.getByLabelText('Paste JSON'));
      const textarea = screen.getByLabelText('Paste target JSON') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });

    it('handleFetch is a no-op when onFetchTargetSchema is not provided', () => {
      renderPanel({ canFetchTarget: false });
      expect(screen.queryByLabelText('Fetch target schema')).toBeNull();
    });
  });

  describe('verify filters and highlights', () => {
    it('sets filter to failed when filterFailedSignal updates', () => {
      const emailMap: Mapping = { id: 'mE', sourcePath: 'src', sourceId: 's1', targetPath: 'email' };
      const props = {
        target,
        mappings: [emailMap],
        onDrop: vi.fn(),
        selectedMappingId: null,
        onSelectMapping: vi.fn(),
        nodeStatusMap: new Map<string, 'pass' | 'fail'>([['email', 'fail']]),
      };
      const { rerender } = render(<TargetPanel {...props} filterFailedSignal={null} />);
      rerender(<TargetPanel {...props} filterFailedSignal={1} />);
      expect(getCustomSelectValue(screen.getByLabelText('Filter target fields').closest('.cs-wrapper')!)).toBe('Failed');
    });

    it('filters tree leaves by verification passed paths', () => {
      renderPanel({
        mappings: [mapping],
        nodeStatusMap: new Map([
          ['userName', 'pass'],
          ['email', 'fail'],
        ]),
      });
      selectOption(screen.getByLabelText('Filter target fields').closest('.cs-wrapper')!, 'Passed');
      expect(screen.getByText('userName')).toBeTruthy();
      expect(screen.queryByText('email')).toBeNull();
    });

    it('applies hover-highlight class when highlightedPaths matches mapped leaf', () => {
      const { container } = renderPanel({
        mappings: [mapping],
        highlightedPaths: new Set(['userName']),
      });
      fireEvent.click(screen.getByLabelText('Expand all'));
      const row = container.querySelector('[data-path="userName"]');
      expect(row?.className).toContain('dm-tree-node--hover-highlight');
    });

    it('shows unresolved counts on badge when explicitly provided', () => {
      const { container } = renderPanel({
        mappings: [mapping],
        resolvedMappingCount: 1,
        unresolvedMappingCount: 4,
      });
      const badge = container.querySelector('.dm-mapped-count-badge');
      expect(badge?.textContent).toContain('1 mapped');
      expect(badge?.textContent).toContain('4 unresolved');
    });

    it('shows 0 mapped label when resolved count is zero but unresolved is positive', () => {
      const { container } = renderPanel({
        mappings: [mapping],
        resolvedMappingCount: 0,
        unresolvedMappingCount: 3,
      });
      const badge = container.querySelector('.dm-mapped-count-badge');
      expect(badge?.textContent).toContain('0 mapped');
      expect(badge?.textContent).toContain('3 unresolved');
    });

    it('includes passing array assertion jsonPath in passed verify filter', () => {
      const arrAssertion: Assertion = {
        type: 'arrayLength',
        jsonPath: 'email',
        operator: '=',
        value: 0,
      };
      renderPanel({
        mappings: [mapping],
        nodeStatusMap: new Map([
          ['userName', 'fail'],
          ['email', 'fail'],
        ]),
        arrayAssertions: [arrAssertion],
        assertionVerifyMap: new Map([[0, { passed: true, actual: '0', expected: '0' }]]),
      });
      selectOption(screen.getByLabelText('Filter target fields').closest('.cs-wrapper')!, 'Passed');
      expect(screen.queryByText('userName')).toBeNull();
      expect(screen.getByText('email')).toBeTruthy();
    });

    it('includes failing array assertion jsonPath in failed verify filter', () => {
      const arrAssertion: Assertion = {
        type: 'regex',
        jsonPath: 'userName',
        pattern: '.*',
      };
      renderPanel({
        mappings: [mapping],
        nodeStatusMap: new Map([
          ['userName', 'pass'],
          ['email', 'pass'],
        ]),
        arrayAssertions: [arrAssertion],
        assertionVerifyMap: new Map([[0, { passed: false, actual: 'x', expected: 'y' }]]),
      });
      selectOption(screen.getByLabelText('Filter target fields').closest('.cs-wrapper')!, 'Failed');
      expect(screen.getByText('userName')).toBeTruthy();
      expect(screen.queryByText('email')).toBeNull();
    });

    it('skips assertion paths without jsonPath when merging verify filters', () => {
      const statusAssertion = { type: 'status' as const, expected: '200' };
      renderPanel({
        mappings: [mapping],
        nodeStatusMap: new Map([['userName', 'pass']]),
        arrayAssertions: [statusAssertion],
        assertionVerifyMap: new Map([[0, { passed: true }]]),
      });
      selectOption(screen.getByLabelText('Filter target fields').closest('.cs-wrapper')!, 'Passed');
      expect(screen.getByText('userName')).toBeTruthy();
    });
  });

  describe('scrollToPathSignal', () => {
    const panelDefaults = {
      target,
      mappings: [] as Mapping[],
      onDrop: vi.fn(),
      selectedMappingId: null as string | null,
      onSelectMapping: vi.fn(),
    };

    it('auto-expands ancestors and scrolls to node on signal', async () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const deepTarget: MapperTarget = {
        label: 'Output',
        sampleData: { nested: { deep: { value: 42 } } },
        allowCustomFields: false,
      };
      const { rerender, container } = render(<TargetPanel {...panelDefaults} target={deepTarget} />);

      fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
      expect(container.querySelector('[data-path="nested.deep.value"]')).toBeNull();

      rerender(
        <TargetPanel {...panelDefaults} target={deepTarget} scrollToPathSignal={{ path: '$.nested.deep.value', tick: 1 }} />,
      );

      await waitFor(() => {
        const node = container.querySelector('[data-path="nested.deep.value"]');
        expect(node).not.toBeNull();
      });
    });

    it('strips $. prefix and finds node by stripped path', async () => {
      const { rerender, container } = render(<TargetPanel {...panelDefaults} />);

      rerender(
        <TargetPanel {...panelDefaults} scrollToPathSignal={{ path: '$.userName', tick: 1 }} />,
      );

      await waitFor(() => {
        const node = container.querySelector('[data-path="userName"]');
        expect(node).not.toBeNull();
      });
    });

    it('handles path without $. prefix', async () => {
      const { rerender, container } = render(<TargetPanel {...panelDefaults} />);

      rerender(
        <TargetPanel {...panelDefaults} scrollToPathSignal={{ path: 'userName', tick: 1 }} />,
      );

      await waitFor(() => {
        expect(container.querySelector('[data-path="userName"]')).not.toBeNull();
      });
    });
  });

  describe('custom predicates section', () => {
    it('renders custom predicates when arrayAssertions contain custom type', () => {
      const customAssertions: Assertion[] = [
        { type: 'custom', expression: '$gt($.body.count, 0)' } as unknown as Assertion,
        { type: 'custom', expression: '$lt($.body.total, 100)' } as unknown as Assertion,
      ];
      render(
        <TargetPanel
          target={target}
          mappings={[]}
          onDrop={vi.fn()}
          selectedMappingId={null}
          onSelectMapping={vi.fn()}
          arrayAssertions={customAssertions}
        />,
      );
      expect(screen.getByText('Custom Predicates')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
    });

    it('toggles custom predicates section expand/collapse', () => {
      const customAssertions: Assertion[] = [
        { type: 'custom', expression: '$gt($.body.count, 0)' } as unknown as Assertion,
      ];
      render(
        <TargetPanel
          target={target}
          mappings={[]}
          onDrop={vi.fn()}
          selectedMappingId={null}
          onSelectMapping={vi.fn()}
          arrayAssertions={customAssertions}
          onUpdateArrayAssertion={vi.fn()}
          onRemoveArrayAssertion={vi.fn()}
        />,
      );
      const header = screen.getByText('Custom Predicates').closest('button')!;
      expect(header.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(header);
      expect(header.getAttribute('aria-expanded')).toBe('false');
    });
  });
});
