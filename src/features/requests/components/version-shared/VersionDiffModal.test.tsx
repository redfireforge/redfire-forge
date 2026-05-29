/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import VersionDiffModal from './VersionDiffModal';

// Sub-components: mock heavy ones (json-diff-kit Viewer) to avoid jsdom issues
vi.mock('json-diff-kit', () => ({
  Viewer: () => null,
}));

afterEach(() => cleanup());

function makeSearchBarProps() {
  return {
    diffSearch: '',
    setDiffSearch: vi.fn(),
    diffMatchIdx: 0,
    setDiffMatchIdx: vi.fn(),
    diffMatchCount: 0,
    diffSearchRef: createRef<HTMLInputElement | null>(),
    diffGoNext: vi.fn(),
    diffGoPrev: vi.fn(),
  };
}

function defaultProps(overrides: Partial<Parameters<typeof VersionDiffModal>[0]> = {}) {
  return {
    show: true,
    onClose: vi.fn(),
    title: 'Compare Versions',
    compareLeft: null,
    setCompareLeft: vi.fn(),
    compareRight: null,
    setCompareRight: vi.fn(),
    options: [],
    diffResult: null,
    diffViewerRef: createRef<HTMLDivElement | null>(),
    searchBarProps: makeSearchBarProps(),
    ...overrides,
  };
}

describe('VersionDiffModal', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(<VersionDiffModal {...defaultProps({ show: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when show is true', () => {
    render(<VersionDiffModal {...defaultProps()} />);
    expect(screen.getByText('Compare Versions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('calls onClose when clicking the Close button', () => {
    const onClose = vi.fn();
    render(<VersionDiffModal {...defaultProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay backdrop (target === currentTarget)', () => {
    const onClose = vi.fn();
    const { container } = render(<VersionDiffModal {...defaultProps({ onClose })} />);
    const overlay = container.querySelector('.version-diff-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when clicking inside the modal (target !== currentTarget)', () => {
    const onClose = vi.fn();
    const { container } = render(<VersionDiffModal {...defaultProps({ onClose })} />);
    const modal = container.querySelector('.version-diff-modal')!;
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders headerControls when provided', () => {
    render(
      <VersionDiffModal
        {...defaultProps()}
        headerControls={<button>Extra Action</button>}
      />,
    );
    expect(screen.getByRole('button', { name: /extra action/i })).toBeInTheDocument();
  });

  it('renders children inside the viewer section', () => {
    render(
      <VersionDiffModal {...defaultProps()}>
        <div data-testid="child-content">Tab Content</div>
      </VersionDiffModal>,
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders version selectors with provided options', () => {
    const options = [
      { id: 'v1', label: 'Version 1' },
      { id: 'v2', label: 'Version 2' },
    ];
    render(<VersionDiffModal {...defaultProps({ options })} />);
    // Options appear in both Left and Right selects
    expect(screen.getAllByText('Version 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Version 2').length).toBeGreaterThanOrEqual(1);
  });
});
