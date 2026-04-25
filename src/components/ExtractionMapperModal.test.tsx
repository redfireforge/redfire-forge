/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExtractionMapperModal from './ExtractionMapperModal';
import type { ExtractionFetchSampleProps } from './ExtractionPathPickerModal';
import type { Extraction } from '../types';

const SAMPLE_JSON = JSON.stringify({
  id: 1,
  title: 'Test Post',
  userId: 42,
  nested: { city: 'NYC', zip: '10001' },
  tags: ['alpha', 'beta'],
}, null, 2);

function makeFetchSample(overrides: Partial<ExtractionFetchSampleProps> = {}): ExtractionFetchSampleProps {
  return {
    onFetch: vi.fn(),
    fetching: false,
    error: null,
    host: {
      enabled: false,
      setEnabled: vi.fn(),
      override: '',
      setOverride: vi.fn(),
      resolvedBaseUrl: 'https://api.example.com',
    },
    ...overrides,
  };
}

function renderModal(props: {
  existingExtractions?: Extraction[];
  sampleResponseBody?: string;
  fetchSample?: ExtractionFetchSampleProps;
} = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const result = render(
    <ExtractionMapperModal
      existingExtractions={props.existingExtractions ?? []}
      sampleResponseBody={props.sampleResponseBody}
      fetchSample={props.fetchSample ?? makeFetchSample()}
      onApply={onApply}
      onClose={onClose}
    />,
  );
  return { ...result, onApply, onClose };
}

