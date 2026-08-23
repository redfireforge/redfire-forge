/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RulesVersionPanel from './RulesVersionPanel';
import type { Assertion, RulesVersion, ValidationConfig } from '@shared/types';
import { stubScrollIntoView } from '../../../test-utils/domMocks';

const mocks = vi.hoisted(() => ({
  differDiff: vi.fn(),
  viewerChunks: [] as string[],
}));

vi.mock('json-diff-kit', () => ({
  Differ: class {
    diff() {
      return mocks.differDiff();
    }
  },
  Viewer: () => (
    <div data-testid="json-diff-viewer">
      {mocks.viewerChunks.map((chunk, i) => (
        <span key={i}>{chunk}</span>
      ))}
    </div>
  ),
}));

function mkRulesVersion(overrides: Partial<RulesVersion> = {}): RulesVersion {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    validationMode: 'selective',
    selectiveMode: 'include',
    expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
    excludedPaths: [],
    unorderedArrays: false,
    ...overrides,
  };
}

const baseValidation: ValidationConfig = {
  mode: 'selective',
  selectiveMode: 'include',
  expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
  excludedPaths: [],
  unorderedArrays: false,
};

const defaultProps = () => ({
  versions: [] as RulesVersion[],
  currentValidation: { ...baseValidation },
  onSaveVersion: vi.fn(),
  onRestore: vi.fn(),
  onDeleteVersion: vi.fn(),
  onRenameVersion: vi.fn(),
});

describe('RulesVersionPanel', () => {

  beforeEach(() => {
    mocks.differDiff.mockReturnValue([[{ type: 'modify' as const, content: '' }]]);
    mocks.viewerChunks = [];
    stubScrollIntoView();
  });

  describe('compare modal diff search and shortcuts', () => {
    it('highlights text, navigates matches, clears search on Escape, focuses input on Meta+F and Ctrl+F, closes via footer', async () => {
      mocks.viewerChunks = ['foo', 'foo'];
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      const { container } = render(<RulesVersionPanel {...defaultProps()} versions={[v1, v2]} />);
      fireEvent.click(screen.getByText('Compare'));
      const input = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(input, { target: { value: 'foo' } });
      await waitFor(() => expect(screen.getByText('1/2')).toBeInTheDocument());
      expect(container.querySelectorAll('.version-diff-search-hit, .version-diff-search-hit--active').length).toBeGreaterThan(0);

      fireEvent.click(screen.getByTitle('Next (Enter)'));
      await waitFor(() => expect(screen.getByText('2/2')).toBeInTheDocument());

      fireEvent.click(screen.getByTitle('Previous (Shift+Enter)'));
      await waitFor(() => expect(screen.getByText('1/2')).toBeInTheDocument());

      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
      await waitFor(() => expect(screen.getByText('2/2')).toBeInTheDocument());
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      await waitFor(() => expect(screen.getByText('1/2')).toBeInTheDocument());

      fireEvent.change(input, { target: { value: '' } });
      await waitFor(() => expect(screen.queryByText(/No match/)).toBeNull());
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

      fireEvent.change(input, { target: { value: 'foo' } });
      await waitFor(() => expect(screen.getByText('1/2')).toBeInTheDocument());
      input.blur();
      fireEvent.keyDown(window, { key: 'f', metaKey: true });
      expect(document.activeElement).toBe(input);
      input.blur();
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
      expect(document.activeElement).toBe(input);

      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input).toHaveValue('');

      const closeBtn = container.querySelector('.version-diff-footer .btn-sm') as HTMLButtonElement;
      fireEvent.click(closeBtn);
      expect(screen.queryByText('Compare Rules Versions')).toBeNull();
    });

    it('Enter/shift+Enter no-ops when there are zero matches', async () => {
      mocks.viewerChunks = ['zzz'];
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(<RulesVersionPanel {...defaultProps()} versions={[v1, v2]} />);
      fireEvent.click(screen.getByText('Compare'));
      const input = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(input, { target: { value: 'nomatch' } });
      await waitFor(() => expect(screen.getByText('No match')).toBeInTheDocument());
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    });
  });

  describe('assertions and fingerprint branches', () => {
    it('treats assertions-only current validation as having rules and detects duplicate via assertion fingerprint', () => {
      const assertions: Assertion[] = [
        { type: 'regex', jsonPath: '$.id', pattern: '[0-9]+' },
        { type: 'status', expected: '200' },
      ];
      const v1 = mkRulesVersion({
        timestamp: 1000,
        label: 'assert-snap',
        expectedFields: [],
        assertions: [{ type: 'status', expected: '200' }, { type: 'regex', jsonPath: '$.id', pattern: '[0-9]+' }],
      });
      const sparse: ValidationConfig = {
        mode: 'selective',
        selectiveMode: 'include',
        assertions,
      };
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentValidation={sparse}
        />,
      );
      expect(screen.getByText(/Identical to assert-snap/)).toBeTruthy();
    });

    it('shows Save Rules Version in empty state when only assertions exist', () => {
      render(
        <RulesVersionPanel
          {...defaultProps()}
          currentValidation={{
            mode: 'selective',
            selectiveMode: 'include',
            expectedFields: [],
            assertions: [{ type: 'status', expected: '200' }],
          }}
        />,
      );
      expect(screen.getByText('Save Rules Version')).toBeTruthy();
    });
  });

  describe('preview and version list edge cases', () => {
    it('does not render preview modal when preview id no longer exists in versions', () => {
      const v1 = mkRulesVersion({
        timestamp: 1000,
        label: 'gone',
        expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
      });
      const v2 = mkRulesVersion({
        timestamp: 2000,
        label: 'kept',
        expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }],
      });
      const props = defaultProps();
      const { rerender } = render(
        <RulesVersionPanel
          {...props}
          versions={[v1, v2]}
          currentValidation={{ ...baseValidation, expectedFields: [{ jsonPath: '$.c', expectedValue: '3' }] }}
        />,
      );
      const goneRow = screen.getByText('gone').closest('.version-item') as HTMLElement;
      fireEvent.click(within(goneRow).getByRole('button', { name: 'Preview' }));
      expect(document.querySelector('.vp-overlay')).toBeTruthy();
      rerender(
        <RulesVersionPanel
          {...props}
          versions={[v2]}
          currentValidation={{ ...baseValidation, expectedFields: [{ jsonPath: '$.c', expectedValue: '3' }] }}
        />,
      );
      expect(document.querySelector('.vp-overlay')).toBeNull();
    });

    it('lists version when expectedFields is omitted on snapshot', () => {
      const v1 = {
        id: crypto.randomUUID(),
        timestamp: 1000,
        label: '',
        validationMode: 'none' as const,
        selectiveMode: undefined,
        excludedPaths: [] as string[],
        unorderedArrays: false,
        assertions: [] as Assertion[],
      } as unknown as RulesVersion;
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentValidation={{ ...baseValidation, expectedFields: [{ jsonPath: '$.x', expectedValue: '9' }] }}
        />,
      );
      const tag = screen.getByText('empty');
      expect(tag.classList.contains('version-rules-tag')).toBe(true);
    });
  });
});
