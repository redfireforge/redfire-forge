/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RustTestPanelOverlay from './RustTestPanelOverlay';

function MockPanel() {
  return <div data-testid="mock-rust-panel">Rust Panel Content</div>;
}

describe('RustTestPanelOverlay', () => {
  const originalSearch = window.location.search;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: originalSearch },
      writable: true,
    });
  });

  it('renders nothing by default when rust-test query param is absent', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
    });
    const { container } = render(<RustTestPanelOverlay Panel={MockPanel} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the panel when rust-test query param is present', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?rust-test=1' },
      writable: true,
    });
    render(<RustTestPanelOverlay Panel={MockPanel} />);
    expect(screen.getByTestId('mock-rust-panel')).toBeTruthy();
  });

  it('does not toggle when modifier keys are missing', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
    });
    render(<RustTestPanelOverlay Panel={MockPanel} />);

    fireEvent.keyDown(window, { key: 'T', shiftKey: true });
    fireEvent.keyDown(window, { key: 'T', metaKey: true });
    fireEvent.keyDown(window, { key: 'X', metaKey: true, shiftKey: true });
    expect(screen.queryByTestId('mock-rust-panel')).toBeNull();
  });

  it('toggles visibility with Cmd+Shift+T', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
    });
    render(<RustTestPanelOverlay Panel={MockPanel} />);
    expect(screen.queryByTestId('mock-rust-panel')).toBeNull();

    fireEvent.keyDown(window, { key: 'T', metaKey: true, shiftKey: true });
    expect(screen.getByTestId('mock-rust-panel')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'T', metaKey: true, shiftKey: true });
    expect(screen.queryByTestId('mock-rust-panel')).toBeNull();
  });

  it('calls preventDefault on the toggle shortcut', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
    });
    render(<RustTestPanelOverlay Panel={MockPanel} />);
    const event = new KeyboardEvent('keydown', { key: 'T', metaKey: true, shiftKey: true, bubbles: true });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(preventSpy).toHaveBeenCalled();
  });

  it('toggles visibility with Ctrl+Shift+T', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
    });
    render(<RustTestPanelOverlay Panel={MockPanel} />);

    fireEvent.keyDown(window, { key: 'T', ctrlKey: true, shiftKey: true });
    expect(screen.getByTestId('mock-rust-panel')).toBeTruthy();
  });

  it('closes via the Close button', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?rust-test' },
      writable: true,
    });
    render(<RustTestPanelOverlay Panel={MockPanel} />);
    expect(screen.getByTestId('mock-rust-panel')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Close \(Cmd\+Shift\+T\)/i }));
    expect(screen.queryByTestId('mock-rust-panel')).toBeNull();
  });

  it('removes the keydown listener on unmount', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
    });
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<RustTestPanelOverlay Panel={MockPanel} />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('shows Suspense fallback while lazy panel loads', async () => {
    const LazyPanel = React.lazy(() => new Promise<{ default: typeof MockPanel }>((resolve) => {
      setTimeout(() => resolve({ default: MockPanel }), 50);
    }));

    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?rust-test' },
      writable: true,
    });
    render(<RustTestPanelOverlay Panel={LazyPanel} />);
    expect(screen.getByText('Loading test panel...')).toBeTruthy();
    expect(await screen.findByTestId('mock-rust-panel')).toBeTruthy();
  });
});
