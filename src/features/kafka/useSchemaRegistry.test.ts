/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useSchemaRegistry,
  deriveSchemaFormat,
  type SchemaVersionDetail,
} from './useSchemaRegistry';
import type { UseKafkaStateReturn } from '@app/hooks/useKafkaState';

function makeKafkaState(overrides?: Partial<UseKafkaStateReturn>): UseKafkaStateReturn {
  return {
    loaded: true,
    clusters: [{ clusterId: 'test', name: 'test', brokers: 'localhost:9092', authMode: 'none' }],
    selectedClusterId: 'test',
    selectedCluster: null,
    connection: { state: 'connected', clusterId: 'test' } as UseKafkaStateReturn['connection'],
    topics: [],
    topicsLoading: false,
    topicsError: null,
    includeInternalTopics: false,
    lastError: null,
    lastErrorDetail: null,
    statusPollFailureStreak: 0,
    autoConnectOnStartup: false,
    setAutoConnectOnStartup: vi.fn(),
    setIncludeInternalTopics: vi.fn(),
    setSelectedClusterId: vi.fn(),
    upsertCluster: vi.fn(),
    removeCluster: vi.fn(),
    replaceClusters: vi.fn(),
    connectSelectedCluster: vi.fn(),
    disconnectActiveCluster: vi.fn(),
    testSelectedClusterConnection: vi.fn(),
    refreshConnectionStatus: vi.fn(),
    refreshTopics: vi.fn(),
    setConnectionState: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  } as unknown as UseKafkaStateReturn;
}

function makeSchemaDetail(overrides?: Partial<SchemaVersionDetail>): SchemaVersionDetail {
  return {
    subject: 'orders.created-value',
    version: 1,
    id: 1,
    schema: '{"type":"record","name":"OrderCreated","fields":[]}',
    schemaType: 'AVRO',
    ...overrides,
  };
}

