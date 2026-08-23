/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { TestRun } from '@shared/types';

const mockValidateTrace = vi.fn();
const mockValidateImportedRun = vi.fn();
const mockSaveTestRun = vi.fn();
const mockLoadTestRunsLite = vi.fn();

vi.mock('../../../shared/utils/traceCompression', () => ({
  validateTrace: (...args: unknown[]) => mockValidateTrace(...args),
}));
vi.mock('../utils/importRun', () => ({
  validateImportedRun: (...args: unknown[]) => mockValidateImportedRun(...args),
}));
vi.mock('../../../shared/utils/storage', () => ({
  saveTestRun: (...args: unknown[]) => mockSaveTestRun(...args),
  loadTestRunsLite: (...args: unknown[]) => mockLoadTestRunsLite(...args),
}));

import { useImportHandlers } from './useImportHandlers';

function fileEvent(content: string, name = 'f.json'): React.ChangeEvent<HTMLInputElement> {
  const file = new File([content], name, { type: 'application/json' });
  return {
    target: { files: [file], value: 'x' },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

function emptyEvent(): React.ChangeEvent<HTMLInputElement> {
  return { target: { files: [], value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
}

function setup() {
  const setAllRuns = vi.fn();
  const setSelectedRunId = vi.fn();
  const hook = renderHook(() => useImportHandlers(setAllRuns, setSelectedRunId));
  return { hook, setAllRuns, setSelectedRunId };
}

describe('useImportHandlers', () => {
  beforeEach(() => {
    mockValidateTrace.mockReset();
    mockValidateImportedRun.mockReset();
    mockSaveTestRun.mockReset();
    mockLoadTestRunsLite.mockReset();
  });

  it('initialises with no error or replay state', () => {
    const { hook } = setup();
    expect(hook.result.current.importError).toBeNull();
    expect(hook.result.current.showReplayModal).toBe(false);
    expect(hook.result.current.replayTrace).toBeNull();
  });

  it('ignores trace import with no file', () => {
    const { hook } = setup();
    act(() => hook.result.current.handleImportTrace(emptyEvent()));
    expect(hook.result.current.showReplayModal).toBe(false);
  });

  it('opens the replay modal for a valid trace', async () => {
    mockValidateTrace.mockReturnValue({ id: 'trace-1' });
    const { hook } = setup();
    act(() => hook.result.current.handleImportTrace(fileEvent('{"a":1}', 'trace.json')));
    await waitFor(() => expect(hook.result.current.showReplayModal).toBe(true));
    expect(hook.result.current.replayTrace).toEqual({ id: 'trace-1' });
    expect(hook.result.current.importedFileName).toBe('trace.json');
  });

  it('sets an error when trace parsing fails', async () => {
    mockValidateTrace.mockImplementation(() => { throw new Error('bad trace'); });
    const { hook } = setup();
    act(() => hook.result.current.handleImportTrace(fileEvent('{"a":1}')));
    await waitFor(() => expect(hook.result.current.importError).toBe('bad trace'));
  });

  it('falls back to a generic message when a trace throws a non-Error', async () => {
    mockValidateTrace.mockImplementation(() => { throw 'oops'; });
    const { hook } = setup();
    act(() => hook.result.current.handleImportTrace(fileEvent('{"a":1}')));
    await waitFor(() => expect(hook.result.current.importError).toBe('Failed to parse trace file'));
  });

  it('sets an error when the FileReader fails to read the trace', async () => {
    const RealFileReader = globalThis.FileReader;
    class ErroringFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText() {
        // simulate an async read failure
        queueMicrotask(() => this.onerror?.());
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.FileReader = ErroringFileReader as any;
    try {
      const { hook } = setup();
      act(() => hook.result.current.handleImportTrace(fileEvent('{"a":1}', 'trace.json')));
      await waitFor(() => expect(hook.result.current.importError).toBe('Failed to read file'));
      expect(hook.result.current.showReplayModal).toBe(false);
    } finally {
      globalThis.FileReader = RealFileReader;
    }
  });

  it('ignores run import with no file', async () => {
    const { hook, setAllRuns } = setup();
    await act(async () => { await hook.result.current.handleImportRun(emptyEvent()); });
    expect(setAllRuns).not.toHaveBeenCalled();
  });

  it('imports a valid run and selects it', async () => {
    const run = { id: 'run-9' } as TestRun;
    mockValidateImportedRun.mockReturnValue({ valid: true, run });
    mockSaveTestRun.mockResolvedValue({ ok: true });
    mockLoadTestRunsLite.mockResolvedValue([run]);
    const { hook, setAllRuns, setSelectedRunId } = setup();
    await act(async () => { await hook.result.current.handleImportRun(fileEvent('{"run":1}')); });
    expect(setAllRuns).toHaveBeenCalledWith([run]);
    expect(setSelectedRunId).toHaveBeenCalledWith('run-9');
    expect(hook.result.current.importError).toBeNull();
  });

  it('reports a validation error for an invalid run', async () => {
    mockValidateImportedRun.mockReturnValue({ valid: false, error: 'nope' });
    const { hook } = setup();
    await act(async () => { await hook.result.current.handleImportRun(fileEvent('{}')); });
    expect(hook.result.current.importError).toBe('Import failed: nope');
  });

  it('reports a quota error when saving fails with quota', async () => {
    mockValidateImportedRun.mockReturnValue({ valid: true, run: { id: 'r' } });
    mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });
    const { hook } = setup();
    await act(async () => { await hook.result.current.handleImportRun(fileEvent('{}')); });
    expect(hook.result.current.importError).toContain('quota');
  });

  it('reports a generic save error', async () => {
    mockValidateImportedRun.mockReturnValue({ valid: true, run: { id: 'r' } });
    mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: false });
    const { hook } = setup();
    await act(async () => { await hook.result.current.handleImportRun(fileEvent('{}')); });
    expect(hook.result.current.importError).toBe('Failed to save imported run');
  });

  it('catches parse exceptions during run import', async () => {
    const { hook } = setup();
    const badEvent = {
      target: { files: [{ name: 'f', text: () => Promise.resolve('not-json') }], value: '' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    await act(async () => { await hook.result.current.handleImportRun(badEvent); });
    expect(hook.result.current.importError).toBeTruthy();
  });

  it('falls back to a generic message when a run throws a non-Error', async () => {
    const { hook } = setup();
    const badEvent = {
      target: { files: [{ name: 'f', text: () => Promise.reject('boom') }], value: '' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    await act(async () => { await hook.result.current.handleImportRun(badEvent); });
    expect(hook.result.current.importError).toBe('Failed to parse run file');
  });

  it('closes the replay modal and clears state', () => {
    const { hook } = setup();
    act(() => hook.result.current.setShowReplayModal(true));
    act(() => hook.result.current.closeReplayModal());
    expect(hook.result.current.showReplayModal).toBe(false);
    expect(hook.result.current.replayTrace).toBeNull();
    expect(hook.result.current.importedFileName).toBeNull();
  });

  it('auto-dismisses the import error after a timeout', async () => {
    vi.useFakeTimers();
    const { hook } = setup();
    act(() => hook.result.current.setImportError('temp'));
    expect(hook.result.current.importError).toBe('temp');
    act(() => { vi.advanceTimersByTime(6000); });
    expect(hook.result.current.importError).toBeNull();
    vi.useRealTimers();
  });
});