describe('ExtractionMapperModal', () => {
  describe('rendering', () => {
    it('renders the modal with title', () => {
      renderModal();
      expect(screen.getByText('Extraction Mapper')).toBeTruthy();
    });

    it('renders in fullscreen by default', () => {
      const { container } = renderModal();
      expect(container.querySelector('.modal-fullscreen')).toBeTruthy();
    });

    it('renders window control buttons', () => {
      renderModal();
      expect(screen.getAllByLabelText('Shrink modal').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText('Close')).toBeTruthy();
    });

    it('renders Fetch Response button', () => {
      const { container } = renderModal();
      const fetchBtn = container.querySelector('.emm-fetch-bar button.btn-accent');
      expect(fetchBtn).toBeTruthy();
      expect(fetchBtn!.textContent).toContain('Fetch Response');
    });

    it('shows "Fetching…" when fetching', () => {
      renderModal({ fetchSample: makeFetchSample({ fetching: true }) });
      expect(screen.getByText('Fetching…')).toBeTruthy();
    });

    it('disables fetch button when fetching', () => {
      renderModal({ fetchSample: makeFetchSample({ fetching: true }) });
      const btn = screen.getByText('Fetching…');
      expect(btn.closest('button')!.disabled).toBe(true);
    });

    it('shows empty state when no response body', () => {
      const { container } = renderModal();
      const emptyTree = container.querySelector('.emm-empty-tree');
      expect(emptyTree).toBeTruthy();
      expect(emptyTree!.textContent).toContain('Fetch Response');
    });

    it('shows fetch error', () => {
      renderModal({ fetchSample: makeFetchSample({ error: 'Network error' }) });
      expect(screen.getByText('Network error')).toBeTruthy();
    });

    it('shows resolved URL when host override is disabled', () => {
      renderModal();
      expect(screen.getByText('https://api.example.com')).toBeTruthy();
    });

    it('shows response size badge', () => {
      renderModal({ sampleResponseBody: SAMPLE_JSON });
      // SAMPLE_JSON is ~120 chars
      expect(screen.getByText(/B$/)).toBeTruthy();
    });
  });

  describe('JSON tree', () => {
    it('renders tree nodes when sample body is provided', () => {
      const { container } = renderModal({ sampleResponseBody: SAMPLE_JSON });
      expect(container.querySelector('.ram-tree-node')).toBeTruthy();
    });

    it('shows parse error for invalid JSON', () => {
      renderModal({ sampleResponseBody: '{invalid' });
      expect(screen.getByText(/Parse error/)).toBeTruthy();
    });

    it('renders search input when tree is available', () => {
      renderModal({ sampleResponseBody: SAMPLE_JSON });
      expect(screen.getByPlaceholderText('Search keys…')).toBeTruthy();
    });

    it('renders expand/collapse buttons when tree is available', () => {
      renderModal({ sampleResponseBody: SAMPLE_JSON });
      expect(screen.getByText('Expand All')).toBeTruthy();
      expect(screen.getByText('Collapse All')).toBeTruthy();
    });

    it('tree is expanded by default (nested keys visible)', () => {
      const { container } = renderModal({ sampleResponseBody: SAMPLE_JSON });
      // "city" is a nested key inside { nested: { city: 'NYC' } }
      const cityNode = Array.from(container.querySelectorAll('.jt-key'))
        .find(el => el.textContent === 'city');
      expect(cityNode).toBeTruthy();
    });

    it('collapse all hides nested keys', () => {
      const { container } = renderModal({ sampleResponseBody: SAMPLE_JSON });
      fireEvent.click(screen.getByText('Collapse All'));
      // After collapse, nested "city" should not be visible
      const cityNode = Array.from(container.querySelectorAll('.jt-key'))
        .find(el => el.textContent === 'city');
      expect(cityNode).toBeFalsy();
    });

    it('expand all after collapse restores nested keys', () => {
      const { container } = renderModal({ sampleResponseBody: SAMPLE_JSON });
      fireEvent.click(screen.getByText('Collapse All'));
      fireEvent.click(screen.getByText('Expand All'));
      const cityNode = Array.from(container.querySelectorAll('.jt-key'))
        .find(el => el.textContent === 'city');
      expect(cityNode).toBeTruthy();
    });
  });

  describe('extraction mapping', () => {
    it('shows existing extractions in right panel', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      renderModal({ existingExtractions: existing, sampleResponseBody: SAMPLE_JSON });
      const input = screen.getByDisplayValue('postId');
      expect(input).toBeTruthy();
    });

    it('shows extraction count badge', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
        { name: 'title', source: 'body', expression: '$.title' },
      ];
      renderModal({ existingExtractions: existing, sampleResponseBody: SAMPLE_JSON });
      expect(screen.getByText('2')).toBeTruthy();
    });

    it('adds extraction via + Add button', () => {
      renderModal({ sampleResponseBody: SAMPLE_JSON });
      fireEvent.click(screen.getByLabelText('Add extraction'));
      // Should create a blank extraction row with empty inputs
      const exprInputs = screen.getAllByLabelText('JSON path expression');
      expect(exprInputs.length).toBe(1);
    });

    it('double-click tree node creates new extraction when no active row', () => {
      const { container } = renderModal({ sampleResponseBody: SAMPLE_JSON });
      // Double-click on the "title" key in the tree
      const titleNode = Array.from(container.querySelectorAll('.jt-key'))
        .find(el => el.textContent === 'title');
      expect(titleNode).toBeTruthy();
      fireEvent.dblClick(titleNode!.closest('.ram-tree-row')!);
      // Should now show the extraction in the right panel
      expect(screen.getByDisplayValue('title')).toBeTruthy();
    });

    it('double-click tree node populates active row expression', () => {
      const { container } = renderModal({ sampleResponseBody: SAMPLE_JSON });
      // Add a blank extraction first
      fireEvent.click(screen.getByLabelText('Add extraction'));
      // Focus the expression input to make it active
      const exprInput = screen.getByLabelText('JSON path expression');
      fireEvent.focus(exprInput);
      // Double-click "title" in tree
      const titleNode = Array.from(container.querySelectorAll('.jt-key'))
        .find(el => el.textContent === 'title');
      fireEvent.dblClick(titleNode!.closest('.ram-tree-row')!);
      // Expression should now be populated
      expect(screen.getByDisplayValue('$.title')).toBeTruthy();
    });

    it('double-click tree updates existing active row without creating new one', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      const { container } = renderModal({ existingExtractions: existing, sampleResponseBody: SAMPLE_JSON });
      // Focus the existing expression input
      const exprInput = screen.getByDisplayValue('$.id') as HTMLInputElement;
      fireEvent.focus(exprInput);
      // Double-click "title" in tree — should update the active row, not add new
      const titleNode = Array.from(container.querySelectorAll('.jt-key'))
        .find(el => el.textContent === 'title');
      fireEvent.dblClick(titleNode!.closest('.ram-tree-row')!);
      expect(screen.getByDisplayValue('$.title')).toBeTruthy();
      // Should still be only 1 extraction
      const allExprInputs = screen.getAllByLabelText('JSON path expression');
      expect(allExprInputs.length).toBe(1);
    });

    it('removes extraction via remove button', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      renderModal({ existingExtractions: existing, sampleResponseBody: SAMPLE_JSON });
      const removeBtn = screen.getByLabelText('Remove extraction 1');
      fireEvent.click(removeBtn);
      expect(screen.queryByDisplayValue('postId')).toBeNull();
    });

    it('updates variable name in mapping', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      renderModal({ existingExtractions: existing, sampleResponseBody: SAMPLE_JSON });
      const input = screen.getByDisplayValue('postId') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'myId' } });
      expect(input.value).toBe('myId');
    });

    it('strips curly braces from variable name', () => {
      const existing: Extraction[] = [
        { name: 'test', source: 'body', expression: '$.id' },
      ];
      renderModal({ existingExtractions: existing, sampleResponseBody: SAMPLE_JSON });
      const input = screen.getByDisplayValue('test') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '{{bad}}' } });
      expect(input.value).toBe('bad');
    });

    it('double-click tree overwrites active row expression for same path', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      const { container } = renderModal({ existingExtractions: existing, sampleResponseBody: SAMPLE_JSON });
      // Focus the existing row
      const exprInput = screen.getByDisplayValue('$.id') as HTMLInputElement;
      fireEvent.focus(exprInput);
      // Double-click "id" in tree — should overwrite with same value
      const idNode = Array.from(container.querySelectorAll('.jt-key'))
        .find(el => el.textContent === 'id');
      fireEvent.dblClick(idNode!.closest('.ram-tree-row')!);
      // Should still have 1 extraction
      const allExprInputs = screen.getAllByLabelText('JSON path expression');
      expect(allExprInputs.length).toBe(1);
    });

    it('shows empty state when no extractions', () => {
      const { container } = renderModal({ sampleResponseBody: SAMPLE_JSON });
      expect(container.querySelector('.emm-empty-mappings')).toBeTruthy();
    });
  });

  describe('host override', () => {
    it('shows host override checkbox', () => {
      renderModal();
      expect(screen.getByText('Host Override')).toBeTruthy();
    });

    it('shows host input when override enabled', () => {
      const fs = makeFetchSample({ host: { enabled: true, setEnabled: vi.fn(), override: '', setOverride: vi.fn(), resolvedBaseUrl: 'https://api.test.com' } });
      const { container } = renderModal({ fetchSample: fs });
      const hostInput = container.querySelector('.ext-host-input');
      expect(hostInput).toBeTruthy();
    });

    it('calls setEnabled when checkbox toggled', () => {
      const setEnabled = vi.fn();
      const fs = makeFetchSample({ host: { enabled: false, setEnabled, override: '', setOverride: vi.fn(), resolvedBaseUrl: '' } });
      renderModal({ fetchSample: fs });
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(setEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('window controls', () => {
    it('toggles fullscreen on shrink click', () => {
      const { container } = renderModal();
      expect(container.querySelector('.modal-fullscreen')).toBeTruthy();
      fireEvent.click(screen.getAllByLabelText('Shrink modal')[0]);
      expect(container.querySelector('.modal-fullscreen')).toBeNull();
    });

    it('toggles back to fullscreen on expand click', () => {
      const { container } = renderModal();
      fireEvent.click(screen.getAllByLabelText('Shrink modal')[0]);
      expect(container.querySelector('.modal-fullscreen')).toBeNull();
      fireEvent.click(screen.getAllByLabelText('Expand modal')[0]);
      expect(container.querySelector('.modal-fullscreen')).toBeTruthy();
    });

    it('shows ⊖ icon when fullscreen', () => {
      renderModal();
      expect(screen.getAllByLabelText('Shrink modal')[0].textContent).toBe('⊖');
    });

    it('shows ⊕ icon when shrunk', () => {
      renderModal();
      fireEvent.click(screen.getAllByLabelText('Shrink modal')[0]);
      expect(screen.getAllByLabelText('Expand modal')[0].textContent).toBe('⊕');
    });
  });

  describe('apply / close', () => {
    it('calls onApply with mapped extractions', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      const { onApply } = renderModal({ existingExtractions: existing, sampleResponseBody: SAMPLE_JSON });
      fireEvent.click(screen.getByText(/Apply 1 Extraction/));
      expect(onApply).toHaveBeenCalledWith([
        { name: 'postId', source: 'body', expression: '$.id' },
      ]);
    });

    it('apply button shows correct count', () => {
      const existing: Extraction[] = [
        { name: 'a', source: 'body', expression: '$.id' },
        { name: 'b', source: 'body', expression: '$.title' },
      ];
      renderModal({ existingExtractions: existing, sampleResponseBody: SAMPLE_JSON });
      expect(screen.getByText(/Apply 2 Extractions/)).toBeTruthy();
    });

    it('apply button shows new count', () => {
      const { container } = renderModal({ sampleResponseBody: SAMPLE_JSON });
      // Add one extraction via + Add button
      fireEvent.click(screen.getByLabelText('Add extraction'));
      // Then double-click tree to fill it
      const titleNode = Array.from(container.querySelectorAll('.jt-key'))
        .find(el => el.textContent === 'title');
      fireEvent.dblClick(titleNode!.closest('.ram-tree-row')!);
      expect(screen.getByText(/1 new/)).toBeTruthy();
    });

    it('calls onClose on Cancel', () => {
      const { onClose } = renderModal();
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose via window close button', () => {
      const { onClose } = renderModal();
      fireEvent.click(screen.getByLabelText('Close'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when clicking overlay', () => {
      const { onClose, container } = renderModal();
      const overlay = container.querySelector('.emm-overlay')!;
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    });

    it('does not close when clicking modal body', () => {
      const { onClose, container } = renderModal();
      const modal = container.querySelector('.emm-modal')!;
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('strips existing flag from applied extractions', () => {
      const existing: Extraction[] = [
        { name: 'x', source: 'body', expression: '$.id', fallback: 'def' },
      ];
      const { onApply } = renderModal({ existingExtractions: existing });
      fireEvent.click(screen.getByText(/Apply 1 Extraction/));
      const applied = onApply.mock.calls[0][0];
      expect(applied[0]).toEqual({ name: 'x', source: 'body', expression: '$.id', fallback: 'def' });
      expect('existing' in applied[0]).toBe(false);
    });
  });

  describe('fetch interaction', () => {
    it('calls onFetch when fetch button clicked', () => {
      const fs = makeFetchSample();
      const { container } = renderModal({ fetchSample: fs });
      const fetchBtn = container.querySelector('.emm-fetch-bar button.btn-accent') as HTMLElement;
      fireEvent.click(fetchBtn);
      expect(fs.onFetch).toHaveBeenCalled();
    });
  });

  describe('editable expression', () => {
    it('renders expression as editable input', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      renderModal({ existingExtractions: existing });
      const exprInput = screen.getByDisplayValue('$.id') as HTMLInputElement;
      expect(exprInput.tagName).toBe('INPUT');
    });

    it('allows editing the expression', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      renderModal({ existingExtractions: existing });
      const exprInput = screen.getByDisplayValue('$.id') as HTMLInputElement;
      fireEvent.change(exprInput, { target: { value: '$.data.id' } });
      expect(exprInput.value).toBe('$.data.id');
    });

    it('includes edited expression in apply output', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      const { onApply } = renderModal({ existingExtractions: existing });
      const exprInput = screen.getByDisplayValue('$.id') as HTMLInputElement;
      fireEvent.change(exprInput, { target: { value: '$.data.id' } });
      fireEvent.click(screen.getByText(/Apply 1 Extraction/));
      expect(onApply).toHaveBeenCalledWith([
        { name: 'postId', source: 'body', expression: '$.data.id' },
      ]);
    });
  });

  describe('existing extractions styling', () => {
    it('marks untouched existing extractions with emm-untouched class', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      const { container } = renderModal({ existingExtractions: existing });
      expect(container.querySelector('.emm-untouched')).toBeTruthy();
    });

    it('marks changed existing extractions with emm-changed class', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      const { container } = renderModal({ existingExtractions: existing });
      // Modify the name to trigger change detection
      const nameInput = container.querySelector('.emm-mapping-row input[placeholder="variableName"]') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'newName' } });
      expect(container.querySelector('.emm-changed')).toBeTruthy();
      expect(container.querySelector('.emm-untouched')).toBeFalsy();
    });

    it('marks new extractions with emm-new class', () => {
      const { container } = renderModal({ existingExtractions: [] });
      // Add a new row — use getAllByText since there may be multiple + Add buttons
      const addBtns = screen.getAllByText('+ Add');
      fireEvent.click(addBtns[0]);
      expect(container.querySelector('.emm-new')).toBeTruthy();
    });

    it('reverts emm-changed to emm-untouched when value restored to original', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      const { container } = renderModal({ existingExtractions: existing });
      const nameInput = container.querySelector('.emm-mapping-row input[placeholder="variableName"]') as HTMLInputElement;
      // Change
      fireEvent.change(nameInput, { target: { value: 'newName' } });
      expect(container.querySelector('.emm-changed')).toBeTruthy();
      // Restore original
      fireEvent.change(nameInput, { target: { value: 'postId' } });
      expect(container.querySelector('.emm-changed')).toBeFalsy();
      expect(container.querySelector('.emm-untouched')).toBeTruthy();
    });
  });

  describe('footer legend', () => {
    it('renders change-state legend dots', () => {
      const { container } = renderModal({});
      expect(container.querySelector('.emm-legend')).toBeTruthy();
      expect(container.querySelector('.emm-legend-new')).toBeTruthy();
      expect(container.querySelector('.emm-legend-changed')).toBeTruthy();
      expect(container.querySelector('.emm-legend-untouched')).toBeTruthy();
    });

    it('shows changed count in apply button', () => {
      const existing: Extraction[] = [
        { name: 'postId', source: 'body', expression: '$.id' },
      ];
      const { container } = renderModal({ existingExtractions: existing });
      const nameInput = container.querySelector('.emm-mapping-row input[placeholder="variableName"]') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'newName' } });
      expect(screen.getByText(/1 changed/)).toBeTruthy();
    });
  });
});
