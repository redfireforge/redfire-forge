import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  purgeGrpcDemoSavedRequests,
  purgeEmptyGrpcDemoCollectionsByName,
} from './grpcDemoCollectionsCleanup';

vi.mock('../data/grpcCollectionRepository', () => ({
  runGrpcCollectionMutation: vi.fn(),
}));

import { runGrpcCollectionMutation } from '../data/grpcCollectionRepository';

const mockMutate = runGrpcCollectionMutation as ReturnType<typeof vi.fn>;

function makeStore(collections: { name: string; savedRequests: unknown[] }[]) {
  return {
    collections: collections.map((c) => ({ ...c, updatedAt: '2024-01-01T00:00:00.000Z' })),
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

type Store = ReturnType<typeof makeStore>;
type StoreMutator = (store: Store) => { store: Store; result: unknown };

/** Capture and execute the mutator the same way the real repository does */
function invokeMutator(store: Store): Store {
  const [mutator] = mockMutate.mock.calls[mockMutate.mock.calls.length - 1] as [StoreMutator];
  const { store: next } = mutator(store);
  return next;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMutate.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// purgeGrpcDemoSavedRequests
// ---------------------------------------------------------------------------

describe('purgeGrpcDemoSavedRequests', () => {
  it('removes saved requests from all collections and returns correct counts', async () => {
    const store = makeStore([
      { name: 'Col A', savedRequests: [{ id: '1' }, { id: '2' }] },
      { name: 'Col B', savedRequests: [{ id: '3' }] },
    ]);

    const result = await purgeGrpcDemoSavedRequests();

    expect(mockMutate).toHaveBeenCalledOnce();
    const next = invokeMutator(store);

    expect(next.collections[0].savedRequests).toEqual([]);
    expect(next.collections[1].savedRequests).toEqual([]);
    expect(next.updatedAt).not.toBe('2024-01-01T00:00:00.000Z');

    // Return value reflects what was removed from the store at call time
    expect(result).toEqual({ savedRequestsRemoved: 0, collectionsTouched: 0 });
  });

  it('updates savedRequestsRemoved and collectionsTouched counts', async () => {
    const store = makeStore([
      { name: 'Col A', savedRequests: [{ id: '1' }, { id: '2' }] },
      { name: 'Col B', savedRequests: [{ id: '3' }] },
      { name: 'Col C', savedRequests: [] },
    ]);

    mockMutate.mockImplementation(async (mutator: StoreMutator) => {
      mutator(store);
    });

    const result = await purgeGrpcDemoSavedRequests();

    expect(result.savedRequestsRemoved).toBe(3);
    expect(result.collectionsTouched).toBe(2);
  });

  it('leaves collections with no saved requests unchanged', async () => {
    const store = makeStore([
      { name: 'Empty', savedRequests: [] },
    ]);

    mockMutate.mockImplementation(async (mutator: StoreMutator) => {
      mutator(store);
    });

    const result = await purgeGrpcDemoSavedRequests();

    expect(result.savedRequestsRemoved).toBe(0);
    expect(result.collectionsTouched).toBe(0);
  });

  it('returns unchanged store reference when nothing changed', async () => {
    const store = makeStore([{ name: 'A', savedRequests: [] }]);
    let capturedStore: Store | null = null;

    mockMutate.mockImplementation(async (mutator: StoreMutator) => {
      const { store: out } = mutator(store);
      capturedStore = out;
    });

    await purgeGrpcDemoSavedRequests();
    // When nothing changed, mutator returns base unchanged
    expect(capturedStore).toBe(store);
  });

  it('updates updatedAt on the store when changes occurred', async () => {
    const store = makeStore([{ name: 'A', savedRequests: [{ id: 'x' }] }]);
    let capturedStore: Store | null = null;

    mockMutate.mockImplementation(async (mutator: StoreMutator) => {
      const { store: out } = mutator(store);
      capturedStore = out;
    });

    await purgeGrpcDemoSavedRequests();
    expect(capturedStore!.updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
  });

  it('calls runGrpcCollectionMutation exactly once', async () => {
    mockMutate.mockResolvedValue(undefined);
    await purgeGrpcDemoSavedRequests();
    expect(mockMutate).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// purgeEmptyGrpcDemoCollectionsByName
// ---------------------------------------------------------------------------

describe('purgeEmptyGrpcDemoCollectionsByName', () => {
  it('removes matching empty collections', async () => {
    const store = makeStore([
      { name: 'Demo A', savedRequests: [] },
      { name: 'Demo B', savedRequests: [] },
      { name: 'Keep Me', savedRequests: [] },
    ]);

    let capturedStore: Store | null = null;
    mockMutate.mockImplementation(async (mutator: StoreMutator) => {
      const { store: out } = mutator(store);
      capturedStore = out;
    });

    const result = await purgeEmptyGrpcDemoCollectionsByName(['Demo A', 'Demo B']);

    expect(result.collectionsRemoved).toBe(2);
    expect(capturedStore!.collections).toHaveLength(1);
    expect(capturedStore!.collections[0].name).toBe('Keep Me');
  });

  it('does not remove non-empty collections even if name matches', async () => {
    const store = makeStore([
      { name: 'Demo A', savedRequests: [{ id: '1' }] },
    ]);

    let capturedStore: Store | null = null;
    mockMutate.mockImplementation(async (mutator: StoreMutator) => {
      const { store: out } = mutator(store);
      capturedStore = out;
    });

    const result = await purgeEmptyGrpcDemoCollectionsByName(['Demo A']);

    expect(result.collectionsRemoved).toBe(0);
    expect(capturedStore!.collections).toHaveLength(1);
  });

  it('returns early with 0 removed when collectionNames is empty', async () => {
    const result = await purgeEmptyGrpcDemoCollectionsByName([]);
    expect(result.collectionsRemoved).toBe(0);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('returns early with 0 removed when all names are whitespace', async () => {
    const result = await purgeEmptyGrpcDemoCollectionsByName(['  ', '\t', '']);
    expect(result.collectionsRemoved).toBe(0);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('trims whitespace from collection names before matching', async () => {
    const store = makeStore([
      { name: 'Demo A', savedRequests: [] },
    ]);

    mockMutate.mockImplementation(async (mutator: StoreMutator) => {
      mutator(store);
    });

    const result = await purgeEmptyGrpcDemoCollectionsByName(['  Demo A  ']);
    expect(result.collectionsRemoved).toBe(1);
  });

  it('returns unchanged store reference when nothing was removed', async () => {
    const store = makeStore([{ name: 'Other', savedRequests: [] }]);
    let capturedStore: Store | null = null;

    mockMutate.mockImplementation(async (mutator: StoreMutator) => {
      const { store: out } = mutator(store);
      capturedStore = out;
    });

    const result = await purgeEmptyGrpcDemoCollectionsByName(['Demo A']);
    expect(result.collectionsRemoved).toBe(0);
    expect(capturedStore).toBe(store);
  });

  it('updates updatedAt when collections are removed', async () => {
    const store = makeStore([{ name: 'Demo A', savedRequests: [] }]);
    let capturedStore: Store | null = null;

    mockMutate.mockImplementation(async (mutator: StoreMutator) => {
      const { store: out } = mutator(store);
      capturedStore = out;
    });

    await purgeEmptyGrpcDemoCollectionsByName(['Demo A']);
    expect(capturedStore!.updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
  });

  it('handles a mix of matching and non-matching names', async () => {
    const store = makeStore([
      { name: 'Alpha', savedRequests: [] },
      { name: 'Beta', savedRequests: [] },
      { name: 'Gamma', savedRequests: [{ id: '1' }] },
    ]);

    mockMutate.mockImplementation(async (mutator: StoreMutator) => {
      mutator(store);
    });

    const result = await purgeEmptyGrpcDemoCollectionsByName(['Alpha', 'Gamma']);
    // Gamma has saved requests so it's not removed; only Alpha is
    expect(result.collectionsRemoved).toBe(1);
  });

  it('calls runGrpcCollectionMutation exactly once when there are valid names', async () => {
    const store = makeStore([]);
    mockMutate.mockImplementation(async (mutator: StoreMutator) => {
      mutator(store);
    });

    await purgeEmptyGrpcDemoCollectionsByName(['Demo A']);
    expect(mockMutate).toHaveBeenCalledOnce();
  });
});