describe('useSchemaRegistry', () => {
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetAllMocks();
    mockDispatch = vi.fn();
  });

  it('initial state: empty subjects, registryConfig with empty URL', () => {
    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    expect(result.current.registryConfig).toEqual({ registryUrl: '' });
    expect(result.current.subjects).toEqual([]);
    expect(result.current.subjectsLoading).toBe(false);
    expect(result.current.subjectsError).toBeNull();
    expect(result.current.hasLoadedOnce).toBe(false);
    expect(result.current.filter).toBe('');
    expect(result.current.filteredSubjects).toEqual([]);
    expect(result.current.selectedSubject).toBeNull();
    expect(result.current.versions).toEqual([]);
    expect(result.current.selectedVersion).toBeNull();
    expect(result.current.schemaDetail).toBeNull();
  });

  it('loadSubjects success → populates subjects', async () => {
    mockDispatch.mockResolvedValueOnce({
      data: { subjects: ['orders.created-value', 'payments.settled-value'] },
    });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => {
      result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' });
    });

    await act(async () => {
      await result.current.loadSubjects();
    });

    expect(mockDispatch).toHaveBeenCalledWith('schema-subjects', {
      schemaConfig: { registryUrl: 'http://localhost:8085' },
    });
    expect(result.current.subjects).toEqual([
      { name: 'orders.created-value' },
      { name: 'payments.settled-value' },
    ]);
    expect(result.current.hasLoadedOnce).toBe(true);
  });

  it('loadSubjects error → subjectsError set', async () => {
    mockDispatch.mockRejectedValueOnce(new Error('Connection refused'));

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => {
      result.current.setRegistryConfig({ registryUrl: 'http://bad-host:9999' });
    });

    await act(async () => {
      await result.current.loadSubjects();
    });

    expect(result.current.subjectsError).not.toBeNull();
    expect(result.current.subjectsError!.message).toContain('Connection refused');
    expect(result.current.subjects).toEqual([]);
  });

  it('selectSubject fires versions load, auto-selects latest, fires schema-fetch', async () => {
    mockDispatch
      .mockResolvedValueOnce({
        data: { subjects: ['orders.created-value'] },
      })
      .mockResolvedValueOnce({
        data: { subject: 'orders.created-value', versions: [1, 2, 3] },
      })
      .mockResolvedValueOnce({
        data: makeSchemaDetail({ version: 3 }),
      });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => {
      result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' });
    });
    await act(async () => {
      await result.current.loadSubjects();
    });

    act(() => { result.current.selectSubject('orders.created-value'); });

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledTimes(3);
    });

    expect(result.current.versions).toEqual([1, 2, 3]);
    expect(result.current.selectedVersion).toBe(3);
    expect(mockDispatch).toHaveBeenCalledWith('schema-versions', expect.objectContaining({
      subject: 'orders.created-value',
    }));
    expect(mockDispatch).toHaveBeenCalledWith('schema-fetch', expect.objectContaining({
      subject: 'orders.created-value',
      version: 3,
    }));
  });

  it('selectSubject auto-selects the highest version even when the list is unsorted', async () => {
    mockDispatch
      .mockResolvedValueOnce({
        data: { subjects: ['orders.created-value'] },
      })
      .mockResolvedValueOnce({
        data: { subject: 'orders.created-value', versions: [3, 1, 2] },
      })
      .mockResolvedValueOnce({
        data: makeSchemaDetail({ version: 3 }),
      });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => {
      result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' });
    });
    await act(async () => {
      await result.current.loadSubjects();
    });

    act(() => { result.current.selectSubject('orders.created-value'); });

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledTimes(3);
    });

    expect(result.current.selectedVersion).toBe(3);
    expect(mockDispatch).toHaveBeenCalledWith('schema-fetch', expect.objectContaining({
      subject: 'orders.created-value',
      version: 3,
    }));
  });

  it('selectSubject clears previous versions, selectedVersion, schemaDetail', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['a', 'b'] } })
      .mockResolvedValueOnce({ data: { subject: 'a', versions: [1] } })
      .mockResolvedValueOnce({ data: makeSchemaDetail({ subject: 'a', version: 1 }) })
      .mockResolvedValueOnce({ data: { subject: 'b', versions: [1, 2] } })
      .mockResolvedValueOnce({ data: makeSchemaDetail({ subject: 'b', version: 2 }) });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    act(() => { result.current.selectSubject('a'); });
    await waitFor(() => {
      expect(result.current.schemaDetail).not.toBeNull();
    });

    expect(result.current.versions).toEqual([1]);
    expect(result.current.selectedVersion).toBe(1);

    act(() => { result.current.selectSubject('b'); });
    await waitFor(() => {
      expect(result.current.selectedVersion).toBe(2);
    });

    expect(result.current.versions).toEqual([1, 2]);
    expect(result.current.selectedSubject).toBe('b');
  });

  it('selectVersion fires schema-fetch for chosen version', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['x'] } })
      .mockResolvedValueOnce({ data: { subject: 'x', versions: [1, 2] } })
      .mockResolvedValueOnce({ data: makeSchemaDetail({ subject: 'x', version: 2 }) })
      .mockResolvedValueOnce({ data: makeSchemaDetail({ subject: 'x', version: 1 }) });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    act(() => { result.current.selectSubject('x'); });
    await waitFor(() => {
      expect(result.current.selectedVersion).toBe(2);
    });

    act(() => { result.current.selectVersion(1); });
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledTimes(4);
    });

    expect(result.current.selectedVersion).toBe(1);
    expect(mockDispatch).toHaveBeenLastCalledWith('schema-fetch', expect.objectContaining({
      subject: 'x',
      version: 1,
    }));
  });

  it('selectVersion error → schemaError set', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['x'] } })
      .mockResolvedValueOnce({ data: { subject: 'x', versions: [1, 2] } })
      .mockResolvedValueOnce({ data: makeSchemaDetail({ subject: 'x', version: 2 }) })
      .mockRejectedValueOnce(new Error('Schema not found'));

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    act(() => { result.current.selectSubject('x'); });
    await waitFor(() => {
      expect(result.current.selectedVersion).toBe(2);
    });

    act(() => { result.current.selectVersion(1); });
    await waitFor(() => {
      expect(result.current.schemaError).not.toBeNull();
    });

    expect(result.current.schemaError!.message).toContain('Schema not found');
  });

  it('auth both empty → auth omitted from dispatch body', async () => {
    mockDispatch.mockResolvedValueOnce({ data: { subjects: [] } });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => {
      result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' });
    });

    await act(async () => {
      await result.current.loadSubjects();
    });

    expect(mockDispatch).toHaveBeenCalledWith('schema-subjects', {
      schemaConfig: { registryUrl: 'http://localhost:8085' },
    });
    const callArgs = mockDispatch.mock.calls[0][1];
    expect(callArgs.schemaConfig.auth).toBeUndefined();
  });

  it('auth partially filled → auth included', async () => {
    mockDispatch.mockResolvedValueOnce({ data: { subjects: [] } });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => {
      result.current.setRegistryConfig({
        registryUrl: 'http://localhost:8085',
        auth: { username: 'admin', password: '' },
      });
    });

    await act(async () => {
      await result.current.loadSubjects();
    });

    const callArgs = mockDispatch.mock.calls[0][1];
    expect(callArgs.schemaConfig.auth).toEqual({ username: 'admin', password: '' });
  });

  it('injectable dispatch called instead of default', async () => {
    const customDispatch = vi.fn().mockResolvedValue({ data: { subjects: ['custom'] } });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: customDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => {
      await result.current.loadSubjects();
    });

    expect(customDispatch).toHaveBeenCalledTimes(1);
    expect(result.current.subjects).toEqual([{ name: 'custom' }]);
  });

  it('setFilter("orders") → filteredSubjects narrows to matching subjects', async () => {
    mockDispatch.mockResolvedValueOnce({
      data: { subjects: ['orders.created-value', 'payments.settled-value', 'orders.updated-key'] },
    });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    act(() => { result.current.setFilter('orders'); });

    expect(result.current.filteredSubjects).toHaveLength(2);
    expect(result.current.filteredSubjects.map((s) => s.name)).toEqual([
      'orders.created-value',
      'orders.updated-key',
    ]);
  });

  it('setFilter("") → filteredSubjects equals full subjects list', async () => {
    mockDispatch.mockResolvedValueOnce({
      data: { subjects: ['a', 'b', 'c'] },
    });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    act(() => { result.current.setFilter('a'); });
    expect(result.current.filteredSubjects).toHaveLength(1);

    act(() => { result.current.setFilter(''); });
    expect(result.current.filteredSubjects).toHaveLength(3);
  });

  it('filter is case-insensitive substring match', async () => {
    mockDispatch.mockResolvedValueOnce({
      data: { subjects: ['Orders.Created-VALUE', 'PAYMENTS.settled'] },
    });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    act(() => { result.current.setFilter('orders'); });
    expect(result.current.filteredSubjects).toHaveLength(1);
    expect(result.current.filteredSubjects[0].name).toBe('Orders.Created-VALUE');

    act(() => { result.current.setFilter('PAYMENTS'); });
    expect(result.current.filteredSubjects).toHaveLength(1);
    expect(result.current.filteredSubjects[0].name).toBe('PAYMENTS.settled');
  });

  it('loadSubjects error → fix URL → retry succeeds, clears error', async () => {
    mockDispatch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ data: { subjects: ['ok-subject'] } });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://bad:9999' }));
    await act(async () => { await result.current.loadSubjects(); });
    expect(result.current.subjectsError).not.toBeNull();

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    expect(result.current.subjectsError).toBeNull();
    expect(result.current.subjects).toEqual([{ name: 'ok-subject' }]);
    expect(result.current.hasLoadedOnce).toBe(true);
  });
});

