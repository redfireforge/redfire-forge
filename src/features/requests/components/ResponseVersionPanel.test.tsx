/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ResponseVersionPanel from './ResponseVersionPanel';
import { ResponseVersion, ValidationConfig } from '@shared/types';
import { selectOptionByIndex } from '../../../test-utils/customSelectHelper';

const diffKitCtl = vi.hoisted(() => ({
  throwOnSecondDiffInRender: false,
  diffCallInRender: 0,
}));

vi.mock('json-diff-kit', () => ({
  Differ: class {
    diff(left: unknown, right: unknown) {
      if (diffKitCtl.throwOnSecondDiffInRender) {
        diffKitCtl.diffCallInRender += 1;
        if (diffKitCtl.diffCallInRender === 2) throw new Error('rules-diff-fail');
      }
      const same = JSON.stringify(left) === JSON.stringify(right);
      return [[{ type: same ? 'equal' : 'modify', text: '' }]];
    }
  },
  Viewer: ({ diff }: { diff: unknown[][] }) => (
    <div data-testid="diff-viewer">
      type type modify modify {JSON.stringify(diff)}
    </div>
  ),
}));
vi.mock('json-diff-kit/dist/viewer.css', () => ({}));
vi.mock('json-diff-kit/dist/viewer-monokai.css', () => ({}));

function mkVersion(overrides: Partial<ResponseVersion> & { json: string }): ResponseVersion {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    validationMode: 'none',
    selectiveMode: 'include',
    expectedFields: [],
    excludedPaths: [],
    unorderedArrays: false,
    ...overrides,
  };
}

const baseValidation: ValidationConfig = {
  mode: 'none',
  selectiveMode: 'include',
  expectedFields: [],
  excludedPaths: [],
  unorderedArrays: false,
};

const defaultProps = () => ({
  versions: [] as ResponseVersion[],
  currentJson: '{"a":1}',
  currentValidation: { ...baseValidation },
  excludedPaths: [] as string[],
  onSaveVersion: vi.fn(),
  onRestore: vi.fn(),
  onDeleteVersion: vi.fn(),
  onRenameVersion: vi.fn(),
});

