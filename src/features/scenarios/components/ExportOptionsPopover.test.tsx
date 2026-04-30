/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportOptionsPopover from './ExportOptionsPopover';

vi.mock('../utils/scenarioImportExport', () => ({
  DEFAULT_VERSION_EXPORT: { includeResponseVersions: true, includeRulesVersions: true },
  countVersions: vi.fn(),
  hasVersionData: vi.fn(),
}));

import { countVersions, hasVersionData } from '../utils/scenarioImportExport';
const mockCountVersions = vi.mocked(countVersions);
const mockHasVersionData = vi.mocked(hasVersionData);

describe('ExportOptionsPopover', () => {
  it('calls onExport immediately when no versions exist', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 0, rulesVersionCount: 0 });
    mockHasVersionData.mockReturnValue(false);
    const onExport = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<ExportOptionsPopover data={{}} onExport={onExport} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
    expect(onExport).toHaveBeenCalledWith({ includeResponseVersions: true, includeRulesVersions: true });
  });

  it('renders popover with version counts when versions exist', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 3, rulesVersionCount: 2 });
    mockHasVersionData.mockReturnValue(true);
    const onExport = vi.fn();
    const onClose = vi.fn();
    render(<ExportOptionsPopover data={{}} onExport={onExport} onClose={onClose} />);
    expect(screen.getByText('Export Options')).toBeTruthy();
    expect(screen.getByText('(3)')).toBeTruthy();
    expect(screen.getByText('(2)')).toBeTruthy();
  });

  it('calls onExport with options when Export button clicked', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 1, rulesVersionCount: 1 });
    mockHasVersionData.mockReturnValue(true);
    const onExport = vi.fn();
    render(<ExportOptionsPopover data={{}} onExport={onExport} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Export'));
    expect(onExport).toHaveBeenCalledWith({ includeResponseVersions: true, includeRulesVersions: true });
  });

  it('unchecking response versions updates options', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 1, rulesVersionCount: 1 });
    mockHasVersionData.mockReturnValue(true);
    const onExport = vi.fn();
    render(<ExportOptionsPopover data={{}} onExport={onExport} onClose={() => {}} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // uncheck response versions
    fireEvent.click(screen.getByText('Export'));
    expect(onExport).toHaveBeenCalledWith({ includeResponseVersions: false, includeRulesVersions: true });
  });

  it('calls onClose when Cancel clicked', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 1, rulesVersionCount: 0 });
    mockHasVersionData.mockReturnValue(true);
    const onClose = vi.fn();
    render(<ExportOptionsPopover data={{}} onExport={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 1, rulesVersionCount: 0 });
    mockHasVersionData.mockReturnValue(true);
    const onClose = vi.fn();
    render(<ExportOptionsPopover data={{}} onExport={() => {}} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