describe('deriveSchemaFormat', () => {
  it('AVRO schemaType → avro', () => {
    expect(deriveSchemaFormat('AVRO')).toBe('avro');
  });
  it('PROTOBUF schemaType → protobuf', () => {
    expect(deriveSchemaFormat('PROTOBUF')).toBe('protobuf');
  });
  it('JSON schemaType → json-schema', () => {
    expect(deriveSchemaFormat('JSON')).toBe('json-schema');
  });
  it('missing schemaType + avro content → avro', () => {
    expect(deriveSchemaFormat(undefined, '{"type":"record","name":"Foo","fields":[]}')).toBe('avro');
  });
  it('missing schemaType + protobuf content → protobuf', () => {
    expect(deriveSchemaFormat(undefined, 'syntax = "proto3";\nmessage Foo {}')).toBe('protobuf');
  });
  it('missing schemaType + json-schema content → json-schema', () => {
    expect(deriveSchemaFormat(undefined, '{"$schema":"http://json-schema.org/draft-07/schema#"}')).toBe('json-schema');
  });
  it('missing schemaType + no content → undefined', () => {
    expect(deriveSchemaFormat(undefined, undefined)).toBeUndefined();
  });
  it('missing schemaType + valid JSON object without $schema or type=record → undefined', () => {
    expect(deriveSchemaFormat(undefined, '{"type":"object","properties":{}}')).toBeUndefined();
  });
  it('unknown schemaType + no content → undefined', () => {
    expect(deriveSchemaFormat('XML', undefined)).toBeUndefined();
  });
});

