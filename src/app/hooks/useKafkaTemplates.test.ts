/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useKafkaTemplates } from './useKafkaTemplates';
import type { KafkaPublishDraft, KafkaConsumeDraft } from '../../features/kafka/types';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../shared/kafka/kafkaStorage', () => ({
  loadKafkaPublishTemplates: vi.fn().mockResolvedValue([]),
  saveKafkaPublishTemplates: vi.fn().mockResolvedValue(undefined),
  loadKafkaConsumeTemplates: vi.fn().mockResolvedValue([]),
  saveKafkaConsumeTemplates: vi.fn().mockResolvedValue(undefined),
}));

import {
  loadKafkaPublishTemplates,
  saveKafkaPublishTemplates,
  loadKafkaConsumeTemplates,
  saveKafkaConsumeTemplates,
} from '@shared/kafka/kafkaStorage';

const mockLoadPub = loadKafkaPublishTemplates as ReturnType<typeof vi.fn>;
const mockSavePub = saveKafkaPublishTemplates as ReturnType<typeof vi.fn>;
const mockLoadCon = loadKafkaConsumeTemplates as ReturnType<typeof vi.fn>;
const mockSaveCon = saveKafkaConsumeTemplates as ReturnType<typeof vi.fn>;

// ── Test fixtures ──────────────────────────────────────────────────────────

const pubDraft: KafkaPublishDraft = {
  topic: 'orders.created',
  key: 'customer-123',
  partition: '',
  acks: -1,
  timeoutMs: '5000',
  headers: [],
  body: '{"orderId":"abc"}',
};

const conDraft: KafkaConsumeDraft = {
  topic: 'orders.created',
  groupId: 'redfireforge-debug-session-abc',
  startPosition: 'earliest',
  timeoutMs: '5000',
  maxMessages: '20',
  keyEquals: '',
  headerMatch: '',
  jsonPath: '',
  jsonPathEquals: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadPub.mockResolvedValue([]);
  mockSavePub.mockResolvedValue(undefined);
  mockLoadCon.mockResolvedValue([]);
  mockSaveCon.mockResolvedValue(undefined);
});

// ── Initial load ───────────────────────────────────────────────────────────

describe('useKafkaTemplates — initial load', () => {
  it('starts with templatesLoading = true and empty arrays', () => {
    // Don't await — check synchronous initial state
    mockLoadPub.mockReturnValue(new Promise(() => {})); // never resolves
    mockLoadCon.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useKafkaTemplates());
    expect(result.current.templatesLoading).toBe(true);
    expect(result.current.publishTemplates).toEqual([]);
    expect(result.current.consumeTemplates).toEqual([]);
  });

  it('calls loadKafkaPublishTemplates and loadKafkaConsumeTemplates on mount', async () => {
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));
    expect(mockLoadPub).toHaveBeenCalledTimes(1);
    expect(mockLoadCon).toHaveBeenCalledTimes(1);
  });

  it('populates templates from storage on mount', async () => {
    const storedPub = [{ id: 'p1', name: 'Pub Template', createdAt: '2026-06-05', draft: pubDraft }];
    const storedCon = [{ id: 'c1', name: 'Con Template', createdAt: '2026-06-05', draft: conDraft }];
    mockLoadPub.mockResolvedValue(storedPub);
    mockLoadCon.mockResolvedValue(storedCon);

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    expect(result.current.publishTemplates).toHaveLength(1);
    expect(result.current.publishTemplates[0].name).toBe('Pub Template');
    expect(result.current.consumeTemplates).toHaveLength(1);
    expect(result.current.consumeTemplates[0].name).toBe('Con Template');
  });

  it('sets templateError and clears loading when storage throws on mount', async () => {
    mockLoadPub.mockRejectedValue(new Error('Storage full'));

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));
    expect(result.current.templateError).toBe('Storage full');
  });
});

// ── savePublishTemplate ────────────────────────────────────────────────────

