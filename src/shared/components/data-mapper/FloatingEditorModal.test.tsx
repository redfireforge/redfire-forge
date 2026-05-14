/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import type { ParseError } from './utils/validationDsl';
import FloatingEditorModal from './FloatingEditorModal';

const mockValidationProps = vi.fn();

vi.mock('./ValidationCodeEditor', () => ({
  default: (props: Record<string, unknown>) => {
    mockValidationProps(props);
    return <div data-testid="validation-editor-mock" />;
  },
}));

const defaultErrors: ParseError[] = [{ lineNumber: 2, column: 1, message: 'Bad rule' }];
const defaultSamplePaths = ['$.foo', '$.bar'];

function setupViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
}

function renderFloatingEditor(
  overrides: Partial<{
    value: string;
    onChange: (text: string) => void;
    errors: ParseError[];
    samplePaths: string[];
    onClose: () => void;
  }> = {},
) {
  const onClose = overrides.onClose ?? vi.fn();
  const onChange = overrides.onChange ?? vi.fn();
  const utils = render(
    <FloatingEditorModal
      value={overrides.value ?? 'equals $.x "y"'}
      onChange={onChange}
      errors={overrides.errors ?? defaultErrors}
      samplePaths={overrides.samplePaths ?? defaultSamplePaths}
      onClose={onClose}
    />,
  );
  const modal = document.body.querySelector('.dm-floating-editor') as HTMLElement;
  return { ...utils, onClose, onChange, modal };
}

/** Keeps mousemove listeners attached after mouseup so a later mousemove hits inner guard branches; removes explicitly after. */
async function withLeakedMouseMoveListeners(run: () => void | Promise<void>) {
  let mouseMoveListener: EventListener | null = null;
  const origAdd = document.addEventListener.bind(document);
  const origRemove = document.removeEventListener.bind(document);

  const addSpy = vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'mousemove') mouseMoveListener = listener as EventListener;
    return origAdd(type, listener as EventListener, options);
  });
  const removeSpy = vi.spyOn(document, 'removeEventListener').mockImplementation((type, listener, options) => {
    if (type === 'mousemove') return;
    return origRemove(type, listener as EventListener, options);
  });

  try {
    await run();
  } finally {
    if (mouseMoveListener) {
      origRemove('mousemove', mouseMoveListener);
    }
    addSpy.mockRestore();
    removeSpy.mockRestore();
  }
}

