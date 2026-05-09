/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowKeyboardShortcuts } from './useWorkflowKeyboardShortcuts';
import type { Workflow } from '../types/workflow';
import type { ToastApi } from '../components/WorkflowToastProvider';

const fitView = vi.fn();

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ fitView }),
}));

const wf: Workflow = {
  id: 'w1',
  name: 'Test',
  schemaVersion: 6,
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [],
  edges: [],
  createdAt: 0,
  updatedAt: 0,
};

const toast: ToastApi = { show: vi.fn(), dismiss: vi.fn() };

function press(key: string, opts?: {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
}) {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey: opts?.metaKey,
    ctrlKey: opts?.ctrlKey ?? opts?.metaKey,
    shiftKey: opts?.shiftKey,
    bubbles: true,
    cancelable: true,
  });
  vi.spyOn(event, 'preventDefault');
  Object.defineProperty(event, 'target', { value: opts?.target ?? document.body, enumerable: true });
  window.dispatchEvent(event);
  return event;
}

const makeOpts = () => ({
  selected: wf,
  previewWorkflow: null as Workflow | null,
  persistWorkflow: vi.fn(),
  handleToggleConsole: vi.fn(),
  handleUndoAction: vi.fn(),
  handleRedoAction: vi.fn(),
  handleCopyNode: vi.fn(),
  handlePasteNode: vi.fn(),
  handleDuplicateNode: vi.fn(),
  handleQuickTestRef: { current: vi.fn() },
  handleDebugQuickTestRef: { current: vi.fn() },
  handleAutoLayout: vi.fn(),
  setShowShortcuts: vi.fn(),
  setShowCommandPalette: vi.fn((v: boolean | ((p: boolean) => boolean)) =>
    (typeof v === 'function' ? v(false) : v)),
  setShowMinimap: vi.fn((v: boolean | ((p: boolean) => boolean)) =>
    (typeof v === 'function' ? v(true) : v)),
  toast,
});

describe('useWorkflowKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers no listener when selected is null', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const opts = makeOpts();
    opts.selected = null;
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    const callsBefore = add.mock.calls.filter(c => c[0] === 'keydown').length;
    expect(callsBefore).toBe(0);
  });

  it('opens shortcuts help on ? outside inputs', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('?', { target: document.body });
    expect(opts.setShowShortcuts).toHaveBeenCalledWith(true);
  });

  it('does not open shortcuts when typing in an input', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('?', { target: input });
    expect(opts.setShowShortcuts).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('Cmd+S saves when not in preview', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('s', { metaKey: true });
    expect(opts.persistWorkflow).toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith('success', 'Workflow saved');
  });

  it('Cmd+S does not persist in preview mode', () => {
    const opts = makeOpts();
    opts.previewWorkflow = { ...wf, id: 'pv' };
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('s', { metaKey: true });
    expect(opts.persistWorkflow).not.toHaveBeenCalled();
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('Cmd+K toggles command palette', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('k', { metaKey: true });
    expect(opts.setShowCommandPalette).toHaveBeenCalled();
  });

  it('Cmd+J toggles console', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('j', { metaKey: true });
    expect(opts.handleToggleConsole).toHaveBeenCalled();
  });

  it('Cmd+Enter runs quick test', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('Enter', { metaKey: true });
    expect(opts.handleQuickTestRef.current).toHaveBeenCalled();
  });

  it('Cmd+Shift+Enter runs debug quick test', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('Enter', { metaKey: true, shiftKey: true });
    expect(opts.handleDebugQuickTestRef.current).toHaveBeenCalled();
  });

  it('Cmd+L runs auto layout when not in input', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('l', { metaKey: true });
    expect(opts.handleAutoLayout).toHaveBeenCalled();
  });

  it('Cmd+M toggles minimap when not in input', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('m', { metaKey: true });
    expect(opts.setShowMinimap).toHaveBeenCalled();
  });

  it('Cmd+0 fits view', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('0', { metaKey: true });
    expect(fitView).toHaveBeenCalledWith({ padding: 0.2, duration: 300 });
  });

  it('Cmd+Z undoes outside inputs', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('z', { metaKey: true });
    expect(opts.handleUndoAction).toHaveBeenCalled();
  });

  it('Cmd+Shift+Z redoes', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('z', { metaKey: true, shiftKey: true });
    expect(opts.handleRedoAction).toHaveBeenCalled();
  });

  it('Cmd+C copies node outside inputs', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('c', { metaKey: true });
    expect(opts.handleCopyNode).toHaveBeenCalled();
  });

  it('Cmd+V pastes node outside inputs', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('v', { metaKey: true });
    expect(opts.handlePasteNode).toHaveBeenCalled();
  });

  it('Cmd+D duplicates node outside inputs', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('d', { metaKey: true });
    expect(opts.handleDuplicateNode).toHaveBeenCalled();
  });

  it('ignores Cmd+L when focus is in textarea', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    const ta = document.createElement('textarea');
    press('l', { metaKey: true, target: ta });
    expect(opts.handleAutoLayout).not.toHaveBeenCalled();
  });

  it('ignores Cmd+Z when inside monaco editor', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    const wrap = document.createElement('div');
    wrap.className = 'monaco-editor';
    press('z', { metaKey: true, target: wrap });
    expect(opts.handleUndoAction).not.toHaveBeenCalled();
  });

  it('uses Ctrl on non-mac meta key path via ctrlKey', () => {
    const opts = makeOpts();
    renderHook(() => useWorkflowKeyboardShortcuts(opts));
    press('s', { ctrlKey: true, metaKey: false });
    expect(opts.persistWorkflow).toHaveBeenCalled();
  });
});
