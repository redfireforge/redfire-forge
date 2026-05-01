/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImportVersionModal from './ImportVersionModal';

vi.mock('../utils/scenarioImportExport', () => ({
  countVersions: vi.fn(),
}));

import { countVersions } from '../utils/scenarioImportExport';
const mockCountVersions = vi.mocked(countVersions);

describe('ImportVersionModal', () => {
  beforeEach(() => {
    mockCountVersions.mockReturnValue({ responseVersionCount: 2, rulesVersionCount: 3, definitionVersionCount: 0 });
  });

  it('renders with version counts', () => {
    render(<ImportVersionModal data={{}} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Import Version Options')).toBeTruthy();
    expect(screen.getByText('(2)')).toBeTruthy();
    expect(screen.getByText('(3)')).toBeTruthy();
  });

  it('calls onConfirm with default options (both true)', () => {
    const onConfirm = vi.fn();
    render(<ImportVersionModal data={{}} onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Import'));
    expect(onConfirm).toHaveBeenCalledWith({ importResponseVersions: true, importRulesVersions: true, importDefinitionVersions: true, importStructureLog: true });
  });

  it('calls onConfirm with unchecked response versions', () => {
    const onConfirm = vi.fn();
    render(<ImportVersionModal data={{}} onConfirm={onConfirm} onCancel={() => {}} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // uncheck response versions
    fireEvent.click(screen.getByText('Import'));
    expect(onConfirm).toHaveBeenCalledWith({ importResponseVersions: false, importRulesVersions: true, importDefinitionVersions: true, importStructureLog: true });
  });

  it('calls onCancel when Cancel clicked', () => {
    const onCancel = vi.fn();
    render(<ImportVersionModal data={{}} onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when overlay clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(<ImportVersionModal data={{}} onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(container.querySelector('.import-version-overlay')!);
    expect(onCancel).toHaveBeenCalled();
  });
});