describe('FloatingEditorModal', () => {
  beforeEach(() => {
    mockValidationProps.mockClear();
    setupViewport(1200, 900);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders via portal as a direct child of document.body', () => {
    const { modal } = renderFloatingEditor();
    expect(modal).toBeTruthy();
    expect(modal.parentElement).toBe(document.body);
    expect(screen.getByTestId('validation-editor-mock')).toBeInTheDocument();
  });

  it('shows title Validation Rules in the drag handle', () => {
    renderFloatingEditor();
    expect(screen.getByText('Validation Rules')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderFloatingEditor({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /close floating editor/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderFloatingEditor({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when a non-Escape key is pressed', () => {
    const onClose = vi.fn();
    renderFloatingEditor({ onClose });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses minimum inset when viewport is smaller than default modal size', () => {
    setupViewport(400, 300);
    const { modal } = renderFloatingEditor();
    expect(modal.style.left).toBe('40px');
    expect(modal.style.top).toBe('40px');
  });

  it('does not start drag when mousedown originates from the close button', () => {
    setupViewport(1200, 900);
    const { modal } = renderFloatingEditor();
    const initialLeft = modal.style.left;
    const initialTop = modal.style.top;

    fireEvent.mouseDown(screen.getByRole('button', { name: /close floating editor/i }), {
      clientX: 10,
      clientY: 10,
    });
    fireEvent.mouseMove(document, { clientX: 500, clientY: 400 });
    fireEvent.mouseUp(document);

    expect(modal.style.left).toBe(initialLeft);
    expect(modal.style.top).toBe(initialTop);
  });

  it('updates position when dragging via the drag handle', async () => {
    setupViewport(1200, 900);
    const { modal } = renderFloatingEditor();
    const drag = modal.querySelector('.dm-floating-editor-drag') as HTMLElement;

    fireEvent.mouseDown(drag, { clientX: 100, clientY: 100 });

    await act(async () => {
      fireEvent.mouseMove(document, { clientX: 180, clientY: 140 });
    });

    expect(modal.style.left).toBe('370px');
    expect(modal.style.top).toBe('200px');

    fireEvent.mouseUp(document);
  });

  it('clamps position to non-negative coordinates while dragging', async () => {
    setupViewport(1200, 900);
    const { modal } = renderFloatingEditor();
    const drag = modal.querySelector('.dm-floating-editor-drag') as HTMLElement;

    fireEvent.mouseDown(drag, { clientX: 400, clientY: 400 });

    await act(async () => {
      fireEvent.mouseMove(document, { clientX: -50, clientY: -80 });
    });

    expect(modal.style.left).toBe('0px');
    expect(modal.style.top).toBe('0px');

    fireEvent.mouseUp(document);
  });

  it('ignores stray mousemove after drag ends when listener lingers', async () => {
    setupViewport(1200, 900);
    await withLeakedMouseMoveListeners(async () => {
      const { modal } = renderFloatingEditor();
      const drag = modal.querySelector('.dm-floating-editor-drag') as HTMLElement;

      fireEvent.mouseDown(drag, { clientX: 100, clientY: 100 });
      await act(async () => {
        fireEvent.mouseMove(document, { clientX: 130, clientY: 130 });
      });
      const leftAfterMove = modal.style.left;
      fireEvent.mouseUp(document);

      await act(async () => {
        fireEvent.mouseMove(document, { clientX: 900, clientY: 900 });
      });

      expect(modal.style.left).toBe(leftAfterMove);
    });
  });

  it('updates size when resizing from the resize handle', async () => {
    const { modal } = renderFloatingEditor();
    const resize = modal.querySelector('.dm-floating-editor-resize') as HTMLElement;

    fireEvent.mouseDown(resize, { clientX: 700, clientY: 500 });

    await act(async () => {
      fireEvent.mouseMove(document, { clientX: 760, clientY: 540 });
    });

    expect(modal.style.width).toBe('680px');
    expect(modal.style.height).toBe('460px');

    fireEvent.mouseUp(document);
  });

  it('enforces minimum width 380 and minimum height 260 while resizing', async () => {
    const { modal } = renderFloatingEditor();
    const resize = modal.querySelector('.dm-floating-editor-resize') as HTMLElement;

    fireEvent.mouseDown(resize, { clientX: 0, clientY: 0 });

    await act(async () => {
      fireEvent.mouseMove(document, { clientX: -400, clientY: -300 });
    });

    expect(modal.style.width).toBe('380px');
    expect(modal.style.height).toBe('260px');

    fireEvent.mouseUp(document);
  });

  it('ignores stray mousemove after resize ends when listener lingers', async () => {
    await withLeakedMouseMoveListeners(async () => {
      const { modal } = renderFloatingEditor();
      const resize = modal.querySelector('.dm-floating-editor-resize') as HTMLElement;

      fireEvent.mouseDown(resize, { clientX: 0, clientY: 0 });
      await act(async () => {
        fireEvent.mouseMove(document, { clientX: 40, clientY: 40 });
      });
      const widthAfterMove = modal.style.width;
      fireEvent.mouseUp(document);

      await act(async () => {
        fireEvent.mouseMove(document, { clientX: 999, clientY: 999 });
      });

      expect(modal.style.width).toBe(widthAfterMove);
    });
  });

  it('passes value, onChange, errors, samplePaths and derived height to ValidationCodeEditor', () => {
    const onChange = vi.fn();
    const errors: ParseError[] = [{ lineNumber: 1, message: 'x' }];
    const samplePaths = ['$.a'];

    renderFloatingEditor({
      value: 'exists $.id',
      onChange,
      errors,
      samplePaths,
    });

    expect(mockValidationProps).toHaveBeenCalled();
    const last = mockValidationProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;

    expect(last.value).toBe('exists $.id');
    expect(last.onChange).toBe(onChange);
    expect(last.errors).toEqual(errors);
    expect(last.samplePaths).toEqual(samplePaths);
    expect(last.height).toBe(340);
    expect(last.isFloating).toBe(true);
    expect(last.onPopIn).toBeDefined();
  });

  it('updates ValidationCodeEditor height when modal is resized', async () => {
    const onClose = vi.fn();
    const { modal } = renderFloatingEditor({ onClose });
    mockValidationProps.mockClear();

    const resize = modal.querySelector('.dm-floating-editor-resize') as HTMLElement;
    fireEvent.mouseDown(resize, { clientX: 0, clientY: 0 });

    await act(async () => {
      fireEvent.mouseMove(document, { clientX: 0, clientY: 100 });
    });

    fireEvent.mouseUp(document);

    const last = mockValidationProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(last.height).toBe(440);
    expect(last.onPopIn).toBe(onClose);
  });

  it('passes onPopIn equal to onClose for ValidationCodeEditor', () => {
    const onClose = vi.fn();
    renderFloatingEditor({ onClose });
    const last = mockValidationProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(last.onPopIn).toBe(onClose);
  });

  it('removes document keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const onClose = vi.fn();
    const { unmount } = renderFloatingEditor({ onClose });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });
});
