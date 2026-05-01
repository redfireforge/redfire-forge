/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResponseVersionPanel from './ResponseVersionPanel';
import type { ResponseVersion, ValidationConfig } from '../../../shared/types';

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

describe('ResponseVersionPanel', () => {
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
  });
});