describe('savePublishTemplate', () => {
  it('appends new template and persists', async () => {
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.savePublishTemplate('My Template', pubDraft);
    });

    expect(result.current.publishTemplates).toHaveLength(1);
    expect(result.current.publishTemplates[0].name).toBe('My Template');
    expect(result.current.publishTemplates[0].draft).toEqual(pubDraft);
    expect(mockSavePub).toHaveBeenCalledTimes(1);
    const saved = mockSavePub.mock.calls[0][0];
    expect(saved[0].name).toBe('My Template');
  });

  it('assigns a unique id to each template', async () => {
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    // Must use separate act() calls so each save sees the updated state
    await act(async () => { await result.current.savePublishTemplate('First', pubDraft); });
    await act(async () => { await result.current.savePublishTemplate('Second', pubDraft); });

    const ids = result.current.publishTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('ignores blank name', async () => {
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.savePublishTemplate('   ', pubDraft);
    });

    expect(result.current.publishTemplates).toHaveLength(0);
    expect(mockSavePub).not.toHaveBeenCalled();
  });

  it('sets templateError when save throws', async () => {
    mockSavePub.mockRejectedValueOnce(new Error('QuotaExceededError'));
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    // Catch inside act so React can flush state updates from the catch block
    await act(async () => {
      try { await result.current.savePublishTemplate('Fails', pubDraft); } catch { /* expected */ }
    });

    expect(result.current.templateError).toBe('QuotaExceededError');
  });

  it('updates existing entry when saving with duplicate name (case-insensitive)', async () => {
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    const draftV1: KafkaPublishDraft = { ...pubDraft, body: '{"v":1}' };
    const draftV2: KafkaPublishDraft = { ...pubDraft, body: '{"v":2}' };
    await act(async () => { await result.current.savePublishTemplate('Orders Template', draftV1); });
    const originalId = result.current.publishTemplates[0].id;

    await act(async () => { await result.current.savePublishTemplate('orders template', draftV2); });

    expect(result.current.publishTemplates).toHaveLength(1);
    expect(result.current.publishTemplates[0].id).toBe(originalId);
    expect(result.current.publishTemplates[0].draft.body).toBe('{"v":2}');
  });
});

// ── loadPublishTemplate ────────────────────────────────────────────────────

describe('loadPublishTemplate', () => {
  it('returns draft for known id', async () => {
    const stored = [{ id: 'p1', name: 'Stored', createdAt: '2026-06-05', draft: pubDraft }];
    mockLoadPub.mockResolvedValue(stored);

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    const draft = result.current.loadPublishTemplate('p1');
    expect(draft).toEqual(pubDraft);
  });

  it('returns null for unknown id', async () => {
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    expect(result.current.loadPublishTemplate('does-not-exist')).toBeNull();
  });
});

// ── deletePublishTemplate ──────────────────────────────────────────────────

describe('deletePublishTemplate', () => {
  it('removes the template and persists', async () => {
    const stored = [
      { id: 'p1', name: 'Keep', createdAt: '2026-06-05', draft: pubDraft },
      { id: 'p2', name: 'Delete me', createdAt: '2026-06-05', draft: pubDraft },
    ];
    mockLoadPub.mockResolvedValue(stored);

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.deletePublishTemplate('p2');
    });

    expect(result.current.publishTemplates).toHaveLength(1);
    expect(result.current.publishTemplates[0].id).toBe('p1');
    const persisted = mockSavePub.mock.calls[0][0];
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe('p1');
  });

  it('sets templateError when delete throws', async () => {
    const stored = [{ id: 'p1', name: 'A', createdAt: '2026-06-05', draft: pubDraft }];
    mockLoadPub.mockResolvedValue(stored);
    mockSavePub.mockRejectedValueOnce(new Error('write failed'));

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      try { await result.current.deletePublishTemplate('p1'); } catch { /* expected */ }
    });

    expect(result.current.templateError).toBe('write failed');
  });
});

// ── saveConsumeTemplate ────────────────────────────────────────────────────