describe('ResponseVersionPanel', { timeout: 30_000 }, () => {

  beforeEach(() => {
    diffKitCtl.throwOnSecondDiffInRender = false;
    diffKitCtl.diffCallInRender = 0;
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    delete (Element.prototype as Element & { scrollIntoView?: typeof Element.prototype.scrollIntoView }).scrollIntoView;
    vi.restoreAllMocks();
  });

  describe('empty state', () => {
    it('shows empty message when no versions', () => {
      render(<ResponseVersionPanel {...defaultProps()} />);
      expect(screen.getByText(/No versions saved yet/)).toBeTruthy();
    });

    it('shows "Save as Version" button when currentJson is present', () => {
      render(<ResponseVersionPanel {...defaultProps()} />);
      expect(screen.getByText('Save as Version')).toBeTruthy();
    });

    it('does not show "Save as Version" when currentJson is empty', () => {
      render(<ResponseVersionPanel {...defaultProps()} currentJson="" />);
      expect(screen.queryByText('Save as Version')).toBeNull();
    });
  });

  describe('duplicate detection across ALL versions', () => {
    it('detects duplicate of latest version', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'baseline' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"a":1}'
        />,
      );
      expect(screen.getByText(/Identical to baseline/)).toBeTruthy();
    });

    it('detects duplicate of older version (not just latest)', () => {
      const v1 = mkVersion({ json: '{"old":true}', timestamp: 1000, label: 'old-version' });
      const v2 = mkVersion({ json: '{"new":true}', timestamp: 2000, label: 'latest' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"old":true}'
        />,
      );
      // Should detect duplicate of old-version, not just check latest
      expect(screen.getByText(/Identical to old-version/)).toBeTruthy();
    });

    it('does not show duplicate hint when JSON differs from all versions', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'v1' });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000, label: 'v2' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      expect(screen.queryByText(/Identical to/)).toBeNull();
    });

    it('considers validation rules when checking duplicates', () => {
      const v1 = mkVersion({
        json: '{"a":1}', timestamp: 1000, label: 'with-rules',
        expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
        validationMode: 'selective',
      });
      // Same JSON but different rules → not a duplicate
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"a":1}'
          currentValidation={{ ...baseValidation, mode: 'none' }}
        />,
      );
      expect(screen.queryByText(/Identical to/)).toBeNull();
    });

    it('detects duplicate when JSON key order differs (canonical compare)', () => {
      const v1 = mkVersion({ json: '{"b":2,"a":1}', timestamp: 1000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"a":1,"b":2}'
        />,
      );
      expect(screen.getByText(/Identical to/)).toBeTruthy();
    });
  });

  describe('save click with duplicate confirmation', () => {
    it('calls onSaveVersion directly when no duplicate', () => {
      const onSave = vi.fn();
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"different":true}'
          onSaveVersion={onSave}
        />,
      );
      fireEvent.click(screen.getByText('Save as Version'));
      expect(onSave).toHaveBeenCalledOnce();
    });

    it('shows confirmation instead of saving when duplicate detected', () => {
      const onSave = vi.fn();
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'baseline' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"a":1}'
          onSaveVersion={onSave}
        />,
      );
      fireEvent.click(screen.getByText('Save as Version'));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByText('Save Anyway')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('"Save Anyway" triggers onSaveVersion and hides confirmation', () => {
      const onSave = vi.fn();
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'baseline' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"a":1}'
          onSaveVersion={onSave}
        />,
      );
      fireEvent.click(screen.getByText('Save as Version'));
      fireEvent.click(screen.getByText('Save Anyway'));
      expect(onSave).toHaveBeenCalledOnce();
      expect(screen.queryByText('Save Anyway')).toBeNull();
    });

    it('"Cancel" hides confirmation without saving', () => {
      const onSave = vi.fn();
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"a":1}'
          onSaveVersion={onSave}
        />,
      );
      fireEvent.click(screen.getByText('Save as Version'));
      fireEvent.click(screen.getByText('Cancel'));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.queryByText('Save Anyway')).toBeNull();
    });
  });

  describe('version list rendering', () => {
    it('shows version count in header', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      expect(screen.getByText('Response Versions (2)')).toBeTruthy();
    });

    it('shows Compare button when 2+ versions exist', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      expect(screen.getByText('Compare')).toBeTruthy();
    });

    it('shows "current" tag for version matching current JSON', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"a":1}'
        />,
      );
      expect(screen.getByText('current')).toBeTruthy();
    });

    it('shows Restore button for non-current versions', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"a":1}'
        />,
      );
      expect(screen.getByText('Restore')).toBeTruthy();
    });

    it('calls onRestore when Restore clicked', () => {
      const onRestore = vi.fn();
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"a":1}'
          onRestore={onRestore}
        />,
      );
      fireEvent.click(screen.getByText('Restore'));
      expect(onRestore).toHaveBeenCalledWith(v2);
    });

    it('calls onDeleteVersion when Delete clicked', () => {
      const onDelete = vi.fn();
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"a":1}'
          onDeleteVersion={onDelete}
        />,
      );
      fireEvent.click(screen.getByText('Delete'));
      expect(onDelete).toHaveBeenCalledWith(v1.id);
    });

    it('shows validation rules tag when version has rules', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, validationMode: 'selective', selectiveMode: 'include' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"b":2}'
        />,
      );
      expect(screen.getByText(/Selective · Include/)).toBeTruthy();
    });

    it('allows renaming a version by clicking label', () => {
      const onRename = vi.fn();
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'my-version' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"b":2}'
          onRenameVersion={onRename}
        />,
      );
      fireEvent.click(screen.getByText('my-version'));
      const input = screen.getByDisplayValue('my-version');
      fireEvent.change(input, { target: { value: 'renamed' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRename).toHaveBeenCalledWith(v1.id, 'renamed');
    });

    it('cancels rename on Escape', () => {
      const onRename = vi.fn();
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'my-version' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"b":2}'
          onRenameVersion={onRename}
        />,
      );
      fireEvent.click(screen.getByText('my-version'));
      const input = screen.getByDisplayValue('my-version');
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onRename).not.toHaveBeenCalled();
      expect(screen.getByText('my-version')).toBeTruthy();
    });
  });

  describe('compare modal', () => {
    it('opens compare modal with version selectors', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'first' });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000, label: 'second' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByText('Compare Versions')).toBeTruthy();
      expect(screen.getByText('Left')).toBeTruthy();
      expect(screen.getByText('Right')).toBeTruthy();
    });

    it('shows diff viewer when two versions selected', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'first' });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000, label: 'second' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByTestId('diff-viewer')).toBeTruthy();
    });

    it('shows "Changes detected" for different versions', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'first' });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000, label: 'second' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByText('Changes detected')).toBeTruthy();
    });

    it('shows "Same version selected" when comparing same version', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'first' });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000, label: 'second' });
      const { container } = render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      selectOptionByIndex(container, 0, 'second');
      selectOptionByIndex(container, 1, 'second');
      expect(screen.getByText('Same version selected')).toBeTruthy();
    });

    it('has Unordered Arrays toggle', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByText('Unordered Arrays')).toBeTruthy();
    });

    it('has Response and Validation Rules tabs', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      const tabs = document.querySelectorAll('.version-diff-tab');
      expect(tabs.length).toBe(2);
      expect(tabs[0].textContent).toContain('Response');
      expect(tabs[1].textContent).toContain('Validation Rules');
    });

    it('closes on overlay backdrop click', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByText('Compare Versions')).toBeTruthy();
      const overlay = document.querySelector('.version-diff-overlay') as HTMLElement;
      fireEvent.click(overlay);
      expect(screen.queryByText('Compare Versions')).toBeNull();
    });

    it('closes on Escape key', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByText('Compare Versions')).toBeTruthy();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByText('Compare Versions')).toBeNull();
    });

    it('switches to rules diff tab', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, validationMode: 'selective', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000, validationMode: 'none' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      fireEvent.click(screen.getByText(/Validation Rules/));
      expect(screen.getByTestId('diff-viewer')).toBeTruthy();
    });
  });

  describe('rename on blur', () => {
    it('saves rename on blur', () => {
      const onRename = vi.fn();
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'orig' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"b":2}'
          onRenameVersion={onRename}
        />,
      );
      fireEvent.click(screen.getByText('orig'));
      const input = screen.getByDisplayValue('orig');
      fireEvent.change(input, { target: { value: 'blurred' } });
      fireEvent.blur(input);
      expect(onRename).toHaveBeenCalledWith(v1.id, 'blurred');
    });
  });

  describe('unordered arrays toggle', () => {
    it('toggles unordered arrays checkbox', () => {
      const v1 = mkVersion({ json: '{"a":[1,2]}', timestamp: 1000 });
      const v2 = mkVersion({ json: '{"a":[2,1]}', timestamp: 2000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('overlay click close', () => {
    it('closes compare modal when overlay clicked', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      const v2 = mkVersion({ json: '{"b":2}', timestamp: 2000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentJson='{"c":3}'
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByText('Compare Versions')).toBeTruthy();
      const overlay = document.querySelector('.version-diff-overlay') as HTMLElement;
      fireEvent.click(overlay);
      expect(screen.queryByText('Compare Versions')).toBeNull();
    });
  });

  describe('excludedPaths stripping', () => {
    it('considers versions identical when only excluded paths differ', () => {
      const v1 = mkVersion({ json: '{"a":1,"timestamp":"2024-01-01"}', timestamp: 1000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"a":1,"timestamp":"2025-01-01"}'
          excludedPaths={['$.timestamp']}
        />,
      );
      expect(screen.getByText(/Identical to/)).toBeTruthy();
    });

    it('strips nested excluded paths and ignores empty path segments', () => {
      const v1 = mkVersion({ json: '{"a":{"b":9,"keep":2}}', timestamp: 1000, label: 'nested-strip' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"a":{"b":1,"keep":2}}'
          excludedPaths={['$.', '$.a.b']}
        />,
      );
      expect(screen.getByText(/Identical to nested-strip/)).toBeTruthy();
    });

    it('handles excluded path through array index', () => {
      const v1 = mkVersion({ json: '{"items":[{"id":1,"noise":9}]}', timestamp: 1000, label: 'arr-path' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"items":[{"id":1,"noise":0}]}'
          excludedPaths={['$.items.0.noise']}
        />,
      );
      expect(screen.getByText(/Identical to arr-path/)).toBeTruthy();
    });
  });

  describe('branch coverage: duplicate canonicalization', () => {
    it('uses trimmed raw string when current JSON is not parseable', () => {
      const v1 = mkVersion({ json: 'raw-token', timestamp: 1000, label: 'raw-catch' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson="  raw-token  "
        />,
      );
      expect(screen.getByText(/Identical to raw-catch/)).toBeTruthy();
    });

    it('uses raw version json when stored version JSON is not parseable', () => {
      const v1 = mkVersion({ json: 'not-parseable', timestamp: 1000, label: 'raw' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson="not-parseable"
        />,
      );
      expect(screen.getByText(/Identical to raw/)).toBeTruthy();
    });
  });

  describe('branch coverage: version list UI', () => {
    it('falls back to vN when label is missing', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"b":2}'
        />,
      );
      expect(screen.getByText('v1')).toBeTruthy();
    });

    it('omits selective suffix in rules tag when selectiveMode is empty', () => {
      const v1 = mkVersion({
        json: '{"a":1}',
        timestamp: 1000,
        validationMode: 'selective',
        selectiveMode: '' as 'include',
      });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"b":2}'
        />,
      );
      const tag = screen.getByText('Selective');
      expect(tag.textContent).toBe('Selective');
    });
  });

  describe('collapse toggle', () => {
    it('collapses version list and shows summary', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000, label: 'snapshot-1' });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"b":2}'
        />,
      );
      expect(document.querySelector('.version-list')).toBeTruthy();
      expect(document.querySelector('.version-collapsed-summary')).toBeNull();
      const toggle = screen.getByTitle('Collapse');
      fireEvent.click(toggle);
      expect(document.querySelector('.version-list')).toBeNull();
      expect(screen.getByText(/snapshot-1/)).toBeTruthy();
    });

    it('expands version list on second toggle click', () => {
      const v1 = mkVersion({ json: '{"a":1}', timestamp: 1000 });
      render(
        <ResponseVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentJson='{"a":1}'
        />,
      );
      const toggle = screen.getByTitle('Collapse');
      fireEvent.click(toggle);
      expect(document.querySelector('.version-list')).toBeNull();
      fireEvent.click(screen.getByTitle('Expand'));
      expect(document.querySelector('.version-list')).toBeTruthy();
    });
  });

});
