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
});
