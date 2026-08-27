/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDemoWorkflowHarBridge } from './useDemoWorkflowHarBridge';

describe('useDemoWorkflowHarBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfTriggerHarImport;
  });

  it('exposes __wfTriggerHarImport on window after mount', () => {
    renderHook(() => useDemoWorkflowHarBridge(vi.fn()));
    expect((window as unknown as Record<string, unknown>).__wfTriggerHarImport).toBeTypeOf('function');
  });

  it('removes __wfTriggerHarImport from window on unmount', () => {
    const { unmount } = renderHook(() => useDemoWorkflowHarBridge(vi.fn()));
    unmount();
    expect((window as unknown as Record<string, unknown>).__wfTriggerHarImport).toBeUndefined();
  });

  it('calls onHarFileParsed with parsed result and fileName when valid HAR is injected', () => {
    const onParsed = vi.fn();
    renderHook(() => useDemoWorkflowHarBridge(onParsed));

    const harText = JSON.stringify({
      log: {
        version: '1.2',
        creator: { name: 'test', version: '1' },
        entries: [
          {
            startedDateTime: '2026-01-01T00:00:00.000Z',
            time: 10,
            request: {
              method: 'GET',
              url: 'https://api.example.com/users',
              httpVersion: 'HTTP/1.1',
              headers: [],
              queryString: [],
              cookies: [],
              headersSize: -1,
              bodySize: 0,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/1.1',
              headers: [],
              cookies: [],
              content: { mimeType: 'application/json', text: '{"id":1}' },
              redirectURL: '',
              headersSize: -1,
              bodySize: 8,
            },
            cache: {},
            timings: { send: 1, wait: 8, receive: 1 },
          },
        ],
      },
    });

    act(() => {
      const bridge = (window as unknown as Record<string, unknown>).__wfTriggerHarImport as
        | ((text: string, name?: string) => void)
        | undefined;
      bridge?.(harText, 'my-session.har');
    });

    expect(onParsed).toHaveBeenCalledOnce();
    const [result, fileName] = onParsed.mock.calls[0] as [{ entries: unknown[]; error?: string }, string];
    expect(fileName).toBe('my-session.har');
    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
  });

  it('calls onHarFileParsed with error result for invalid JSON', () => {
    const onParsed = vi.fn();
    renderHook(() => useDemoWorkflowHarBridge(onParsed));

    act(() => {
      const bridge = (window as unknown as Record<string, unknown>).__wfTriggerHarImport as
        | ((text: string, name?: string) => void)
        | undefined;
      bridge?.('not-json');
    });

    expect(onParsed).toHaveBeenCalledOnce();
    const [result] = onParsed.mock.calls[0] as [{ error?: string }, string];
    expect(result.error).toBeTruthy();
  });

  it('uses "demo-fixture.har" as default fileName when not provided', () => {
    const onParsed = vi.fn();
    renderHook(() => useDemoWorkflowHarBridge(onParsed));

    act(() => {
      const bridge = (window as unknown as Record<string, unknown>).__wfTriggerHarImport as
        | ((text: string, name?: string) => void)
        | undefined;
      bridge?.('{}');
    });

    expect(onParsed).toHaveBeenCalledOnce();
    const [, fileName] = onParsed.mock.calls[0] as [unknown, string];
    expect(fileName).toBe('demo-fixture.har');
  });
});
