/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import VersionDiffSearchBar from './VersionDiffSearchBar';

afterEach(() => cleanup());

function makeProps(overrides: Partial<Parameters<typeof VersionDiffSearchBar>[0]> = {}) {
  return {
    diffSearch: '',
    setDiffSearch: vi.fn(),
    diffMatchIdx: 0,
    setDiffMatchIdx: vi.fn(),
    diffMatchCount: 3,
    diffSearchRef: createRef<HTMLInputElement | null>(),
    diffGoNext: vi.fn(),
    diffGoPrev: vi.fn(),
    ...overrides,
  };
}

describe('VersionDiffSearchBar', () => {
  it('updates search and resets match index on change', () => {
    const setDiffSearch = vi.fn();
    const setDiffMatchIdx = vi.fn();
    render(<VersionDiffSearchBar {...makeProps({ setDiffSearch, setDiffMatchIdx })} />);
    fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: 'foo' } });
    expect(setDiffSearch).toHaveBeenCalledWith('foo');
    expect(setDiffMatchIdx).toHaveBeenCalledWith(0);
  });

  it('shows match counter when search is non-empty', () => {
    render(<VersionDiffSearchBar {...makeProps({ diffSearch: 'x', diffMatchIdx: 1, diffMatchCount: 4 })} />);
    expect(screen.getByText('2/4')).toBeInTheDocument();
  });

  it('shows No match when search has zero hits', () => {
    render(<VersionDiffSearchBar {...makeProps({ diffSearch: 'zzz', diffMatchCount: 0 })} />);
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('navigates with Enter and Shift+Enter', () => {
    const diffGoNext = vi.fn();
    const diffGoPrev = vi.fn();
    render(<VersionDiffSearchBar {...makeProps({ diffGoNext, diffGoPrev })} />);
    const input = screen.getByPlaceholderText(/Search/);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(diffGoNext).toHaveBeenCalledTimes(1);
    expect(diffGoPrev).toHaveBeenCalledTimes(1);
  });

  it('clears search on Escape when escapeClearsSearch is enabled', () => {
    const setDiffSearch = vi.fn();
    const setDiffMatchIdx = vi.fn();
    render(
      <VersionDiffSearchBar
        {...makeProps({ diffSearch: 'keep', setDiffSearch, setDiffMatchIdx, escapeClearsSearch: true })}
      />,
    );
    const input = screen.getByPlaceholderText(/Search/);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(setDiffSearch).toHaveBeenCalledWith('');
    expect(setDiffMatchIdx).toHaveBeenCalledWith(0);
  });

  it('does not clear on Escape when search is blank', () => {
    const setDiffSearch = vi.fn();
    render(
      <VersionDiffSearchBar
        {...makeProps({ diffSearch: '   ', setDiffSearch, escapeClearsSearch: true })}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText(/Search/), { key: 'Escape' });
    expect(setDiffSearch).not.toHaveBeenCalled();
  });

  it('wires nav buttons and disables them without matches', () => {
    const diffGoNext = vi.fn();
    const diffGoPrev = vi.fn();
    render(<VersionDiffSearchBar {...makeProps({ diffGoNext, diffGoPrev, diffMatchCount: 0 })} />);
    const [prevBtn, nextBtn] = screen.getAllByRole('button');
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();
    fireEvent.click(prevBtn);
    fireEvent.click(nextBtn);
    expect(diffGoPrev).not.toHaveBeenCalled();
    expect(diffGoNext).not.toHaveBeenCalled();
  });

  it('calls nav handlers when matches exist', () => {
    const diffGoNext = vi.fn();
    const diffGoPrev = vi.fn();
    render(<VersionDiffSearchBar {...makeProps({ diffGoNext, diffGoPrev, diffMatchCount: 2 })} />);
    const [prevBtn, nextBtn] = screen.getAllByRole('button');
    fireEvent.click(prevBtn);
    fireEvent.click(nextBtn);
    expect(diffGoPrev).toHaveBeenCalledTimes(1);
    expect(diffGoNext).toHaveBeenCalledTimes(1);
  });
});
