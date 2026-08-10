/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  selectOptionByIndex,
  getCustomSelectValue,
  getCustomSelectOptionLabels,
} from '../../../../test-utils/customSelectHelper';
import VersionDiffSelectors from './VersionDiffSelectors';

afterEach(() => cleanup());

const OPTIONS = [
  { id: 'v1', label: 'Version 1' },
  { id: 'v2', label: 'Version 2' },
];

describe('VersionDiffSelectors', () => {
  it('renders left and right selectors with options', () => {
    const { container } = render(
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
    expect(container.querySelectorAll('.cs-wrapper')).toHaveLength(2);
    expect(getCustomSelectOptionLabels(container, 0)).toEqual(['Select...', 'Version 1', 'Version 2']);
    expect(getCustomSelectOptionLabels(container, 1)).toEqual(['Select...', 'Version 1', 'Version 2']);
  });

  it('calls setters when selections change', () => {
    const setCompareLeft = vi.fn();
    const setCompareRight = vi.fn();
    const { container } = render(
      <VersionDiffSelectors
        compareLeft="v1"
        setCompareLeft={setCompareLeft}
        compareRight="v2"
        setCompareRight={setCompareRight}
        options={OPTIONS}
      />,
    );
    selectOptionByIndex(container, 0, 'Version 2');
    selectOptionByIndex(container, 1, 'Version 1');
    expect(setCompareLeft).toHaveBeenCalledWith('v2');
    expect(setCompareRight).toHaveBeenCalledWith('v1');
  });

  it('uses empty string when compare values are null', () => {
    const { container } = render(
      <VersionDiffSelectors
        compareLeft={null}
        setCompareLeft={vi.fn()}
        compareRight={null}
        setCompareRight={vi.fn()}
        options={OPTIONS}
      />,
    );
    expect(getCustomSelectValue(container, 0)).toBe('Select...');
    expect(getCustomSelectValue(container, 1)).toBe('Select...');
  });
});