describe('saveConsumeTemplate', () => {
  it('appends new consume template and persists', async () => {
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.saveConsumeTemplate('Watch Topic', conDraft);
    });

    expect(result.current.consumeTemplates).toHaveLength(1);
    expect(result.current.consumeTemplates[0].name).toBe('Watch Topic');
    expect(mockSaveCon).toHaveBeenCalledTimes(1);
  });

  it('ignores blank name', async () => {
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.saveConsumeTemplate('', conDraft);
    });

    expect(result.current.consumeTemplates).toHaveLength(0);
    expect(mockSaveCon).not.toHaveBeenCalled();
  });

  it('sets templateError when save throws', async () => {
    mockSaveCon.mockRejectedValueOnce(new Error('disk full'));
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      try { await result.current.saveConsumeTemplate('Fails', conDraft); } catch { /* expected */ }
    });

    expect(result.current.templateError).toBe('disk full');
  });

  it('updates existing entry when saving with duplicate name (case-insensitive)', async () => {
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    const draftV1: KafkaConsumeDraft = { ...conDraft, maxMessages: '10' };
    const draftV2: KafkaConsumeDraft = { ...conDraft, maxMessages: '100' };
    await act(async () => { await result.current.saveConsumeTemplate('Watch Orders', draftV1); });
    const originalId = result.current.consumeTemplates[0].id;

    await act(async () => { await result.current.saveConsumeTemplate('WATCH ORDERS', draftV2); });

    expect(result.current.consumeTemplates).toHaveLength(1);
    expect(result.current.consumeTemplates[0].id).toBe(originalId);
    expect(result.current.consumeTemplates[0].draft.maxMessages).toBe('100');
  });
});

// ── loadConsumeTemplate ────────────────────────────────────────────────────

describe('loadConsumeTemplate', () => {
  it('returns draft (without groupId) for known id', async () => {
    const stored = [{ id: 'c1', name: 'Watch', createdAt: '2026-06-05', draft: conDraft }];
    mockLoadCon.mockResolvedValue(stored);

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    const draft = result.current.loadConsumeTemplate('c1');
    expect(draft).not.toBeNull();
    expect(draft!.topic).toBe('orders.created');
    // groupId must be stripped
    expect('groupId' in (draft ?? {})).toBe(false);
  });

  it('returns null for unknown id', async () => {
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));
    expect(result.current.loadConsumeTemplate('no-such-id')).toBeNull();
  });
});

// ── deleteConsumeTemplate ──────────────────────────────────────────────────

describe('deleteConsumeTemplate', () => {
  it('removes the consume template and persists', async () => {
    const stored = [
      { id: 'c1', name: 'Keep', createdAt: '2026-06-05', draft: conDraft },
      { id: 'c2', name: 'Remove', createdAt: '2026-06-05', draft: conDraft },
    ];
    mockLoadCon.mockResolvedValue(stored);

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.deleteConsumeTemplate('c2');
    });

    expect(result.current.consumeTemplates).toHaveLength(1);
    expect(result.current.consumeTemplates[0].id).toBe('c1');
    const persisted = mockSaveCon.mock.calls[0][0];
    expect(persisted).toHaveLength(1);
  });
});

// ── deleteConsumeTemplate error path ─────────────────────────────────────

describe('deleteConsumeTemplate — error path', () => {
  it('sets templateError when delete throws', async () => {
    const stored = [{ id: 'c1', name: 'A', createdAt: '2026-06-05', draft: conDraft }];
    mockLoadCon.mockResolvedValue(stored);
    mockSaveCon.mockRejectedValueOnce(new Error('consume delete failed'));

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      try { await result.current.deleteConsumeTemplate('c1'); } catch { /* expected */ }
    });

    expect(result.current.templateError).toBe('consume delete failed');
  });


});

// ── Non-Error thrown value (String branch) ────────────────────────────────

