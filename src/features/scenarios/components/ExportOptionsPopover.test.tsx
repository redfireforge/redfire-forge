/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportOptionsPopover from './ExportOptionsPopover';

vi.mock('../utils/scenarioImportExport', () => ({
  DEFAULT_VERSION_EXPORT: {
    includeResponseVersions: true,
    includeRulesVersions: true,
    includeDefinitionVersions: true,
    includeStructureLog: true,
  },
  countVersions: vi.fn(),
  hasVersionData: vi.fn(),
}));

import { countVersions, hasVersionData } from '../utils/scenarioImportExport';
const mockCountVersions = vi.mocked(countVersions);
const mockHasVersionData = vi.mocked(hasVersionData);

describe('ExportOptionsPopover', () => {
  it('calls onExport immediately when no versions exist', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 0, rulesVersionCount: 0, definitionVersionCount: 0, structureLogCount: 0 });
    mockHasVersionData.mockReturnValue(false);
    const onExport = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<ExportOptionsPopover data={{}} onExport={onExport} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
    expect(onExport).toHaveBeenCalledWith({
      includeResponseVersions: true,
      includeRulesVersions: true,
      includeDefinitionVersions: true,
      includeStructureLog: true,
    });
  });

  it('renders popover with version counts when versions exist', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 3, rulesVersionCount: 2, definitionVersionCount: 0, structureLogCount: 1 });
    mockHasVersionData.mockReturnValue(true);
    const onExport = vi.fn();
    const onClose = vi.fn();
    render(<ExportOptionsPopover data={{}} onExport={onExport} onClose={onClose} />);
    expect(screen.getByText('Export Options')).toBeTruthy();
    expect(screen.getByText('(3)')).toBeTruthy();
    expect(screen.getByText('(2)')).toBeTruthy();
  });

  it('calls onExport with options when Export button clicked', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 1, rulesVersionCount: 1, definitionVersionCount: 0, structureLogCount: 0 });
    mockHasVersionData.mockReturnValue(true);
    const onExport = vi.fn();
    render(<ExportOptionsPopover data={{}} onExport={onExport} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Export'));
    expect(onExport).toHaveBeenCalledWith({
      includeResponseVersions: true,
      includeRulesVersions: true,
      includeDefinitionVersions: true,
      includeStructureLog: true,
    });
  });

  it('unchecking response versions updates options', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 1, rulesVersionCount: 1, definitionVersionCount: 0, structureLogCount: 0 });
    mockHasVersionData.mockReturnValue(true);
    const onExport = vi.fn();
    render(<ExportOptionsPopover data={{}} onExport={onExport} onClose={() => {}} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // uncheck response versions
    fireEvent.click(screen.getByText('Export'));
    expect(onExport).toHaveBeenCalledWith({
      includeResponseVersions: false,
      includeRulesVersions: true,
      includeDefinitionVersions: true,
      includeStructureLog: true,
    });
  });

  it('calls onClose when Cancel clicked', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 1, rulesVersionCount: 0, definitionVersionCount: 0, structureLogCount: 0 });
    mockHasVersionData.mockReturnValue(true);
    const onClose = vi.fn();
    render(<ExportOptionsPopover data={{}} onExport={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on mousedown outside popover', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 1, rulesVersionCount: 0, definitionVersionCount: 0, structureLogCount: 0 });
    mockHasVersionData.mockReturnValue(true);
    const onClose = vi.fn();
    render(
      <div>
        <span data-testid="outside">out</span>
        <ExportOptionsPopover data={{}} onExport={() => {}} onClose={onClose} />
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });

  it('repositions popover when it overflows viewport bottom', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 1, rulesVersionCount: 0, definitionVersionCount: 0, structureLogCount: 0 });
    mockHasVersionData.mockReturnValue(true);
    const innerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 500,
      top: 0,
      left: 0,
      right: 1000,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const { container } = render(<ExportOptionsPopover data={{}} onExport={() => {}} onClose={() => {}} />);
    const pop = container.querySelector('.export-opts-popover') as HTMLElement;
    expect(pop.style.bottom).toBe('100%');

    spy.mockRestore();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
  });

  it('calls onExport with structureLog toggled from VersionCheckboxGroup', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 1, rulesVersionCount: 0, definitionVersionCount: 0, structureLogCount: 2 });
    mockHasVersionData.mockReturnValue(true);
    const onExport = vi.fn();
    render(<ExportOptionsPopover data={{}} onExport={onExport} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Structure History/));
    fireEvent.click(screen.getByText('Export'));
    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ includeStructureLog: false }));
  });

  it('calls onClose on Escape key', () => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 1, rulesVersionCount: 0, definitionVersionCount: 0, structureLogCount: 0 });
    mockHasVersionData.mockReturnValue(true);
    const onClose = vi.fn();
    render(<ExportOptionsPopover data={{}} onExport={() => {}} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
