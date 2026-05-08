/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowConsole } from './useWorkflowConsole';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  close() { this.closed = true; }
}

describe('useWorkflowConsole', () => {
  beforeEach(() => {
    sessionStorage.clear();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('initializes from sessionStorage defaults', () => {
    const { result } = renderHook(() =>
      useWorkflowConsole({ hasWebhookNode: false, pushConsoleLine: vi.fn() }),
    );
    expect(result.current.consoleOpen).toBe(false);
    expect(result.current.consoleRunBehavior).toBe('clear');
    expect(result.current.consoleOpenRef.current).toBe(false);
  });

  it('handleToggleConsole flips open state, persists, and updates ref', () => {
    const { result } = renderHook(() =>
      useWorkflowConsole({ hasWebhookNode: false, pushConsoleLine: vi.fn() }),
    );
    act(() => result.current.handleToggleConsole());
    expect(result.current.consoleOpen).toBe(true);
    expect(result.current.consoleOpenRef.current).toBe(true);
    expect(sessionStorage.getItem('workflow_console_open')).toBe('true');
    act(() => result.current.handleToggleConsole());
    expect(result.current.consoleOpen).toBe(false);
    expect(sessionStorage.getItem('workflow_console_open')).toBe('false');
  });

  it('handleCloseConsole forces close', () => {
    const { result } = renderHook(() =>
      useWorkflowConsole({ hasWebhookNode: false, pushConsoleLine: vi.fn() }),
    );
    act(() => result.current.handleToggleConsole());
    act(() => result.current.handleCloseConsole());
    expect(result.current.consoleOpen).toBe(false);
    expect(result.current.consoleOpenRef.current).toBe(false);
  });

  it('setConsoleRunBehavior updates state and ref', () => {
    const { result } = renderHook(() =>
      useWorkflowConsole({ hasWebhookNode: false, pushConsoleLine: vi.fn() }),
    );
    act(() => result.current.setConsoleRunBehavior('append'));
    expect(result.current.consoleRunBehavior).toBe('append');
    expect(result.current.consoleRunBehaviorRef.current).toBe('append');
  });

  it('does not open SSE when console closed or no webhook node', () => {
    renderHook(() => useWorkflowConsole({ hasWebhookNode: false, pushConsoleLine: vi.fn() }));
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('opens SSE and pushes parsed lines when open + webhook present', () => {
    const push = vi.fn();
    sessionStorage.setItem('workflow_console_open', 'true');
    const { unmount } = renderHook(() =>
      useWorkflowConsole({ hasWebhookNode: true, pushConsoleLine: push }),
    );
    expect(FakeEventSource.instances).toHaveLength(1);
    const es = FakeEventSource.instances[0];
    es.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ text: 'hi', ts: 1 }) }));
    expect(push).toHaveBeenCalledWith({ text: 'hi', ts: 1 });
    // ignores malformed JSON
    es.onmessage?.(new MessageEvent('message', { data: 'not-json' }));
    expect(push).toHaveBeenCalledTimes(1);
    unmount();
    expect(es.closed).toBe(true);
  });

  it('invokes EventSource onerror without throwing', () => {
    const push = vi.fn();
    sessionStorage.setItem('workflow_console_open', 'true');
    const { unmount } = renderHook(() =>
      useWorkflowConsole({ hasWebhookNode: true, pushConsoleLine: push }),
    );
    const es = FakeEventSource.instances[0];
    expect(() => es.onerror?.({} as Event)).not.toThrow();
    unmount();
  });

  it('survives EventSource constructor throwing', () => {
    sessionStorage.setItem('workflow_console_open', 'true');
    vi.stubGlobal('EventSource', function () { throw new Error('boom'); });
    expect(() =>
      renderHook(() => useWorkflowConsole({ hasWebhookNode: true, pushConsoleLine: vi.fn() })),
    ).not.toThrow();
  });
});
