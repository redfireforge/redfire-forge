/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VersionCheckboxGroup from './VersionCheckboxGroup';

describe('VersionCheckboxGroup', () => {
  const counts = {
    responseVersionCount: 5,
    rulesVersionCount: 3,
    definitionVersionCount: 2,
    structureLogCount: 4,
  };

  const allOn = {
    responseVersions: true,
    rulesVersions: true,
    definitionVersions: true,
    structureLog: true,
  };

  it('renders both checkboxes with counts', () => {
    const onChange = vi.fn();
    render(<VersionCheckboxGroup counts={counts} values={allOn} onChange={onChange} />);
    expect(screen.getByText('Response Versions')).toBeTruthy();
    expect(screen.getByText('Rules Versions')).toBeTruthy();
    expect(screen.getByText('Definition Versions')).toBeTruthy();
    expect(screen.getByText('Structure History')).toBeTruthy();
    expect(screen.getByText('(5)')).toBeTruthy();
    expect(screen.getByText('(3)')).toBeTruthy();
    expect(screen.getByText('(2)')).toBeTruthy();
    expect(screen.getByText('(4)')).toBeTruthy();
  });

  it('reflects checked state', () => {
    const onChange = vi.fn();
    render(
      <VersionCheckboxGroup
        counts={counts}
        values={{ ...allOn, responseVersions: false }}
        onChange={onChange}
      />
    );
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(true);
    expect(checkboxes[3].checked).toBe(true);
  });

  it('calls onChange when response checkbox toggled', () => {
    const onChange = vi.fn();
    render(<VersionCheckboxGroup counts={counts} values={allOn} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onChange).toHaveBeenCalledWith({ ...allOn, responseVersions: false });
  });

  it('calls onChange when rules checkbox toggled', () => {
    const onChange = vi.fn();
    render(<VersionCheckboxGroup counts={counts} values={allOn} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(onChange).toHaveBeenCalledWith({ ...allOn, rulesVersions: false });
  });

  it('calls onChange when definition checkbox toggled', () => {
    const onChange = vi.fn();
    render(<VersionCheckboxGroup counts={counts} values={allOn} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]);
    expect(onChange).toHaveBeenCalledWith({ ...allOn, definitionVersions: false });
  });

  it('calls onChange when structure log checkbox toggled', () => {
    const onChange = vi.fn();
    render(<VersionCheckboxGroup counts={counts} values={allOn} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('checkbox')[3]);
    expect(onChange).toHaveBeenCalledWith({ ...allOn, structureLog: false });
  });
});