describe('non-Error thrown value — uses String() fallback', () => {
  it('savePublishTemplate: uses String(err) when a non-Error is thrown', async () => {
    mockSavePub.mockRejectedValueOnce('raw string thrown');
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      try { await result.current.savePublishTemplate('T', pubDraft); } catch { /* expected */ }
    });
    expect(result.current.templateError).toBe('raw string thrown');
  });

  it('deletePublishTemplate: uses String(err) when a non-Error is thrown', async () => {
    const stored = [{ id: 'p9', name: 'P', createdAt: '2026-06-05', draft: pubDraft }];
    mockLoadPub.mockResolvedValue(stored);
    mockSavePub.mockRejectedValueOnce(42);

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      try { await result.current.deletePublishTemplate('p9'); } catch { /* expected */ }
    });
    expect(result.current.templateError).toBe('42');
  });

  it('saveConsumeTemplate: uses String(err) when a non-Error is thrown', async () => {
    mockSaveCon.mockRejectedValueOnce({ code: 'QUOTA' });
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      try { await result.current.saveConsumeTemplate('C', conDraft); } catch { /* expected */ }
    });
    expect(result.current.templateError).toBe('[object Object]');
  });

  it('mount error: uses String(err) when load throws a non-Error', async () => {
    mockLoadPub.mockRejectedValueOnce('load-failed-string');
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));
    expect(result.current.templateError).toBe('load-failed-string');
  });

  it('deleteConsumeTemplate: uses String(err) when a non-Error is thrown', async () => {
    const stored = [{ id: 'c9', name: 'ConTemplate', createdAt: '2026-06-05', draft: conDraft }];
    mockLoadCon.mockResolvedValue(stored);
    mockSaveCon.mockRejectedValueOnce('not an Error object');

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      try { await result.current.deleteConsumeTemplate('c9'); } catch { /* expected */ }
    });
    expect(result.current.templateError).toBe('not an Error object');
  });
});

// ── Cleanup: cancelled flag on unmount ────────────────────────────────────

describe('cancelled flag on unmount during load', () => {
  it('does not update state if unmounted before load resolves', async () => {
    let resolvePub!: (v: unknown[]) => void;
    mockLoadPub.mockReturnValue(new Promise((r) => { resolvePub = r; }));

    const { result, unmount } = renderHook(() => useKafkaTemplates());
    // Still loading — unmount immediately
    unmount();
    // Now resolve after unmount — should be a no-op (no state update)
    await act(async () => { resolvePub([]); });
    // After unmount, state is frozen; just verify no errors thrown
    expect(result.current.publishTemplates).toEqual([]);
  });
});

// ── templateError cleared on success ─────────────────────────────────────

describe('templateError cleared on next successful operation', () => {
  it('clears templateError after a successful save', async () => {
    mockSavePub
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    // First call fails
    await act(async () => {
      try { await result.current.savePublishTemplate('A', pubDraft); } catch { /* expected */ }
    });
    expect(result.current.templateError).toBe('first fail');

    // Second call succeeds — error must clear
    await act(async () => {
      await result.current.savePublishTemplate('B', pubDraft);
    });
    expect(result.current.templateError).toBeNull();
  });
});

// ── removeTemplatesByNames + demo bridge ─────────────────────────────────

