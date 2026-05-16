/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegexAssertionBuilderModal from './RegexAssertionBuilderModal';

vi.mock('../FullPanelModal', () => ({
  default: ({
    children,
    title,
    footer,
    onClose,
  }: {
    children: React.ReactNode;
    title: React.ReactNode;
    footer: React.ReactNode;
    onClose: () => void;
  }) => (
    <div data-testid="full-panel-modal" data-title={title}>
      <div data-testid="modal-footer">{footer}</div>
      <div data-testid="modal-body" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
      <button onClick={onClose} data-testid="modal-close">X</button>
    </div>
  ),
}));

const SAMPLE_JSON = JSON.stringify({
  status: 'active',
  user: { name: 'Alice', age: 30 },
  tags: ['admin', 'user'],
});

function renderModal(props: Partial<Parameters<typeof RegexAssertionBuilderModal>[0]> = {}) {
  const defaults = {
    onSave: vi.fn(),
    onCancel: vi.fn(),
    sampleJson: SAMPLE_JSON,
    ...props,
  };
  return {
    ...render(<RegexAssertionBuilderModal {...defaults} />),
    onSave: defaults.onSave,
    onCancel: defaults.onCancel,
  };
}

describe('RegexAssertionBuilderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with title and buttons', () => {
      renderModal();
      const modal = screen.getByTestId('full-panel-modal');
      expect(modal).toHaveAttribute('data-title', 'Regex Assertion Builder');
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Apply Assertion')).toBeInTheDocument();
    });

    it('renders JSON tree from sampleJson', () => {
      renderModal();
      expect(screen.getByText('status')).toBeInTheDocument();
      const keys = screen.getAllByText('user');
      expect(keys.length).toBeGreaterThan(0);
      expect(screen.getByText('tags')).toBeInTheDocument();
    });

    it('shows leaf count', () => {
      renderModal();
      expect(screen.getByText(/\d+ fields/)).toBeInTheDocument();
    });

    it('renders empty state when no sampleJson', () => {
      renderModal({ sampleJson: '' });
      expect(screen.getByPlaceholderText(/Paste sample JSON/)).toBeInTheDocument();
    });

    it('shows parse error for invalid JSON', () => {
      renderModal({ sampleJson: '{invalid' });
      expect(screen.getByText(/Parse error/)).toBeInTheDocument();
    });
  });

  describe('JSONPath input', () => {
    it('initializes with initialJsonPath', () => {
      renderModal({ initialJsonPath: '$.user.name' });
      const input = screen.getByTestId('jsonpath-input');
      expect(input).toHaveValue('$.user.name');
    });

    it('allows manual path entry', () => {
      renderModal();
      const input = screen.getByTestId('jsonpath-input');
      fireEvent.change(input, { target: { value: '$.status' } });
      expect(input).toHaveValue('$.status');
    });

    it('resolves value from sample JSON', () => {
      renderModal({ initialJsonPath: '$.status' });
      const resolved = screen.getByText('Value:');
      expect(resolved).toBeInTheDocument();
      const code = resolved.parentElement?.querySelector('code');
      expect(code?.textContent).toBe('active');
    });

    it('shows "not found" for missing paths', () => {
      renderModal({ initialJsonPath: '$.missing' });
      expect(screen.getByText('Path not found in sample JSON')).toBeInTheDocument();
    });
  });

  describe('tree selection', () => {
    it('updates jsonPath when tree leaf is clicked', () => {
      renderModal();
      const leaf = screen.getByTestId('tree-leaf-status');
      fireEvent.click(leaf);
      expect(screen.getByTestId('jsonpath-input')).toHaveValue('$.status');
    });

    it('adds $. prefix to selected path', () => {
      renderModal();
      const leaf = screen.getByTestId('tree-leaf-status');
      fireEvent.click(leaf);
      expect(screen.getByTestId('jsonpath-input')).toHaveValue('$.status');
    });
  });

  describe('pattern input', () => {
    it('initializes with initialPattern', () => {
      renderModal({ initialPattern: '^[A-Z]+$' });
      expect(screen.getByTestId('pattern-input')).toHaveValue('^[A-Z]+$');
    });

    it('allows manual pattern entry', () => {
      renderModal();
      const input = screen.getByTestId('pattern-input');
      fireEvent.change(input, { target: { value: '.+' } });
      expect(input).toHaveValue('.+');
    });
  });

  describe('pattern library', () => {
    it('toggles pattern library visibility', () => {
      renderModal();
      expect(screen.queryByTestId('pattern-library')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Pattern Library'));
      expect(screen.getByTestId('pattern-library')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Hide Library'));
      expect(screen.queryByTestId('pattern-library')).not.toBeInTheDocument();
    });

    it('applies pattern from library', () => {
      renderModal();
      fireEvent.click(screen.getByText('Pattern Library'));
      const library = screen.getByTestId('pattern-library');
      const uuidEntry = within(library).getByText('UUID v4');
      fireEvent.click(uuidEntry.closest('.ram-library-item')!);
      const input = screen.getByTestId('pattern-input');
      expect((input as HTMLInputElement).value).toContain('[0-9a-f]');
    });

    it('filters by category', () => {
      renderModal();
      fireEvent.click(screen.getByText('Pattern Library'));
      fireEvent.click(screen.getByText('Numbers'));
      expect(screen.getByText('Positive integer')).toBeInTheDocument();
      expect(screen.queryByText('UUID v4')).not.toBeInTheDocument();
    });
  });

  describe('live preview', () => {
    it('shows MATCH when pattern matches resolved value', () => {
      renderModal({ initialJsonPath: '$.status', initialPattern: 'active' });
      expect(screen.getByText('MATCH')).toBeInTheDocument();
    });

    it('shows NO MATCH when pattern does not match', () => {
      renderModal({ initialJsonPath: '$.status', initialPattern: '^zzz$' });
      expect(screen.getByText('NO MATCH')).toBeInTheDocument();
    });

    it('shows INVALID REGEX for bad pattern', () => {
      renderModal({ initialJsonPath: '$.status', initialPattern: '[invalid(' });
      expect(screen.getByText('INVALID REGEX')).toBeInTheDocument();
    });
  });

  describe('save / cancel', () => {
    it('Apply Assertion is disabled when no jsonPath', () => {
      renderModal({ initialPattern: 'test' });
      expect(screen.getByText('Apply Assertion')).toBeDisabled();
    });

    it('Apply Assertion is disabled when no pattern', () => {
      renderModal({ initialJsonPath: '$.status' });
      expect(screen.getByText('Apply Assertion')).toBeDisabled();
    });

    it('Apply Assertion is enabled when both are set', () => {
      renderModal({ initialJsonPath: '$.status', initialPattern: '.+' });
      expect(screen.getByText('Apply Assertion')).not.toBeDisabled();
    });

    it('calls onSave with result on Apply', () => {
      const { onSave } = renderModal({ initialJsonPath: '$.status', initialPattern: '.+' });
      fireEvent.click(screen.getByText('Apply Assertion'));
      expect(onSave).toHaveBeenCalledWith({
        jsonPath: '$.status',
        pattern: '.+',
        patternName: undefined,
      });
    });

    it('includes patternName when selected from library', () => {
      const { onSave } = renderModal({ initialJsonPath: '$.status' });
      fireEvent.click(screen.getByText('Pattern Library'));
      const notEmpty = screen.getByText('Not empty');
      fireEvent.click(notEmpty.closest('.ram-library-item')!);
      fireEvent.click(screen.getByText('Apply Assertion'));
      expect(onSave).toHaveBeenCalledWith({
        jsonPath: '$.status',
        pattern: '.+',
        patternName: 'Not empty',
      });
    });

    it('calls onCancel on Cancel', () => {
      const { onCancel } = renderModal();
      fireEvent.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('filters tree nodes by search term', () => {
      renderModal();
      expect(screen.getByText('status')).toBeInTheDocument();
      const search = screen.getByTestId('tree-search');
      fireEvent.change(search, { target: { value: 'name' } });
      expect(screen.queryByTestId('tree-leaf-status')).not.toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
    });
  });

  describe('paste mode', () => {
    it('switches to paste mode and applies JSON', () => {
      renderModal({ sampleJson: '' });
      const textarea = screen.getByPlaceholderText(/Paste sample JSON/);
      fireEvent.change(textarea, { target: { value: '{"foo":"bar"}' } });
      expect(screen.getByText('foo')).toBeInTheDocument();
    });
  });

  describe('fetch support', () => {
    it('shows fetch button when onFetchSampleResponse provided', () => {
      const fetchFn = vi.fn();
      renderModal({ onFetchSampleResponse: fetchFn });
      const btn = screen.getByTitle('Fetch Response');
      expect(btn).toBeInTheDocument();
    });

    it('shows error when fetchError is set', () => {
      renderModal({ fetchError: { message: 'Connection refused' } });
      expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });
  });

  describe('external sampleJson sync', () => {
    it('updates tree when externalJson prop changes', () => {
      const { rerender } = render(
        <RegexAssertionBuilderModal
          onSave={vi.fn()}
          onCancel={vi.fn()}
          sampleJson='{"a": 1}'
        />,
      );
      expect(screen.getByText('a')).toBeInTheDocument();

      rerender(
        <RegexAssertionBuilderModal
          onSave={vi.fn()}
          onCancel={vi.fn()}
          sampleJson='{"b": 2}'
        />,
      );
      expect(screen.getByText('b')).toBeInTheDocument();
    });
  });

  describe('tree expand/collapse', () => {
    it('collapses all nodes via Collapse all button hides nested children', () => {
      renderModal();
      expect(screen.getByText('name')).toBeInTheDocument();
      fireEvent.click(screen.getByTitle('Collapse all'));
      // Root children (status, user, tags) still visible since root is always expanded
      // But nested children under "user" (name, age) should be hidden
      expect(screen.queryByTestId('tree-leaf-user.name')).not.toBeInTheDocument();
    });

    it('expands all nodes via Expand all button after collapse', () => {
      renderModal();
      fireEvent.click(screen.getByTitle('Collapse all'));
      expect(screen.queryByTestId('tree-leaf-user.name')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTitle('Expand all'));
      expect(screen.getByTestId('tree-leaf-user.name')).toBeInTheDocument();
    });

    it('toggles individual parent node expand/collapse', () => {
      renderModal();
      const collapseButtons = screen.getAllByLabelText('Collapse');
      expect(collapseButtons.length).toBeGreaterThan(0);
      fireEvent.click(collapseButtons[0]);
      const expandButtons = screen.getAllByLabelText('Expand');
      expect(expandButtons.length).toBeGreaterThan(0);
      fireEvent.click(expandButtons[0]);
    });

    it('shows child count on collapsed parent nodes', () => {
      renderModal();
      fireEvent.click(screen.getByTitle('Collapse all'));
      const countBadges = document.querySelectorAll('.dm-node-count');
      expect(countBadges.length).toBeGreaterThan(0);
    });
  });

  describe('paste mode (with tree visible)', () => {
    it('opens paste mode with Edit JSON button when tree exists', () => {
      renderModal();
      const editBtn = screen.getByTitle('Edit JSON');
      fireEvent.click(editBtn);
      expect(screen.getByTestId('paste-json')).toBeInTheDocument();
    });

    it('populates paste textarea with pretty-printed existing JSON', () => {
      renderModal();
      fireEvent.click(screen.getByTitle('Edit JSON'));
      const textarea = screen.getByTestId('paste-json') as HTMLTextAreaElement;
      expect(textarea.value).toContain('"status"');
      expect(textarea.value).toContain('\n');
    });

    it('shows error when applying empty paste text', () => {
      renderModal();
      fireEvent.click(screen.getByTitle('Edit JSON'));
      const textarea = screen.getByTestId('paste-json');
      fireEvent.change(textarea, { target: { value: '' } });
      fireEvent.click(screen.getByText('Apply'));
      expect(screen.getByText('Paste some JSON')).toBeInTheDocument();
    });

    it('shows error when applying invalid JSON in paste mode', () => {
      renderModal();
      fireEvent.click(screen.getByTitle('Edit JSON'));
      const textarea = screen.getByTestId('paste-json');
      fireEvent.change(textarea, { target: { value: '{bad json' } });
      fireEvent.click(screen.getByText('Apply'));
      expect(screen.getByText(/Expected/i)).toBeInTheDocument();
    });

    it('applies valid JSON from paste mode', () => {
      renderModal();
      fireEvent.click(screen.getByTitle('Edit JSON'));
      const textarea = screen.getByTestId('paste-json');
      fireEvent.change(textarea, { target: { value: '{"newField":"hello"}' } });
      fireEvent.click(screen.getByText('Apply'));
      expect(screen.queryByTestId('paste-json')).not.toBeInTheDocument();
      expect(screen.getByText('newField')).toBeInTheDocument();
    });

    it('cancels paste mode without changes', () => {
      renderModal();
      fireEvent.click(screen.getByTitle('Edit JSON'));
      expect(screen.getByTestId('paste-json')).toBeInTheDocument();
      const pasteActions = document.querySelector('.dm-paste-actions');
      const cancelBtn = within(pasteActions as HTMLElement).getByText('Cancel');
      fireEvent.click(cancelBtn);
      expect(screen.queryByTestId('paste-json')).not.toBeInTheDocument();
      expect(screen.getByText('status')).toBeInTheDocument();
    });
  });

  describe('search clear', () => {
    it('clears search when × is clicked', () => {
      renderModal();
      const search = screen.getByTestId('tree-search');
      fireEvent.change(search, { target: { value: 'name' } });
      expect(screen.queryByTestId('tree-leaf-status')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('×'));
      expect(screen.getByTestId('tree-leaf-status')).toBeInTheDocument();
    });
  });

  describe('pattern library All category', () => {
    it('resets to All patterns when All is clicked after category filter', () => {
      renderModal();
      fireEvent.click(screen.getByText('Pattern Library'));
      fireEvent.click(screen.getByText('Numbers'));
      expect(screen.queryByText('UUID v4')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('All'));
      expect(screen.getByText('UUID v4')).toBeInTheDocument();
    });
  });

  describe('preview details', () => {
    it('shows match details with matched text', () => {
      renderModal({ initialJsonPath: '$.status', initialPattern: 'act' });
      const preview = screen.getByTestId('match-preview');
      expect(within(preview).getByText('MATCH')).toBeInTheDocument();
      expect(within(preview).getByText(/act/)).toBeInTheDocument();
    });

    it('shows no-match explanation', () => {
      renderModal({ initialJsonPath: '$.status', initialPattern: '^zzz$' });
      expect(screen.getByText(/does not match the resolved value/)).toBeInTheDocument();
    });

    it('shows regex error text for invalid regex', () => {
      renderModal({ initialJsonPath: '$.status', initialPattern: '[invalid(' });
      expect(screen.getByText('INVALID REGEX')).toBeInTheDocument();
    });

    it('truncates resolved value longer than 200 chars', () => {
      const longJson = JSON.stringify({ longField: 'x'.repeat(250) });
      renderModal({ sampleJson: longJson, initialJsonPath: '$.longField', initialPattern: 'x' });
      const resolved = screen.getByText(/Value:/);
      const code = resolved.parentElement?.querySelector('code');
      expect(code?.textContent).toContain('...');
    });
  });

  describe('fetch actions', () => {
    it('calls onFetchSampleResponse when fetch button is clicked', () => {
      const fetchFn = vi.fn();
      renderModal({ onFetchSampleResponse: fetchFn });
      fireEvent.click(screen.getByTitle('Fetch Response'));
      expect(fetchFn).toHaveBeenCalled();
    });

    it('disables fetch button while fetchingResponse is true', () => {
      const fetchFn = vi.fn();
      renderModal({ onFetchSampleResponse: fetchFn, fetchingResponse: true });
      const btn = screen.getByTitle('Fetching...');
      expect(btn).toBeDisabled();
    });
  });
});
