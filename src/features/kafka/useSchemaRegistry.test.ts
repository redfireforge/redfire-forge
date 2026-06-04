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
import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';

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
    vi.clearAllMocks();
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
});
