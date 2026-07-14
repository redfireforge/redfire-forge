/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataSourceToolbar from './DataSourceToolbar';
import type { DataSource, SharedDataSource } from '../../../shared/types';
import { createRef } from 'react';

function createMockDataSource(rowCount = 3): DataSource {
  return {
    id: 'ds-1',
    columns: [
      { id: 'c1', name: 'col1', type: 'path', mapping: 'id' },
      { id: 'c2', name: 'col2', type: 'param', mapping: 'name' },
    ],
    rows: Array.from({ length: rowCount }, (_, i) => ({
      id: `r${i}`,
      values: { c1: `val${i}a`, c2: `val${i}b` },
      enabled: i < 2,
    })),
    source: { type: 'inline' },
    distribution: 'sequential',
    validationMode: 'selective',
  };
}

function createMockSharedDs(id: string, name: string): SharedDataSource {
  return {
    id,
    name,
    dataSource: createMockDataSource(5),
    updatedAt: Date.now(),
  };
}

describe('DataSourceToolbar', () => {
  const mockHandlers = {
    setShowDetachDropdown: vi.fn(),
    setShowColumnOrder: vi.fn(),
    setShowContract: vi.fn(),
    onDetachWithCopy: vi.fn(),
    onDetachUnlinkOnly: vi.fn(),
    onLinkSharedDs: vi.fn(),
    onAddRow: vi.fn(),
    onAddSampleRow: vi.fn(),
    onAddColumn: vi.fn(),
    onShowPopulateModal: vi.fn(),
    onShowVerifyModal: vi.fn(),
    onRefetchAllRows: vi.fn(),
    onDistributionChange: vi.fn(),
    onValidationModeChange: vi.fn(),
    onShowSetupModal: vi.fn(),
    onShowPromoteModal: vi.fn(),
    onDeleteAllRows: vi.fn(),
    onRemoveTable: vi.fn(),
    onColumnOrderApply: vi.fn(),
    onOpenSharedDsModal: vi.fn(),
    onPromoteToShared: vi.fn(),
  };

  const defaultProps = {
    dt: createMockDataSource(),
    linkedSharedDs: null,
    availableSharedDs: [],
    enabledCount: 2,
    refetchingAll: false,
    showDetachDropdown: false,
    showColumnOrder: false,
    showContract: false,
    detachDropdownRef: createRef<HTMLDivElement>(),
    ...mockHandlers,
  };

  beforeEach(() => {
    resetAllMocks();
  });

  describe('basic rendering', () => {
    it('renders DATA SOURCE label', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      expect(screen.getByText('DATA SOURCE')).toBeInTheDocument();
    });

    it('shows enabled row count', () => {
      render(<DataSourceToolbar {...defaultProps} enabledCount={2} />);
      expect(screen.getByText(/2 of 3 rows enabled/)).toBeInTheDocument();
    });

    it('shows badge with enabled count when greater than 0', () => {
      render(<DataSourceToolbar {...defaultProps} enabledCount={2} />);
      expect(screen.getByText('2', { selector: '.data-source-toolbar-badge' })).toBeInTheDocument();
    });
  });

  describe('row/column actions', () => {
    it('calls onAddRow when clicking + Row button', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      fireEvent.click(screen.getByText('+ Row'));
      expect(mockHandlers.onAddRow).toHaveBeenCalledTimes(1);
    });

    it('calls onAddSampleRow when clicking + Sample Row button', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      fireEvent.click(screen.getByText('+ Sample Row'));
      expect(mockHandlers.onAddSampleRow).toHaveBeenCalledTimes(1);
    });

    it('calls onAddColumn when clicking + Column button', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      fireEvent.click(screen.getByText('+ Column'));
      expect(mockHandlers.onAddColumn).toHaveBeenCalledTimes(1);
    });

    it('calls onShowPopulateModal when clicking From API button', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      fireEvent.click(screen.getByText('⬇ From API'));
      expect(mockHandlers.onShowPopulateModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('verify and refetch', () => {
    it('calls onShowVerifyModal when clicking Verify All', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      fireEvent.click(screen.getByText('▶ Verify All'));
      expect(mockHandlers.onShowVerifyModal).toHaveBeenCalledTimes(1);
    });

    it('calls onRefetchAllRows when clicking Re-fetch', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      fireEvent.click(screen.getByText('↻ Re-fetch'));
      expect(mockHandlers.onRefetchAllRows).toHaveBeenCalledTimes(1);
    });

    it('shows loading state when refetching', () => {
      render(<DataSourceToolbar {...defaultProps} refetchingAll={true} />);
      expect(screen.getByText('⏳ Fetching…')).toBeInTheDocument();
    });

    it('disables verify button when enabledCount is 0', () => {
      render(<DataSourceToolbar {...defaultProps} enabledCount={0} />);
      const verifyBtn = screen.getByText('▶ Verify All');
      expect(verifyBtn).toBeDisabled();
    });
  });

  describe('distribution and validation mode', () => {
    it('calls onDistributionChange when selecting distribution', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      const select = screen.getByRole('combobox', { name: /row distribution/i });
      fireEvent.change(select, { target: { value: 'random' } });
      expect(mockHandlers.onDistributionChange).toHaveBeenCalledWith('random');
    });

    it('calls onValidationModeChange when selecting validation mode', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      const selects = screen.getAllByRole('combobox');
      const validationSelect = selects.find(s => s.getAttribute('title')?.includes('Which rows to validate'));
      fireEvent.change(validationSelect!, { target: { value: 'full' } });
      expect(mockHandlers.onValidationModeChange).toHaveBeenCalledWith('full');
    });
  });

  describe('meta actions', () => {
    it('calls onShowSetupModal when clicking Configure', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      fireEvent.click(screen.getByText('⚙ Configure'));
      expect(mockHandlers.onShowSetupModal).toHaveBeenCalledTimes(1);
    });

    it('calls setShowContract when clicking Contract', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      fireEvent.click(screen.getByText('Contract'));
      expect(mockHandlers.setShowContract).toHaveBeenCalled();
    });

    it('calls onDeleteAllRows when clicking trash button', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Delete all rows'));
      expect(mockHandlers.onDeleteAllRows).toHaveBeenCalledTimes(1);
    });

    it('calls onRemoveTable when clicking remove button', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Remove entire data source'));
      expect(mockHandlers.onRemoveTable).toHaveBeenCalledTimes(1);
    });
  });

  describe('shared data source integration', () => {
    it('shows shared DS badge when linked', () => {
      const linkedDs = createMockSharedDs('shared-1', 'Shared Users');
      render(<DataSourceToolbar {...defaultProps} linkedSharedDs={linkedDs} />);
      expect(screen.getByText(/📋 Shared Users/)).toBeInTheDocument();
    });

    it('shows read-only message when linked to shared DS', () => {
      const linkedDs = createMockSharedDs('shared-1', 'Shared Users');
      render(<DataSourceToolbar {...defaultProps} linkedSharedDs={linkedDs} />);
      expect(screen.getByText(/read-only — linked to shared data source/)).toBeInTheDocument();
    });

    it('disables row/column buttons when linked to shared DS', () => {
      const linkedDs = createMockSharedDs('shared-1', 'Shared Users');
      render(<DataSourceToolbar {...defaultProps} linkedSharedDs={linkedDs} />);
      expect(screen.getByText('+ Row')).toBeDisabled();
      expect(screen.getByText('+ Sample Row')).toBeDisabled();
      expect(screen.getByText('+ Column')).toBeDisabled();
    });

    it('shows detach button when linked', () => {
      const linkedDs = createMockSharedDs('shared-1', 'Shared Users');
      render(<DataSourceToolbar {...defaultProps} linkedSharedDs={linkedDs} />);
      expect(screen.getByText(/✂ Detach/)).toBeInTheDocument();
    });

    it('shows detach dropdown when showDetachDropdown is true', () => {
      const linkedDs = createMockSharedDs('shared-1', 'Shared Users');
      render(<DataSourceToolbar {...defaultProps} linkedSharedDs={linkedDs} showDetachDropdown={true} />);
      expect(screen.getByText('Copy to Inline')).toBeInTheDocument();
      expect(screen.getByText('Unlink Only')).toBeInTheDocument();
    });

    it('calls onDetachWithCopy when clicking Copy to Inline', () => {
      const linkedDs = createMockSharedDs('shared-1', 'Shared Users');
      render(<DataSourceToolbar {...defaultProps} linkedSharedDs={linkedDs} showDetachDropdown={true} />);
      fireEvent.click(screen.getByText('Copy to Inline'));
      expect(mockHandlers.onDetachWithCopy).toHaveBeenCalledTimes(1);
    });

    it('calls onDetachUnlinkOnly when clicking Unlink Only', () => {
      const linkedDs = createMockSharedDs('shared-1', 'Shared Users');
      render(<DataSourceToolbar {...defaultProps} linkedSharedDs={linkedDs} showDetachDropdown={true} />);
      fireEvent.click(screen.getByText('Unlink Only'));
      expect(mockHandlers.onDetachUnlinkOnly).toHaveBeenCalledTimes(1);
    });

    it('shows Use Shared dropdown when available and not linked', () => {
      const availableDs = [createMockSharedDs('shared-1', 'Shared Users')];
      render(<DataSourceToolbar {...defaultProps} availableSharedDs={availableDs} />);
      expect(screen.getByText(/📋 Use Shared…/)).toBeInTheDocument();
    });

    it('calls onLinkSharedDs when selecting a shared DS', () => {
      const availableDs = [createMockSharedDs('shared-1', 'Shared Users')];
      render(<DataSourceToolbar {...defaultProps} availableSharedDs={availableDs} />);
      const select = screen.getByRole('combobox', { name: /link to a shared data source/i });
      fireEvent.change(select, { target: { value: 'shared-1' } });
      expect(mockHandlers.onLinkSharedDs).toHaveBeenCalledWith('shared-1');
    });

    it('shows Promote to Shared button when onPromoteToShared is provided and has rows', () => {
      render(<DataSourceToolbar {...defaultProps} onPromoteToShared={() => {}} />);
      expect(screen.getByText(/⬆ Promote to Shared/)).toBeInTheDocument();
    });

    it('calls onShowPromoteModal when clicking Promote to Shared', () => {
      render(<DataSourceToolbar {...defaultProps} onPromoteToShared={() => {}} />);
      fireEvent.click(screen.getByText(/⬆ Promote to Shared/));
      expect(mockHandlers.onShowPromoteModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('column order', () => {
    it('shows Column Order button when columns > 1', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      expect(screen.getByText('↕ Column Order')).toBeInTheDocument();
    });

    it('hides Column Order button when only 1 column', () => {
      const singleColDs = { ...createMockDataSource(), columns: [{ id: 'c1', name: 'col1', type: 'path' as const, mapping: 'id' }] };
      render(<DataSourceToolbar {...defaultProps} dt={singleColDs} />);
      expect(screen.queryByText('↕ Column Order')).not.toBeInTheDocument();
    });

    it('calls setShowColumnOrder when clicking Column Order', () => {
      render(<DataSourceToolbar {...defaultProps} />);
      fireEvent.click(screen.getByText('↕ Column Order'));
      expect(mockHandlers.setShowColumnOrder).toHaveBeenCalled();
    });
  });
});
