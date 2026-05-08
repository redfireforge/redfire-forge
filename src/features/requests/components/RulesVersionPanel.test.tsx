/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RulesVersionPanel from './RulesVersionPanel';
import type { RulesVersion, ValidationConfig } from '../../../shared/types';

const mocks = vi.hoisted(() => ({
  differDiff: vi.fn(),
}));

vi.mock('json-diff-kit', () => ({
  Differ: class {
    diff() {
      return mocks.differDiff();
    }
  },
  Viewer: () => <div data-testid="json-diff-viewer" />,
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
  });

  describe('visibility', () => {
    it('does not render when no rules and no versions', () => {
      const { container } = render(
        <RulesVersionPanel
          {...defaultProps()}
          currentValidation={{ mode: 'none', expectedFields: [] }}
        />,
      );
      expect(container.querySelector('.rules-version-panel')).toBeNull();
    });

    it('renders when rules exist but no versions saved', () => {
      render(<RulesVersionPanel {...defaultProps()} />);
      expect(screen.getByText(/No rules versions saved yet/)).toBeTruthy();
      expect(screen.getByText('Save Rules Version')).toBeTruthy();
    });

    it('renders when versions exist even if no current rules', () => {
      const v1 = mkRulesVersion({ timestamp: 1000 });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentValidation={{ mode: 'none', expectedFields: [] }}
        />,
      );
      expect(screen.getByText('Rules Versions (1)')).toBeTruthy();
    });
  });

  describe('duplicate detection across ALL versions', () => {
    it('detects duplicate of latest version', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, label: 'baseline' });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
        />,
      );
      expect(screen.getByText(/Identical to baseline/)).toBeTruthy();
    });

    it('detects duplicate of older version (not just latest)', () => {
      const v1 = mkRulesVersion({
        timestamp: 1000,
        label: 'old-rules',
        expectedFields: [{ jsonPath: '$.x', expectedValue: '10' }],
      });
      const v2 = mkRulesVersion({
        timestamp: 2000,
        label: 'new-rules',
        expectedFields: [{ jsonPath: '$.y', expectedValue: '20' }],
      });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentValidation={{
            ...baseValidation,
            expectedFields: [{ jsonPath: '$.x', expectedValue: '10' }],
          }}
        />,
      );
      expect(screen.getByText(/Identical to old-rules/)).toBeTruthy();
    });

    it('does not show duplicate when rules differ from all versions', () => {
      const v1 = mkRulesVersion({
        timestamp: 1000,
        expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
      });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentValidation={{
            ...baseValidation,
            expectedFields: [{ jsonPath: '$.z', expectedValue: '99' }],
          }}
        />,
      );
      expect(screen.queryByText(/Identical to/)).toBeNull();
    });

    it('considers mode/selectiveMode when checking duplicates', () => {
      const v1 = mkRulesVersion({
        timestamp: 1000,
        label: 'with-exclude',
        validationMode: 'selective',
        selectiveMode: 'exclude',
      });
      // Same fields but different selectiveMode
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentValidation={{ ...baseValidation, selectiveMode: 'include' }}
        />,
      );
      expect(screen.queryByText(/Identical to/)).toBeNull();
    });
  });

  describe('save click with duplicate confirmation', () => {
    it('calls onSaveVersion directly when no duplicate', () => {
      const onSave = vi.fn();
      const v1 = mkRulesVersion({
        timestamp: 1000,
        expectedFields: [{ jsonPath: '$.other', expectedValue: 'val' }],
      });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          onSaveVersion={onSave}
        />,
      );
      fireEvent.click(screen.getByText('Save Rules Version'));
      expect(onSave).toHaveBeenCalledOnce();
    });

    it('shows confirmation instead of saving when duplicate detected', () => {
      const onSave = vi.fn();
      const v1 = mkRulesVersion({ timestamp: 1000, label: 'baseline' });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          onSaveVersion={onSave}
        />,
      );
      fireEvent.click(screen.getByText('Save Rules Version'));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByText('Save Anyway')).toBeTruthy();
    });

    it('"Save Anyway" triggers onSaveVersion and hides confirmation', () => {
      const onSave = vi.fn();
      const v1 = mkRulesVersion({ timestamp: 1000 });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          onSaveVersion={onSave}
        />,
      );
      fireEvent.click(screen.getByText('Save Rules Version'));
      fireEvent.click(screen.getByText('Save Anyway'));
      expect(onSave).toHaveBeenCalledOnce();
      expect(screen.queryByText('Save Anyway')).toBeNull();
    });

    it('"Cancel" hides confirmation without saving', () => {
      const onSave = vi.fn();
      const v1 = mkRulesVersion({ timestamp: 1000 });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          onSaveVersion={onSave}
        />,
      );
      fireEvent.click(screen.getByText('Save Rules Version'));
      fireEvent.click(screen.getByText('Cancel'));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.queryByText('Save Anyway')).toBeNull();
    });
  });

  describe('restore and delete', () => {
    it('calls onRestore when Restore button is clicked', () => {
      const onRestore = vi.fn();
      const v1 = mkRulesVersion({
        timestamp: 1000,
        expectedFields: [{ jsonPath: '$.different', expectedValue: 'val' }],
      });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          onRestore={onRestore}
        />,
      );
      fireEvent.click(screen.getByText('Restore'));
      expect(onRestore).toHaveBeenCalledWith(v1);
    });

    it('does not show Restore for current version', () => {
      const v1 = mkRulesVersion({ timestamp: 1000 });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
        />,
      );
      // v1 matches currentValidation → is current → no Restore
      expect(screen.queryByText('Restore')).toBeNull();
    });

    it('calls onDeleteVersion when Delete is clicked', () => {
      const onDelete = vi.fn();
      const v1 = mkRulesVersion({ timestamp: 1000 });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          onDeleteVersion={onDelete}
        />,
      );
      fireEvent.click(screen.getByText('Delete'));
      expect(onDelete).toHaveBeenCalledWith(v1.id);
    });
  });

  describe('version list rendering', () => {
    it('shows version count in header', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
        />,
      );
      expect(screen.getByText('Rules Versions (2)')).toBeTruthy();
    });

    it('shows rules description with rule count', () => {
      const v1 = mkRulesVersion({
        timestamp: 1000,
        expectedFields: [{ jsonPath: '$.x', expectedValue: '1' }, { jsonPath: '$.y', expectedValue: '2' }],
        validationMode: 'selective',
        selectiveMode: 'include',
      });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentValidation={{ ...baseValidation, expectedFields: [{ jsonPath: '$.z', expectedValue: '3' }] }}
        />,
      );
      expect(screen.getByText(/2 rules/)).toBeTruthy();
    });

    it('shows Compare button when 2+ versions exist', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
        />,
      );
      expect(screen.getByText('Compare')).toBeTruthy();
    });

    it('does not show Compare button when fewer than 2 versions', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.diff', expectedValue: 'x' }] });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentValidation={{ ...baseValidation, expectedFields: [{ jsonPath: '$.z', expectedValue: '3' }] }}
        />,
      );
      expect(screen.queryByText('Compare')).toBeNull();
    });
  });

  describe('compare modal', () => {
    it('opens compare modal with version selectors', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, label: 'first', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, label: 'second', expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByText('Compare Rules Versions')).toBeTruthy();
      // Both versions appear as options
      const options = screen.getAllByRole('option');
      const optionTexts = options.map(o => o.textContent);
      expect(optionTexts.some(t => t?.includes('first'))).toBe(true);
      expect(optionTexts.some(t => t?.includes('second'))).toBe(true);
    });

    it('closes modal on ✕ click', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByText('Compare Rules Versions')).toBeTruthy();
      fireEvent.click(screen.getByText('✕'));
      expect(screen.queryByText('Compare Rules Versions')).toBeNull();
    });

    it('shows identical banner when same version selected on both sides', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, label: 'first', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, label: 'second', expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
        />,
      );
      fireEvent.click(screen.getByText('Compare'));
      // Select same version on both sides
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: v1.id } });
      fireEvent.change(selects[1], { target: { value: v1.id } });
      expect(screen.getByText('Same version selected')).toBeTruthy();
    });

    it('closes compare modal on Escape', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(<RulesVersionPanel {...defaultProps()} versions={[v1, v2]} />);
      fireEvent.click(screen.getByText('Compare'));
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByText('Compare Rules Versions')).toBeNull();
    });

    it('closes compare modal when overlay backdrop is clicked', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      const { container } = render(<RulesVersionPanel {...defaultProps()} versions={[v1, v2]} />);
      fireEvent.click(screen.getByText('Compare'));
      const overlay = container.querySelector('.version-diff-overlay');
      expect(overlay).toBeTruthy();
      fireEvent.click(overlay!);
      expect(screen.queryByText('Compare Rules Versions')).toBeNull();
    });

    it('shows Changes detected when diff has non-equal segments', () => {
      mocks.differDiff.mockReturnValue([[{ type: 'modify' as const, content: 'x' }]]);
      const v1 = mkRulesVersion({ timestamp: 1000, label: 'a', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, label: 'b', expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(<RulesVersionPanel {...defaultProps()} versions={[v1, v2]} />);
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByText('Changes detected')).toBeTruthy();
      expect(screen.getByTestId('json-diff-viewer')).toBeTruthy();
    });

    it('shows Identical when diff segments are all equal', () => {
      mocks.differDiff.mockReturnValue([[{ type: 'equal' as const, content: 'x' }]]);
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(<RulesVersionPanel {...defaultProps()} versions={[v1, v2]} />);
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByText('✔ Identical')).toBeTruthy();
    });

    it('shows no differences when differ throws', () => {
      mocks.differDiff.mockImplementation(() => { throw new Error('diff fail'); });
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(<RulesVersionPanel {...defaultProps()} versions={[v1, v2]} />);
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByText('No differences found.')).toBeTruthy();
    });

    it('shows placeholder when compare sides not fully selected', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(<RulesVersionPanel {...defaultProps()} versions={[v1, v2]} />);
      fireEvent.click(screen.getByText('Compare'));
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: '' } });
      expect(screen.getByText('Select two versions above to compare.')).toBeTruthy();
    });
  });

  describe('rename label', () => {
    it('calls onRename on blur', () => {
      const onRename = vi.fn();
      const v1 = mkRulesVersion({ timestamp: 1000, label: 'L1', expectedFields: [{ jsonPath: '$.z', expectedValue: '9' }] });
      render(
        <RulesVersionPanel {...defaultProps()} versions={[v1]} currentValidation={{ ...baseValidation, expectedFields: [{ jsonPath: '$.z', expectedValue: '9' }] }} onRenameVersion={onRename} />,
      );
      fireEvent.click(screen.getByText('L1'));
      const input = screen.getByDisplayValue('L1');
      fireEvent.change(input, { target: { value: 'FromBlur' } });
      fireEvent.blur(input);
      expect(onRename).toHaveBeenCalledWith(v1.id, 'FromBlur');
    });

    it('calls onRename on Enter and not on Escape', () => {
      const onRename = vi.fn();
      const v1 = mkRulesVersion({ timestamp: 1000, label: 'L1', expectedFields: [{ jsonPath: '$.z', expectedValue: '9' }] });
      render(
        <RulesVersionPanel {...defaultProps()} versions={[v1]} currentValidation={{ ...baseValidation, expectedFields: [{ jsonPath: '$.z', expectedValue: '9' }] }} onRenameVersion={onRename} />,
      );
      fireEvent.click(screen.getByText('L1'));
      const input = screen.getByDisplayValue('L1');
      fireEvent.change(input, { target: { value: 'Renamed' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRename).toHaveBeenCalledWith(v1.id, 'Renamed');
      onRename.mockClear();
      fireEvent.click(screen.getByText('L1'));
      const input2 = screen.getByDisplayValue('L1');
      fireEvent.change(input2, { target: { value: 'Aborted' } });
      fireEvent.keyDown(input2, { key: 'Escape' });
      expect(onRename).not.toHaveBeenCalled();
    });

    it('starts editing with empty string when version label is unset', () => {
      const onRename = vi.fn();
      const v1 = mkRulesVersion({
        timestamp: 1000,
        label: '',
        expectedFields: [{ jsonPath: '$.z', expectedValue: '9' }],
      });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentValidation={{ ...baseValidation, expectedFields: [{ jsonPath: '$.z', expectedValue: '9' }] }}
          onRenameVersion={onRename}
        />,
      );
      fireEvent.click(screen.getByText('r1'));
      const input = screen.getByRole('textbox');
      expect(input).toHaveProperty('value', '');
    });
  });

  describe('rules description tag', () => {
    it('renders excluded paths, single rule wording, unordered flag', () => {
      const v1 = mkRulesVersion({
        timestamp: 1000,
        validationMode: 'full',
        selectiveMode: 'exclude',
        expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
        excludedPaths: ['$.x', '$.y'],
        unorderedArrays: true,
        label: '',
      });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentValidation={{ ...baseValidation, expectedFields: [{ jsonPath: '$.other', expectedValue: '1' }] }}
        />,
      );
      expect(screen.getByText(/full/)).toBeTruthy();
      expect(screen.getByText(/1 rule/)).toBeTruthy();
      expect(screen.getByText(/2 excluded/)).toBeTruthy();
      expect(screen.getByText(/unordered/)).toBeTruthy();
    });

    it('uses default rN label when version label is empty', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, label: '', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, label: '', expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1, v2]}
          currentValidation={{ ...baseValidation, expectedFields: [{ jsonPath: '$.z', expectedValue: '3' }] }}
        />,
      );
      expect(screen.getByText('r2')).toBeTruthy();
      expect(screen.getByText('r1')).toBeTruthy();
    });
  });

  describe('duplicate UI', () => {
    it('hides inline duplicate hint while confirmation bar is open', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, label: 'dup' });
      render(<RulesVersionPanel {...defaultProps()} versions={[v1]} />);
      fireEvent.click(screen.getByText('Save Rules Version'));
      expect(screen.getByText('Save Anyway')).toBeTruthy();
      expect(document.querySelector('.version-duplicate-hint')).toBeNull();
    });
  });

  describe('fingerprint fallbacks and sparse config', () => {
    it('uses default mode and selectiveMode when currentValidation omits them', () => {
      const v1 = mkRulesVersion({
        timestamp: 1000,
        validationMode: 'none',
        selectiveMode: 'include',
        expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
      });
      const sparse = {
        expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
      } as ValidationConfig;
      render(<RulesVersionPanel {...defaultProps()} versions={[v1]} currentValidation={sparse} />);
      expect(screen.getByText('current')).toBeTruthy();
    });

    it('treats runtime-undefined version rule fields like defaults when marking current', () => {
      const v1 = {
        id: crypto.randomUUID(),
        timestamp: 1000,
        label: 'shape',
        expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
        validationMode: undefined,
        selectiveMode: undefined,
        excludedPaths: undefined,
      } as unknown as RulesVersion;
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentValidation={{
            mode: 'none',
            selectiveMode: 'include',
            expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
            excludedPaths: [],
            unorderedArrays: false,
          }}
        />,
      );
      expect(screen.getByText('current')).toBeTruthy();
    });
  });

  describe('rulesDescription edge cases', () => {
    it('shows empty when version has no describable rule metadata', () => {
      const bare = {
        id: 'bare-id',
        timestamp: 1000,
        validationMode: 'none',
        expectedFields: [],
      } as RulesVersion;
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[bare]}
          currentValidation={{ mode: 'none', expectedFields: [] }}
        />,
      );
      const tag = screen.getByText('empty');
      expect(tag.classList.contains('version-rules-tag')).toBe(true);
    });

    it('omits selectiveMode from description when absent, but still shows excluded count', () => {
      const v1 = {
        id: 'id-1',
        timestamp: 1000,
        validationMode: 'full',
        expectedFields: [],
        excludedPaths: ['$.a'],
      } as RulesVersion;
      render(
        <RulesVersionPanel
          {...defaultProps()}
          versions={[v1]}
          currentValidation={{ mode: 'none', expectedFields: [] }}
        />,
      );
      expect(screen.getByText(/full · 1 excluded/)).toBeTruthy();
    });
  });

  describe('compare modal edge cases', () => {
    it('clears diff when selected version ids are missing after rerender', () => {
      mocks.differDiff.mockClear();
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      const props = defaultProps();
      const { rerender } = render(<RulesVersionPanel {...props} versions={[v1, v2]} />);
      fireEvent.click(screen.getByText('Compare'));
      expect(screen.getByTestId('json-diff-viewer')).toBeTruthy();
      const v3 = mkRulesVersion({
        timestamp: 3000,
        expectedFields: [{ jsonPath: '$.c', expectedValue: '3' }],
      });
      rerender(<RulesVersionPanel {...props} versions={[v3]} />);
      expect(screen.queryByTestId('json-diff-viewer')).toBeNull();
      expect(screen.getByText('No differences found.')).toBeTruthy();
      expect(document.querySelector('.version-diff-info-bar')).toBeNull();
    });

    it('evaluates || fallback on selectors when both sides are cleared', () => {
      const v1 = mkRulesVersion({ timestamp: 1000, expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] });
      const v2 = mkRulesVersion({ timestamp: 2000, expectedFields: [{ jsonPath: '$.b', expectedValue: '2' }] });
      render(<RulesVersionPanel {...defaultProps()} versions={[v1, v2]} />);
      fireEvent.click(screen.getByText('Compare'));
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: '' } });
      fireEvent.change(selects[1], { target: { value: '' } });
      expect(screen.getByText('Select two versions above to compare.')).toBeTruthy();
    });
  });
});
