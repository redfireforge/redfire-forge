/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RulesVersionPanel from './RulesVersionPanel';
import type { RulesVersion, ValidationConfig } from '../../../shared/types';

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
  });
});