describe('removeTemplatesByNames', () => {
  it('removes matching publish and consume templates by name', async () => {
    mockLoadPub.mockResolvedValue([
      { id: 'p1', name: 'Orders Template', createdAt: '2026-06-05', draft: pubDraft },
      { id: 'p2', name: 'Keep Pub', createdAt: '2026-06-05', draft: pubDraft },
    ]);
    mockLoadCon.mockResolvedValue([
      { id: 'c1', name: 'Audit Consumer', createdAt: '2026-06-05', draft: conDraft },
      { id: 'c2', name: 'Keep Con', createdAt: '2026-06-05', draft: conDraft },
    ]);

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.removeTemplatesByNames(['Orders Template', 'Audit Consumer']);
    });

    expect(result.current.publishTemplates.map((t) => t.name)).toEqual(['Keep Pub']);
    expect(result.current.consumeTemplates.map((t) => t.name)).toEqual(['Keep Con']);
    expect(mockSavePub).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Keep Pub' }),
    ]);
    expect(mockSaveCon).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Keep Con' }),
    ]);
  });

  it('is a no-op when names are empty or nothing matches', async () => {
    mockLoadPub.mockResolvedValue([
      { id: 'p1', name: 'Keep', createdAt: '2026-06-05', draft: pubDraft },
    ]);
    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.removeTemplatesByNames([]);
      await result.current.removeTemplatesByNames(['Missing']);
    });

    expect(mockSavePub).not.toHaveBeenCalled();
    expect(mockSaveCon).not.toHaveBeenCalled();
    expect(result.current.publishTemplates).toHaveLength(1);
  });

  it('exposes __demoRemoveKafkaTemplatesByName bridge while mounted', async () => {
    mockLoadCon.mockResolvedValue([
      { id: 'c1', name: 'Audit Consumer', createdAt: '2026-06-05', draft: conDraft },
    ]);
    const { unmount } = renderHook(() => useKafkaTemplates());
    await waitFor(() => {
      expect(typeof (window as unknown as {
        __demoRemoveKafkaTemplatesByName?: (names: string[]) => Promise<void>;
      }).__demoRemoveKafkaTemplatesByName).toBe('function');
    });

    await act(async () => {
      await (window as unknown as {
        __demoRemoveKafkaTemplatesByName: (names: string[]) => Promise<void>;
      }).__demoRemoveKafkaTemplatesByName(['Audit Consumer']);
    });

    expect(mockSaveCon).toHaveBeenCalledWith([]);
    unmount();
    expect((window as unknown as {
      __demoRemoveKafkaTemplatesByName?: unknown;
    }).__demoRemoveKafkaTemplatesByName).toBeUndefined();
  });

  it('updates only publish templates when only publish names match', async () => {
    mockLoadPub.mockResolvedValue([
      { id: 'p1', name: 'Remove Pub', createdAt: '2026-06-05', draft: pubDraft },
      { id: 'p2', name: 'Keep Pub', createdAt: '2026-06-05', draft: pubDraft },
    ]);
    mockLoadCon.mockResolvedValue([
      { id: 'c1', name: 'Keep Con', createdAt: '2026-06-05', draft: conDraft },
    ]);

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.removeTemplatesByNames(['Remove Pub']);
    });

    expect(result.current.publishTemplates.map((t) => t.name)).toEqual(['Keep Pub']);
    expect(result.current.consumeTemplates.map((t) => t.name)).toEqual(['Keep Con']);
    expect(mockSavePub).toHaveBeenCalledTimes(1);
    expect(mockSaveCon).not.toHaveBeenCalled();
  });

  it('updates only consume templates when only consume names match', async () => {
    mockLoadPub.mockResolvedValue([
      { id: 'p1', name: 'Keep Pub', createdAt: '2026-06-05', draft: pubDraft },
    ]);
    mockLoadCon.mockResolvedValue([
      { id: 'c1', name: 'Remove Con', createdAt: '2026-06-05', draft: conDraft },
      { id: 'c2', name: 'Keep Con', createdAt: '2026-06-05', draft: conDraft },
    ]);

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      await result.current.removeTemplatesByNames(['Remove Con']);
    });

    expect(result.current.publishTemplates.map((t) => t.name)).toEqual(['Keep Pub']);
    expect(result.current.consumeTemplates.map((t) => t.name)).toEqual(['Keep Con']);
    expect(mockSavePub).not.toHaveBeenCalled();
    expect(mockSaveCon).toHaveBeenCalledTimes(1);
  });

  it('sets templateError when removeTemplatesByNames persistence fails', async () => {
    mockLoadPub.mockResolvedValue([
      { id: 'p1', name: 'Remove Pub', createdAt: '2026-06-05', draft: pubDraft },
      { id: 'p2', name: 'Keep Pub', createdAt: '2026-06-05', draft: pubDraft },
    ]);
    mockSavePub.mockRejectedValueOnce(new Error('remove failed'));

    const { result } = renderHook(() => useKafkaTemplates());
    await waitFor(() => expect(result.current.templatesLoading).toBe(false));

    await act(async () => {
      try {
        await result.current.removeTemplatesByNames(['Remove Pub']);
      } catch {
        // expected
      }
    });

    expect(result.current.templateError).toBe('remove failed');
  });
});
