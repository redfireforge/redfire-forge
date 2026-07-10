/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import VersionDiffSelectors from './VersionDiffSelectors';

afterEach(() => cleanup());

const OPTIONS = [
  { id: 'v1', label: 'Version 1' },
  { id: 'v2', label: 'Version 2' },
];

describe('VersionDiffSelectors', () => {
  it('renders left and right selectors with options', () => {
    render(
      <VersionDiffSelectors
        compareLeft={null}
        setCompareLeft={vi.fn()}
        compareRight={null}
        setCompareRight={vi.fn()}
        options={OPTIONS}
      />,
    );
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getAllByRole('option', { name: 'Version 1' })).toHaveLength(2);
  });

  it('calls setters when selections change', () => {
    const setCompareLeft = vi.fn();
    const setCompareRight = vi.fn();
    render(
      <VersionDiffSelectors
        compareLeft="v1"
        setCompareLeft={setCompareLeft}
        compareRight="v2"
        setCompareRight={setCompareRight}
        options={OPTIONS}
      />,
    );
    const [left, right] = screen.getAllByRole('combobox');
    fireEvent.change(left, { target: { value: 'v2' } });
    fireEvent.change(right, { target: { value: 'v1' } });
    expect(setCompareLeft).toHaveBeenCalledWith('v2');
    expect(setCompareRight).toHaveBeenCalledWith('v1');
  });

  it('uses empty string when compare values are null', () => {
    render(
      <VersionDiffSelectors
        compareLeft={null}
        setCompareLeft={vi.fn()}
        compareRight={null}
        setCompareRight={vi.fn()}
        options={OPTIONS}
      />,
    );
    const [left, right] = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(left.value).toBe('');
    expect(right.value).toBe('');
  });
});
