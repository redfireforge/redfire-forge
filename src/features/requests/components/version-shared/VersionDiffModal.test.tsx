/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { getCustomSelectOptionLabels } from '../../../../test-utils/customSelectHelper';
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

  describe('drag + resize', () => {
    function mockRect(el: HTMLElement, left: number, top: number, width: number, height: number) {
      el.getBoundingClientRect = () => ({
        x: left, y: top, width, height,
        left, top, right: left + width, bottom: top + height, toJSON: () => ({}),
      }) as DOMRect;
    }

    it('exposes the modal box as the dialog with resize handles as direct children', () => {
      const { container } = render(<VersionDiffModal {...defaultProps()} />);
      const modal = container.querySelector('.version-diff-modal');
      expect(modal?.getAttribute('role')).toBe('dialog');
      expect(modal?.getAttribute('aria-modal')).toBe('true');
      for (const cls of ['modal-resize-edge-right', 'modal-resize-edge-bottom', 'modal-resize-corner']) {
        const handle = container.querySelector(`.${cls}`);
        expect(handle).toBeTruthy();
        // The resize hook measures the handle's parent for the drag origin.
        expect(handle?.parentElement).toBe(modal);
      }
    });

    it('marks the header as a drag handle', () => {
      const { container } = render(<VersionDiffModal {...defaultProps()} />);
      const header = container.querySelector('.version-diff-modal-header') as HTMLElement;
      expect(header.style.cursor).toBe('move');
    });

    it('moves the modal when the header is dragged', () => {
      const { container } = render(<VersionDiffModal {...defaultProps()} />);
      const modal = container.querySelector('.version-diff-modal') as HTMLElement;
      const header = container.querySelector('.version-diff-modal-header') as HTMLElement;
      mockRect(modal, 150, 90, 500, 350);

      fireEvent.mouseDown(header, { clientX: 250, clientY: 110 });
      fireEvent(window, new MouseEvent('mousemove', { clientX: 210, clientY: 170 }));
      fireEvent(window, new MouseEvent('mouseup'));

      expect(modal.style.position).toBe('fixed');
      expect(modal.style.left).toBe('110px'); // 150 - 40
      expect(modal.style.top).toBe('150px');  // 90 + 60
    });

    it('does not drag from the header checkbox label', () => {
      const { container } = render(
        <VersionDiffModal
          {...defaultProps({
            headerControls: (
              <label className="version-diff-toggle">
                <input type="checkbox" readOnly checked={false} />
                <span>Unordered Arrays</span>
              </label>
            ),
          })}
        />,
      );
      const modal = container.querySelector('.version-diff-modal') as HTMLElement;
      const caption = container.querySelector('.version-diff-toggle span') as HTMLElement;

      fireEvent.mouseDown(caption, { clientX: 300, clientY: 110 });
      fireEvent(window, new MouseEvent('mousemove', { clientX: 400, clientY: 260 }));
      fireEvent(window, new MouseEvent('mouseup'));

      expect(modal.style.position).toBe('');
    });

    it('resizes from the corner by the drag delta', () => {
      const { container } = render(<VersionDiffModal {...defaultProps()} />);
      const modal = container.querySelector('.version-diff-modal') as HTMLElement;
      const corner = container.querySelector('.modal-resize-corner') as HTMLElement;
      mockRect(modal, 0, 0, 700, 500);

      fireEvent.mouseDown(corner, { clientX: 700, clientY: 500 });
      fireEvent(window, new MouseEvent('mousemove', { clientX: 820, clientY: 580 }));
      fireEvent(window, new MouseEvent('mouseup'));

      expect(modal.style.width).toBe('820px');
      expect(modal.style.height).toBe('580px');
    });

    it('clamps resizing at the minimum size', () => {
      const { container } = render(<VersionDiffModal {...defaultProps()} />);
      const modal = container.querySelector('.version-diff-modal') as HTMLElement;
      const corner = container.querySelector('.modal-resize-corner') as HTMLElement;
      mockRect(modal, 0, 0, 700, 500);

      fireEvent.mouseDown(corner, { clientX: 700, clientY: 500 });
      fireEvent(window, new MouseEvent('mousemove', { clientX: -3000, clientY: -3000 }));
      fireEvent(window, new MouseEvent('mouseup'));

      expect(modal.style.width).toBe('640px');
      expect(modal.style.height).toBe('360px');
    });

    it('clamps resizing at the viewport size', () => {
      const { container } = render(<VersionDiffModal {...defaultProps()} />);
      const modal = container.querySelector('.version-diff-modal') as HTMLElement;
      const corner = container.querySelector('.modal-resize-corner') as HTMLElement;
      mockRect(modal, 0, 0, 700, 500);

      fireEvent.mouseDown(corner, { clientX: 700, clientY: 500 });
      fireEvent(window, new MouseEvent('mousemove', { clientX: 9000, clientY: 9000 }));
      fireEvent(window, new MouseEvent('mouseup'));

      expect(modal.style.width).toBe(`${window.innerWidth - 16}px`);
      expect(modal.style.height).toBe(`${window.innerHeight - 16}px`);
    });
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
    const { container } = render(<VersionDiffModal {...defaultProps({ options })} />);
    expect(container.querySelectorAll('.cs-wrapper')).toHaveLength(2);
    expect(getCustomSelectOptionLabels(container, 0)).toEqual(['Select...', 'Version 1', 'Version 2']);
    expect(getCustomSelectOptionLabels(container, 1)).toEqual(['Select...', 'Version 1', 'Version 2']);
  });
});
