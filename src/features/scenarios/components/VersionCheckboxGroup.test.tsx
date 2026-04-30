/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VersionCheckboxGroup from './VersionCheckboxGroup';

describe('VersionCheckboxGroup', () => {
  const counts = { responseVersionCount: 5, rulesVersionCount: 3 };

  it('renders both checkboxes with counts', () => {
    const onChange = vi.fn();
    render(<VersionCheckboxGroup counts={counts} values={{ responseVersions: true, rulesVersions: true }} onChange={onChange} />);
    expect(screen.getByText('Response Versions')).toBeTruthy();
    expect(screen.getByText('Rules Versions')).toBeTruthy();
    expect(screen.getByText('(5)')).toBeTruthy();
    expect(screen.getByText('(3)')).toBeTruthy();
  });

  it('reflects checked state', () => {
    const onChange = vi.fn();
    render(<VersionCheckboxGroup counts={counts} values={{ responseVersions: false, rulesVersions: true }} onChange={onChange} />);
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
  });

  it('calls onChange when response checkbox toggled', () => {
    const onChange = vi.fn();
    render(<VersionCheckboxGroup counts={counts} values={{ responseVersions: true, rulesVersions: true }} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onChange).toHaveBeenCalledWith({ responseVersions: false, rulesVersions: true });
  });

  it('calls onChange when rules checkbox toggled', () => {
    const onChange = vi.fn();
    render(<VersionCheckboxGroup counts={counts} values={{ responseVersions: true, rulesVersions: true }} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(onChange).toHaveBeenCalledWith({ responseVersions: true, rulesVersions: false });
  });
});