describe('useSchemaRegistry — additional branch coverage', () => {
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetAllMocks();
    mockDispatch = vi.fn();
  });

  it('loadSubjects: no-op when registryUrl is empty', async () => {
    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );
    // registryUrl defaults to '' — loadSubjects should return immediately
    await act(async () => {
      await result.current.loadSubjects();
    });
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(result.current.subjectsLoading).toBe(false);
  });

  it('selectSubject(null): clears state without dispatching', async () => {
    mockDispatch.mockResolvedValueOnce({ data: { subjects: ['a'] } });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    // Select something first
    mockDispatch.mockResolvedValueOnce({ data: { subject: 'a', versions: [1] } });
    mockDispatch.mockResolvedValueOnce({ data: makeSchemaDetail({ subject: 'a', version: 1 }) });
    act(() => { result.current.selectSubject('a'); });
    await waitFor(() => expect(result.current.selectedSubject).toBe('a'));

    // Now de-select
    const callsBefore = mockDispatch.mock.calls.length;
    act(() => { result.current.selectSubject(null); });

    expect(result.current.selectedSubject).toBeNull();
    expect(result.current.versions).toEqual([]);
    expect(result.current.selectedVersion).toBeNull();
    expect(mockDispatch.mock.calls.length).toBe(callsBefore); // no new dispatch for null
  });

  it('selectSubject: empty versions list → no auto-select, no schema-fetch', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['empty-topic'] } })
      .mockResolvedValueOnce({ data: { subject: 'empty-topic', versions: [] } });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    act(() => { result.current.selectSubject('empty-topic'); });
    await waitFor(() => expect(result.current.versionsLoading).toBe(false));

    expect(result.current.versions).toEqual([]);
    expect(result.current.selectedVersion).toBeNull();
    expect(mockDispatch).toHaveBeenCalledTimes(2); // no schema-fetch call
  });

  it('selectSubject: versions dispatch error → versionsError set', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['bad-topic'] } })
      .mockRejectedValueOnce(new Error('Versions fetch failed'));

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    act(() => { result.current.selectSubject('bad-topic'); });
    await waitFor(() => expect(result.current.versionsError).not.toBeNull());

    expect(result.current.versionsError!.message).toContain('Versions fetch failed');
    expect(result.current.versionsLoading).toBe(false);
  });

  it('selectVersion(null): clears selectedVersion without dispatching', async () => {
    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => { result.current.selectVersion(null); });

    expect(result.current.selectedVersion).toBeNull();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('selectVersion: no-op dispatch when selectedSubject is null', async () => {
    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    // selectedSubject is null by default → setting a version should not dispatch
    act(() => { result.current.selectVersion(1); });

    expect(result.current.selectedVersion).toBe(1);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('fetchSchemaForVersion: skips format update when detail is null', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['x'] } })
      .mockResolvedValueOnce({ data: { subject: 'x', versions: [1] } })
      .mockResolvedValueOnce({ data: null }); // schema-fetch returns null detail

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    act(() => { result.current.selectSubject('x'); });
    await waitFor(() => expect(result.current.schemaLoading).toBe(false));

    expect(result.current.schemaDetail).toBeNull();
    // Format should not be set on subject since detail was null
    expect(result.current.subjects[0].format).toBeUndefined();
  });

  it('auth with password-only → auth block included in dispatch', async () => {
    mockDispatch.mockResolvedValueOnce({ data: { subjects: [] } });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => {
      result.current.setRegistryConfig({
        registryUrl: 'http://localhost:8085',
        auth: { username: '', password: 'secret' },
      });
    });

    await act(async () => { await result.current.loadSubjects(); });

    const callArgs = mockDispatch.mock.calls[0][1];
    expect(callArgs.schemaConfig.auth).toEqual({ username: '', password: 'secret' });
  });

  it('schema fetch error → schemaError set, schemaDetail null, schemaLoading cleared', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['y'] } })
      .mockResolvedValueOnce({ data: { subject: 'y', versions: [1] } })
      .mockRejectedValueOnce(new Error('Schema fetch network error'));

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    act(() => { result.current.selectSubject('y'); });
    await waitFor(() => expect(result.current.schemaError).not.toBeNull());

    expect(result.current.schemaError!.message).toContain('Schema fetch network error');
    expect(result.current.schemaDetail).toBeNull();
    expect(result.current.schemaLoading).toBe(false);
  });

  it('schema format is derived and attached to subject when detail.schemaType is set', async () => {
    mockDispatch
      .mockResolvedValueOnce({ data: { subjects: ['z'] } })
      .mockResolvedValueOnce({ data: { subject: 'z', versions: [1] } })
      .mockResolvedValueOnce({ data: makeSchemaDetail({ subject: 'z', version: 1, schemaType: 'JSON' }) });

    const { result } = renderHook(() =>
      useSchemaRegistry(makeKafkaState(), { dispatch: mockDispatch }),
    );

    act(() => result.current.setRegistryConfig({ registryUrl: 'http://localhost:8085' }));
    await act(async () => { await result.current.loadSubjects(); });

    act(() => { result.current.selectSubject('z'); });
    await waitFor(() => expect(result.current.schemaDetail).not.toBeNull());

    expect(result.current.subjects[0].format).toBe('json-schema');
  });
});
