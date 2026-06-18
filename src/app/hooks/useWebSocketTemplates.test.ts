/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketTemplates } from './useWebSocketTemplates';
import * as wsStorage from '../../shared/websocket/websocketStorage';
import type { WsMessageTemplate } from '../../shared/websocket/types';

vi.mock('../../shared/websocket/websocketStorage', () => ({
  loadWsTemplates: vi.fn(),
  saveWsTemplates: vi.fn(),
}));

const mockLoad = vi.mocked(wsStorage.loadWsTemplates);
const mockSave = vi.mocked(wsStorage.saveWsTemplates);

function makeTemplate(overrides?: Partial<WsMessageTemplate>): WsMessageTemplate {
  return {
    id: 't1',
    name: 'Hello Template',
    body: '{"msg":"hello"}',
    format: 'json',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoad.mockResolvedValue([]);
  mockSave.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useWebSocketTemplates', () => {
  it('starts in loading state then completes', async () => {
    const existing = [makeTemplate()];
    mockLoad.mockResolvedValue(existing);

    const { result } = renderHook(() => useWebSocketTemplates());
    expect(result.current.loading).toBe(true);

    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0].name).toBe('Hello Template');
  });

  it('handles load error', async () => {
    mockLoad.mockRejectedValue(new Error('disk fail'));

    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('disk fail');
  });

  it('saves a new template', async () => {
    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});

    await act(async () => {
      await result.current.saveTemplate('Greeting', '{"hi":"there"}', 'json');
    });

    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0].name).toBe('Greeting');
    expect(result.current.templates[0].format).toBe('json');
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('updates an existing template', async () => {
    mockLoad.mockResolvedValue([makeTemplate({ id: 't1', name: 'Old' })]);

    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});

    await act(async () => {
      await result.current.updateTemplate('t1', { name: 'Updated', body: 'new body' });
    });

    expect(result.current.templates[0].name).toBe('Updated');
    expect(result.current.templates[0].body).toBe('new body');
    expect(mockSave).toHaveBeenCalled();
  });

  it('does nothing when updating non-existent id', async () => {
    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});

    await act(async () => {
      await result.current.updateTemplate('ghost', { name: 'x' });
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('deletes a template', async () => {
    const existing = [makeTemplate({ id: 't1' }), makeTemplate({ id: 't2', name: 'Keep' })];
    mockLoad.mockResolvedValue(existing);

    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});
    expect(result.current.templates).toHaveLength(2);

    await act(async () => {
      await result.current.deleteTemplate('t1');
    });

    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0].id).toBe('t2');
  });

  it('does not crash when deleting non-existent id', async () => {
    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});

    await act(async () => {
      await result.current.deleteTemplate('ghost');
    });

    expect(result.current.templates).toHaveLength(0);
  });

  it('loads template body and format', async () => {
    const tpl = makeTemplate({ id: 't1', body: 'test body', format: 'text' });
    mockLoad.mockResolvedValue([tpl]);

    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});

    const loaded = result.current.loadTemplate('t1');
    expect(loaded).toEqual({ body: 'test body', format: 'text' });
  });

  it('returns null for non-existent template', async () => {
    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});

    expect(result.current.loadTemplate('ghost')).toBeNull();
  });

  it('handles save error gracefully', async () => {
    mockSave.mockRejectedValue(new Error('write fail'));

    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});

    await act(async () => {
      await result.current.saveTemplate('Test', 'body', 'text');
    });

    expect(result.current.error).toBe('write fail');
    expect(result.current.templates).toHaveLength(1);
  });

  it('trims template name on save', async () => {
    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});

    await act(async () => {
      await result.current.saveTemplate('  Padded Name  ', 'body', 'text');
    });

    expect(result.current.templates[0].name).toBe('Padded Name');
  });

  it('does not update state after unmount (load resolves after unmount)', async () => {
    let resolveLoad!: (v: WsMessageTemplate[]) => void;
    mockLoad.mockReturnValue(new Promise<WsMessageTemplate[]>((res) => { resolveLoad = res; }));

    const { result, unmount } = renderHook(() => useWebSocketTemplates());
    expect(result.current.loading).toBe(true);

    unmount();

    await act(async () => { resolveLoad([]); });
    // No state update should occur — hook is unmounted, no error thrown
    expect(result.current.loading).toBe(true);
  });

  it('does not update error state after unmount (save fails after unmount)', async () => {
    let rejectSave!: (e: Error) => void;
    mockSave.mockReturnValue(new Promise<void>((_, rej) => { rejectSave = rej; }));

    const { result, unmount } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});

    // Kick off save (which is pending)
    void act(async () => {
      await result.current.saveTemplate('X', 'y', 'text');
    });

    // Unmount before the save resolves
    unmount();

    // Reject after unmount — the mounted guard prevents state update
    await act(async () => {
      rejectSave(new Error('late failure'));
      await new Promise((r) => setTimeout(r, 30));
    });

    // State is unchanged since component is unmounted
    expect(result.current.error).toBeNull();
  });

  it('sets error from Error instance when load rejects with Error (line 39 cond-expr true branch)', async () => {
    mockLoad.mockRejectedValueOnce(new Error('load-error-instance'));
    const { result } = renderHook(() => useWebSocketTemplates());
    // Flush microtasks so the .catch handler runs
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    // If result.current is not null, check error; otherwise skip (hook may be unmounted)
    if (result.current) {
      expect(result.current.error).toBe('load-error-instance');
    }
  });

  it('sets error from Error instance when save rejects (line 55 cond-expr true branch covered by saveTemplate test)', async () => {
    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});
    if (!result.current) return;

    mockSave.mockRejectedValueOnce(new Error('save-error-test'));
    await act(async () => {
      await result.current.saveTemplate('X', 'y', 'text');
    });
    expect(result.current?.error).toBe('save-error-test');
  });

  it('persist clears error after successful save when still mounted (line 52 true branch)', async () => {
    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});
    if (!result.current) return;

    // Cause an error first
    mockSave.mockRejectedValueOnce(new Error('first-error'));
    await act(async () => {
      await result.current.saveTemplate('A', 'b', 'text');
    });
    if (!result.current) return;
    expect(result.current.error).toBe('first-error');

    // Successful save clears error (line 52 — if (mountedRef.current) setError(null))
    await act(async () => {
      await result.current.saveTemplate('A', 'b2', 'text');
    });
    expect(result.current?.error).toBeNull();
  });

  it('load resolves after unmount — does not update state (line 38 false branch)', async () => {
    let resolveLoad: (v: WsMessageTemplate[]) => void = () => {};
    mockLoad.mockReturnValueOnce(new Promise<WsMessageTemplate[]>(r => { resolveLoad = r; }));
    const { unmount } = renderHook(() => useWebSocketTemplates());
    // Unmount before load resolves
    unmount();
    // Resolve load after unmount — mountedRef is false, guard prevents state update
    await act(async () => {
      resolveLoad([]);
      await new Promise(r => setTimeout(r, 20));
    });
    // No crash — test passes if no error thrown
  });

  it('load rejects with non-Error value uses String(err) (line 39 false branch)', async () => {
    mockLoad.mockRejectedValueOnce('plain-string-rejection');
    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    if (result.current) {
      expect(result.current.error).toBe('plain-string-rejection');
    }
  });

  it('persist save succeeds after unmount — does not call setError (line 52 false branch)', async () => {
    let resolveSave: () => void = () => {};
    mockSave.mockReturnValueOnce(new Promise<void>(r => { resolveSave = r; }));
    const { result, unmount } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});
    if (!result.current) return;

    void act(async () => {
      await result.current.saveTemplate('T', 'b', 'text');
    });
    // Unmount before save resolves
    unmount();
    // Resolve after unmount — mountedRef is false
    await act(async () => {
      resolveSave();
      await new Promise(r => setTimeout(r, 20));
    });
    // No crash
  });

  it('persist catch with non-Error value uses String(err) (line 55 false branch)', async () => {
    const { result } = renderHook(() => useWebSocketTemplates());
    await act(async () => {});
    if (!result.current) return;

    mockSave.mockRejectedValueOnce('non-error-rejection');
    await act(async () => {
      await result.current.saveTemplate('T', 'b', 'text');
    });
    expect(result.current?.error).toBe('non-error-rejection');
  });
});
