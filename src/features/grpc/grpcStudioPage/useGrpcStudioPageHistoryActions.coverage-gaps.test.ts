/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../../shared/grpc/contractFixtures';
import type { GrpcCallHistoryEntryV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import { createGrpcSavedRequestFromSnapshot } from '../../../shared/grpc/grpcSavedRequest';
import * as grpcApiClient from '../../../shared/grpc/grpcApiClient';
import * as grpcAuthPolicy from '../../../shared/grpc/grpcAuthPolicy';
import * as grpcStudioExecute from '../../../shared/grpc/grpcStudioExecuteInterpolation';
import { createEmptyTabDescriptorState, createGrpcStudioTab } from '../grpcStudioTypes';
import * as callHistoryCapture from '../utils/grpcStudioCallHistoryCapture';
import * as grpcGrpcurl from '../utils/grpcGrpcurl';
import { useGrpcStudioPageHistoryActions } from './useGrpcStudioPageHistoryActions';

const TS = '2026-07-01T00:00:00.000Z';
let grpcurlSnapshotSpy: ReturnType<typeof vi.spyOn>;

function makeHistoryEntry(
  overrides: Partial<GrpcCallHistoryEntryV1> = {},
): GrpcCallHistoryEntryV1 {
  const tab = createGrpcStudioTab({ descriptorKey: FIXTURE_DESCRIPTOR_KEY });
  return {
    id: 'hist-1',
    callType: 'unary',
    target: FIXTURE_UNARY_CALL_REQUEST.target.address,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    capturedAt: TS,
    bodyTruncated: false,
    record: {
      capturedAt: TS,
      snapshot: {
        tabId: tab.id,
        requestId: 'req-hist',
        capturedAt: TS,
        callType: 'unary',
        target: structuredClone(FIXTURE_UNARY_CALL_REQUEST.target),
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'from-history' },
        metadata: { authorization: '***' },
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
    },
    ...overrides,
  };
}

function makeSavedRequest() {
  const tab = createGrpcStudioTab({ descriptorKey: FIXTURE_DESCRIPTOR_KEY });
  return createGrpcSavedRequestFromSnapshot(
    {
      tabId: tab.id,
      requestId: 'req-saved',
      capturedAt: TS,
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'saved' },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    },
    { id: 'sr-1', revisionId: 'rev-1', updatedAt: TS },
  );
}

function makeOptions(overrides: Record<string, unknown> = {}) {
  const tab = createGrpcStudioTab({
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    metadata: { authorization: 'live-token' },
  });
  const updateTab = vi.fn();
  const onNavigate = vi.fn();
  const applySchemaDiffComparison = vi.fn();
  const setActiveFeatureTab = vi.fn();
  const replayHistoryEntry = vi.fn(() => ({ tabId: tab.id }));
  const collections = {
    buildSavedRequestSchemaCompareIntent: vi.fn(() => ({ keysDiffer: true, baselineDescriptorKey: 'baseline-key' })),
    compareSavedRequestSchema: vi.fn(async () => ({ changes: [], summary: { total: 0, breaking: 0, nonBreaking: 0, informational: 0 } })),
    detectHistoryDescriptorDrift: vi.fn(() => ({ baselineDescriptorKey: 'baseline-key' })),
    buildHistoryDescriptorDriftReport: vi.fn(async () => ({ changes: [], summary: { total: 0, breaking: 0, nonBreaking: 0, informational: 0 } })),
  };
  const callHistory = { entries: [makeHistoryEntry({ id: 'hist-sibling', capturedAt: '2026-07-01T00:00:05.000Z' })] };

  return {
    studio: {
      activeTab: tab,
      activeTabDescriptor: {
        ...createEmptyTabDescriptorState(),
        descriptor: FIXTURE_DESCRIPTOR,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      profiles: [],
      updateTab,
    },
    envVarMap: { authorization: 'env-token', 'x-trace': 'trace-1' },
    workspaceDefaults: { grpcHost: 'localhost:50051' },
    pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' as const },
    collections,
    callHistory,
    advancedFeatures: { applySchemaDiffComparison, setActiveFeatureTab },
    replayActions: { replayHistoryEntry },
    onNavigate,
    ...overrides,
  };
}

describe('useGrpcStudioPageHistoryActions coverage gaps', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(grpcApiClient, 'postGrpcDescriptorLookup').mockResolvedValue({
      ok: true,
      op: 'descriptor_lookup',
      data: FIXTURE_DESCRIPTOR,
      meta: { requestId: 'lookup-1', timestamp: TS },
    });
    vi.spyOn(callHistoryCapture, 'getRuntimeGrpcHistoryMetadata').mockReturnValue(undefined);
    grpcurlSnapshotSpy = vi.spyOn(grpcGrpcurl, 'buildGrpcurlInvokeCommandFromSnapshot');
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('no-ops schema diff helpers without active descriptor key', async () => {
    const options = makeOptions();
    options.studio.activeTab.descriptorKey = '';
    options.studio.activeTabDescriptor.descriptor = undefined;
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    await act(async () => {
      await result.current.compareSavedRequestSchemaInAdvanced(makeSavedRequest());
      await result.current.openHistorySchemaDiff(makeHistoryEntry());
    });

    expect(options.onNavigate).not.toHaveBeenCalled();
  });

  it('opens advanced schema diff for saved requests and history entries', async () => {
    const options = makeOptions();
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    await act(async () => {
      await result.current.compareSavedRequestSchemaInAdvanced(makeSavedRequest());
      await result.current.openHistorySchemaDiff(makeHistoryEntry());
    });

    expect(options.advancedFeatures.applySchemaDiffComparison).toHaveBeenCalledTimes(2);
    expect(options.onNavigate).toHaveBeenCalledWith('advanced');
    expect(options.advancedFeatures.setActiveFeatureTab).toHaveBeenCalledWith('schema_diff');
  });

  it('swallows schema diff failures and descriptor lookup cache hits', async () => {
    const options = makeOptions();
    options.collections.buildSavedRequestSchemaCompareIntent.mockReturnValueOnce({ keysDiffer: false });
    options.collections.buildHistoryDescriptorDriftReport.mockResolvedValueOnce(null);
    vi.spyOn(grpcApiClient, 'postGrpcDescriptorLookup').mockRejectedValueOnce(new Error('lookup failed'));

    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    await act(async () => {
      await result.current.compareSavedRequestSchemaInAdvanced(makeSavedRequest());
      await result.current.openHistorySchemaDiff(makeHistoryEntry());
      await result.current.compareSavedRequestSchemaInAdvanced(makeSavedRequest());
    });

    expect(options.advancedFeatures.applySchemaDiffComparison).not.toHaveBeenCalled();
  });

  it('builds grpcurl commands and restores metadata from siblings/runtime/env', async () => {
    vi.mocked(callHistoryCapture.getRuntimeGrpcHistoryMetadata).mockImplementation((id) => (
      id === 'hist-1'
        ? { authorization: 'runtime-token' }
        : { authorization: 'sibling-token' }
    ));

    const entry = makeHistoryEntry({
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeHistoryEntry().record.snapshot,
          metadata: { authorization: '***', 'x-trace': '***' },
          auth: { type: 'bearer', bearerToken: '***' },
        },
      },
    });
    const options = makeOptions({
      callHistory: {
        entries: [
          entry,
          makeHistoryEntry({
            id: 'hist-sibling',
            capturedAt: '2026-07-01T00:00:05.000Z',
          }),
        ],
      },
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    const grpcurl = result.current.grpcurlForHistoryEntry(entry);
    expect(grpcurl).toContain('grpcurl');
    expect(grpcurl.toLowerCase()).toMatch(/authorization|runtime-token|sibling-token|env-token|live-token/);

    const savedGrpcurl = result.current.grpcurlForSaved(makeSavedRequest());
    expect(savedGrpcurl).toContain('grpcurl');

    act(() => {
      result.current.replayHistoryEntryWithRestoredMetadata(entry);
    });
    expect(options.replayActions.replayHistoryEntry).toHaveBeenCalledWith(entry);
    expect(options.studio.updateTab).toHaveBeenCalled();
  });

  it('falls back to snapshot grpcurl export when replay resolution fails', () => {
    const options = makeOptions();
    options.studio.activeTab.service = '';
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    const entry = makeHistoryEntry();
    const grpcurl = result.current.grpcurlForHistoryEntry(entry);
    expect(grpcurl).toContain('grpcurl');
  });

  it('merges redacted metadata from replay, runtime, active tab, and env candidates', () => {
    const entry = makeHistoryEntry({
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeHistoryEntry().record.snapshot,
          metadata: {
            authorization: '***',
            'x-trace': '***',
            'X-Custom-Header': '***',
          },
        },
      },
    });
    const options = makeOptions({
      envVarMap: {
        authorization: 'env-auth',
        x_custom_header: 'env-custom',
        XTRACE: 'env-trace',
      },
      studio: {
        ...makeOptions().studio,
        activeTab: createGrpcStudioTab({
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          metadata: { authorization: 'active-auth', 'x-trace': 'active-trace' },
        }),
      },
      callHistory: { entries: [] },
    });
    vi.mocked(callHistoryCapture.getRuntimeGrpcHistoryMetadata).mockReturnValue({
      authorization: 'runtime-auth',
    });

    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    const grpcurl = result.current.grpcurlForHistoryEntry(entry);
    expect(grpcurl).toContain('grpcurl');
    expect(grpcurl).toMatch(/runtime-auth|active-auth|env-auth/);
  });

  it('sanitizes redacted auth types for grpcurl export', () => {
    const options = makeOptions();
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    const cases = [
      { type: 'basic', basicPassword: '***' },
      { type: 'api_key', apiKeyValue: '***' },
      { type: 'oauth2', oauth2: { clientSecret: '***', tokenUrl: 'https://auth', clientId: 'id' } },
      { type: 'digest', username: 'user' },
    ] as const;

    for (const auth of cases) {
      const entry = makeHistoryEntry({
        record: {
          capturedAt: TS,
          snapshot: {
            ...makeHistoryEntry().record.snapshot,
            auth: auth as never,
          },
        },
      });
      expect(result.current.grpcurlForHistoryEntry(entry)).toContain('grpcurl');
    }
  });

  it('uses active tab metadata when execute resolution fails', () => {
    vi.spyOn(grpcStudioExecute, 'resolveGrpcStudioTabFieldsForExecute').mockImplementation(() => {
      throw new Error('resolve failed');
    });
    const options = makeOptions({
      studio: {
        ...makeOptions().studio,
        activeTab: createGrpcStudioTab({
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          metadata: { 'x-fallback': 'from-tab' },
        }),
      },
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    const entry = makeHistoryEntry({
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeHistoryEntry().record.snapshot,
          metadata: { 'x-fallback': 'from-tab' },
        },
      },
    });
    expect(result.current.grpcurlForHistoryEntry(entry)).toContain('grpcurl');
  });

  it('skips replay metadata merge when replay binding throws', () => {
    const options = makeOptions({
      studio: {
        ...makeOptions().studio,
        activeTab: createGrpcStudioTab({ descriptorKey: '', service: '', method: '' }),
      },
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    const entry = makeHistoryEntry();
    expect(result.current.grpcurlForHistoryEntry(entry)).toContain('grpcurl');
  });

  it('does not update tab metadata when replay binding is missing', () => {
    const options = makeOptions({
      replayActions: { replayHistoryEntry: vi.fn(() => undefined) },
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    act(() => {
      result.current.replayHistoryEntryWithRestoredMetadata(makeHistoryEntry());
    });
    expect(options.studio.updateTab).not.toHaveBeenCalled();
  });

  it('returns early when schema compare keys match and history drift is absent', async () => {
    const options = makeOptions();
    options.collections.buildSavedRequestSchemaCompareIntent.mockReturnValueOnce({ keysDiffer: false });
    options.collections.detectHistoryDescriptorDrift.mockReturnValueOnce(null);
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    await act(async () => {
      await result.current.compareSavedRequestSchemaInAdvanced(makeSavedRequest());
      await result.current.openHistorySchemaDiff(makeHistoryEntry());
    });
    expect(options.advancedFeatures.applySchemaDiffComparison).not.toHaveBeenCalled();
  });

  it('reuses descriptor lookup cache across schema diff calls', async () => {
    const lookupSpy = vi.spyOn(grpcApiClient, 'postGrpcDescriptorLookup');
    const options = makeOptions();
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    await act(async () => {
      await result.current.compareSavedRequestSchemaInAdvanced(makeSavedRequest());
      await result.current.compareSavedRequestSchemaInAdvanced(makeSavedRequest());
    });
    expect(lookupSpy.mock.calls.length).toBeGreaterThan(0);
  });

  it('resolves sibling runtime metadata for redacted history keys', () => {
    const entry = makeHistoryEntry({
      id: 'hist-target',
      capturedAt: '2026-07-01T00:00:00.000Z',
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeHistoryEntry().record.snapshot,
          metadata: { authorization: '***', 'x-trace': '***' },
        },
      },
    });
    const sibling = makeHistoryEntry({
      id: 'hist-sibling',
      capturedAt: '2026-07-01T00:00:10.000Z',
    });
    vi.mocked(callHistoryCapture.getRuntimeGrpcHistoryMetadata).mockImplementation((id) => (
      id === 'hist-sibling'
        ? { authorization: 'sibling-auth', 'x-trace': 'sibling-trace' }
        : undefined
    ));
    const options = makeOptions({ callHistory: { entries: [entry, sibling] } });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    expect(result.current.grpcurlForHistoryEntry(entry)).toContain('grpcurl');
  });

  it('copies text to clipboard best-effort', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(makeOptions() as never));

    await act(async () => {
      await result.current.copyTextToClipboard('hello');
    });

    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('merges metadata via replay-only path when history/active/runtime are absent', () => {
    const entry = makeHistoryEntry({
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeHistoryEntry().record.snapshot,
          metadata: {},
        },
      },
    });
    const options = makeOptions({
      studio: {
        ...makeOptions().studio,
        activeTab: createGrpcStudioTab({ descriptorKey: FIXTURE_DESCRIPTOR_KEY, metadata: {} }),
      },
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    result.current.grpcurlForHistoryEntry(entry);
    const call = grpcurlSnapshotSpy.mock.calls.at(-1)?.[0] as { metadata?: Record<string, string> };
    expect(call.metadata).toEqual({});
  });

  it('merges metadata without redaction loop when history metadata is missing', () => {
    const entry = makeHistoryEntry({
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeHistoryEntry().record.snapshot,
          metadata: undefined as never,
        },
      },
    });
    vi.mocked(callHistoryCapture.getRuntimeGrpcHistoryMetadata).mockReturnValue({ 'x-trace': 'runtime' });
    const options = makeOptions({
      studio: {
        ...makeOptions().studio,
        activeTab: createGrpcStudioTab({ descriptorKey: FIXTURE_DESCRIPTOR_KEY, metadata: {} }),
      },
      envVarMap: {},
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    result.current.grpcurlForHistoryEntry(entry);
    const call = grpcurlSnapshotSpy.mock.calls.at(-1)?.[0] as { metadata?: Record<string, string> };
    expect(call.metadata?.['x-trace']).toBe('runtime');
  });

  it('restores redacted metadata from runtime and active tab fallbacks', () => {
    const entry = makeHistoryEntry({
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeHistoryEntry().record.snapshot,
          metadata: { authorization: '***', 'x-custom': '***' },
        },
      },
    });
    const options = makeOptions({
      envVarMap: { xcustom: 'env-custom' },
      studio: {
        ...makeOptions().studio,
        activeTab: createGrpcStudioTab({
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          metadata: { 'x-custom': 'active-custom' },
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
        }),
      },
      callHistory: { entries: [entry] },
    });
    vi.mocked(callHistoryCapture.getRuntimeGrpcHistoryMetadata).mockReturnValue({
      authorization: 'runtime-auth',
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    result.current.grpcurlForHistoryEntry(entry);
    expect(grpcurlSnapshotSpy).toHaveBeenCalled();
    const call = grpcurlSnapshotSpy.mock.calls.at(-1)?.[0] as { metadata?: Record<string, string> };
    expect(call.metadata?.authorization ?? call.metadata?.Authorization).toBeTruthy();
  });

  it('resolves env candidate keys for redacted custom headers', () => {
    const entry = makeHistoryEntry({
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeHistoryEntry().record.snapshot,
          metadata: { authorization: '***' },
        },
      },
    });
    const options = makeOptions({
      envVarMap: { authorization: 'env-header-value' },
      studio: {
        ...makeOptions().studio,
        activeTab: createGrpcStudioTab({
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          metadata: {},
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
        }),
      },
      callHistory: { entries: [entry] },
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    result.current.grpcurlForHistoryEntry(entry);
    expect(grpcurlSnapshotSpy).toHaveBeenCalled();
    const call = grpcurlSnapshotSpy.mock.calls.at(-1)?.[0] as { metadata?: Record<string, string> };
    expect(call.metadata?.authorization).toBeTruthy();
  });

  it('swallows schema compare failures from compareSavedRequestSchema', async () => {
    const options = makeOptions();
    options.collections.compareSavedRequestSchema.mockRejectedValueOnce(new Error('compare failed'));
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    await act(async () => {
      await result.current.compareSavedRequestSchemaInAdvanced(makeSavedRequest());
    });
    expect(options.advancedFeatures.applySchemaDiffComparison).not.toHaveBeenCalled();
  });

  it('swallows history schema diff failures from drift report builder', async () => {
    const options = makeOptions();
    options.collections.buildHistoryDescriptorDriftReport.mockRejectedValueOnce(new Error('drift failed'));
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    await act(async () => {
      await result.current.openHistorySchemaDiff(makeHistoryEntry());
    });
    expect(options.advancedFeatures.applySchemaDiffComparison).not.toHaveBeenCalled();
  });

  it('resolves sibling runtime metadata until all redacted keys are filled', () => {
    const entry = makeHistoryEntry({
      id: 'hist-target',
      capturedAt: '2026-07-01T00:00:00.000Z',
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeHistoryEntry().record.snapshot,
          metadata: { authorization: '***', 'x-trace': '***' },
        },
      },
    });
    const siblingNear = makeHistoryEntry({
      id: 'hist-sibling-near',
      capturedAt: '2026-07-01T00:00:01.000Z',
    });
    const siblingFar = makeHistoryEntry({
      id: 'hist-sibling-far',
      capturedAt: '2026-07-01T00:00:20.000Z',
    });
    vi.spyOn(callHistoryCapture, 'getRuntimeGrpcHistoryMetadata').mockImplementation((id) => {
      if (id === 'hist-sibling-near') return { authorization: 'near-auth' };
      if (id === 'hist-sibling-far') return { 'x-trace': 'far-trace' };
      return undefined;
    });
    const options = makeOptions({
      callHistory: { entries: [entry, siblingFar, siblingNear] },
      studio: {
        ...makeOptions().studio,
        activeTab: createGrpcStudioTab({
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          metadata: {},
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
        }),
      },
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    result.current.grpcurlForHistoryEntry(entry);
    expect(grpcurlSnapshotSpy).toHaveBeenCalled();
    expect(callHistoryCapture.getRuntimeGrpcHistoryMetadata).toHaveBeenCalled();
    const call = grpcurlSnapshotSpy.mock.calls.at(-1)?.[0] as { metadata?: Record<string, string> };
    expect(call.metadata?.authorization).toBeTruthy();
    expect(call.metadata?.['x-trace']).toBeTruthy();
  });

  it('sanitizes inherit and none auth types for grpcurl export', () => {
    const options = makeOptions();
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    for (const auth of [{ type: 'none' as const }, { type: 'inherit' as const }]) {
      const entry = makeHistoryEntry({
        record: {
          capturedAt: TS,
          snapshot: {
            ...makeHistoryEntry().record.snapshot,
            auth,
          },
        },
      });
      result.current.grpcurlForHistoryEntry(entry);
    }

    expect(grpcurlSnapshotSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('copies text to clipboard on success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(makeOptions() as never));
    await act(async () => {
      await result.current.copyTextToClipboard('copied');
    });
    expect(writeText).toHaveBeenCalledWith('copied');
  });

  it('reuses descriptor lookup cache while opening history schema diff', async () => {
    const lookupSpy = vi.spyOn(grpcApiClient, 'postGrpcDescriptorLookup');
    const options = makeOptions();
    options.collections.buildHistoryDescriptorDriftReport.mockImplementation(async (
      _entry,
      _key,
      resolveDescriptor,
    ) => {
      await resolveDescriptor('baseline-key');
      return { changes: [], summary: { total: 0, breaking: 0, nonBreaking: 0, informational: 0 } };
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    await act(async () => {
      await result.current.openHistorySchemaDiff(makeHistoryEntry());
    });
    expect(lookupSpy.mock.calls.length).toBe(1);
  });

  it('reuses descriptor lookup cache while comparing saved request schema', async () => {
    const lookupSpy = vi.spyOn(grpcApiClient, 'postGrpcDescriptorLookup');
    const options = makeOptions();
    options.collections.compareSavedRequestSchema.mockImplementation(async (
      _saved,
      _key,
      resolveDescriptor,
    ) => {
      await resolveDescriptor('baseline-key');
      return { changes: [], summary: { total: 0, breaking: 0, nonBreaking: 0, informational: 0 } };
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    await act(async () => {
      await result.current.compareSavedRequestSchemaInAdvanced(makeSavedRequest());
    });
    expect(lookupSpy.mock.calls.length).toBe(1);
  });

  it('restores metadata through replayHistoryEntryWithRestoredMetadata for each merge source', () => {
    const options = makeOptions({
      envVarMap: { authorization: 'env-auth', 'x-trace': 'env-trace' },
      studio: {
        ...makeOptions().studio,
        activeTab: createGrpcStudioTab({
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          metadata: { 'x-trace': 'active-trace' },
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
        }),
      },
    });
    vi.spyOn(callHistoryCapture, 'getRuntimeGrpcHistoryMetadata').mockReturnValue({ authorization: 'runtime-auth' });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    const entry = makeHistoryEntry({
      record: {
        capturedAt: TS,
        snapshot: {
          ...makeHistoryEntry().record.snapshot,
          metadata: { authorization: '***', 'x-trace': '***' },
          auth: {
            type: 'basic',
            username: 'user',
            basicPassword: 'visible-password',
          },
        },
      },
    });

    act(() => {
      result.current.replayHistoryEntryWithRestoredMetadata(entry);
    });
    expect(options.studio.updateTab).toHaveBeenCalledWith(
      options.studio.activeTab.id,
      expect.objectContaining({
        metadata: expect.objectContaining({
          authorization: 'runtime-auth',
          'x-trace': 'active-trace',
        }),
      }),
    );
  });

  it('keeps visible api_key and oauth2 auth in grpcurl success path', () => {
    const options = makeOptions();
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));
    const cases = [
      { type: 'api_key', apiKeyName: 'x-api-key', apiKeyValue: 'visible-key', apiKeyLocation: 'header' as const },
      { type: 'oauth2', oauth2: { tokenUrl: 'https://auth', clientId: 'id', clientSecret: 'visible-secret' } },
      { type: 'digest', username: 'digest-user' },
    ] as const;

    for (const auth of cases) {
      const entry = makeHistoryEntry({
        record: {
          capturedAt: TS,
          snapshot: {
            ...makeHistoryEntry().record.snapshot,
            auth: auth as never,
          },
        },
      });
      result.current.grpcurlForHistoryEntry(entry);
    }

    expect(grpcurlSnapshotSpy.mock.calls.length).toBeGreaterThanOrEqual(cases.length);
  });

  it('rejects empty descriptor keys passed to resolveDescriptor callbacks', async () => {
    const options = makeOptions();
    options.collections.compareSavedRequestSchema.mockImplementation(async (
      _saved,
      _key,
      resolveDescriptor,
    ) => {
      await expect(resolveDescriptor('')).rejects.toThrow(/Descriptor key is required/i);
      return { changes: [], summary: { total: 0, breaking: 0, nonBreaking: 0, informational: 0 } };
    });
    options.collections.buildHistoryDescriptorDriftReport.mockImplementation(async (
      _entry,
      _key,
      resolveDescriptor,
    ) => {
      await expect(resolveDescriptor('   ')).rejects.toThrow(/Descriptor key is required/i);
      return { changes: [], summary: { total: 0, breaking: 0, nonBreaking: 0, informational: 0 } };
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    await act(async () => {
      await result.current.compareSavedRequestSchemaInAdvanced(makeSavedRequest());
      await result.current.openHistorySchemaDiff(makeHistoryEntry());
    });

    expect(options.advancedFeatures.applySchemaDiffComparison).toHaveBeenCalledTimes(2);
  });

  it('falls back to active tab metadata when execute resolution throws', () => {
    vi.spyOn(grpcStudioExecute, 'resolveGrpcStudioTabFieldsForExecute').mockImplementation(() => {
      throw new Error('resolve failed');
    });
    const options = makeOptions({
      studio: {
        ...makeOptions().studio,
        activeTab: createGrpcStudioTab({
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          metadata: { 'x-fallback': 'active-meta' },
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
        }),
      },
    });
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    act(() => {
      result.current.replayHistoryEntryWithRestoredMetadata(makeHistoryEntry());
    });

    expect(options.studio.updateTab).toHaveBeenCalledWith(
      options.studio.activeTab.id,
      expect.objectContaining({
        metadata: expect.objectContaining({ 'x-fallback': 'active-meta' }),
      }),
    );
  });

  it('uses resolved metadata when prepareGrpcExecuteRequestMetadata returns null', () => {
    vi.spyOn(grpcStudioExecute, 'resolveGrpcStudioTabFieldsForExecute').mockReturnValue({
      metadata: { authorization: 'resolved-meta' },
      auth: { type: 'none' },
      body: {},
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
    } as never);
    vi.spyOn(grpcAuthPolicy, 'prepareGrpcExecuteRequestMetadata').mockReturnValue(undefined as never);
    const options = makeOptions();
    const { result } = renderHook(() => useGrpcStudioPageHistoryActions(options as never));

    result.current.grpcurlForHistoryEntry(makeHistoryEntry());
    const call = grpcurlSnapshotSpy.mock.calls.at(-1)?.[0] as { metadata?: Record<string, string> };
    expect(call.metadata?.authorization).toBe('resolved-meta');
  });
});
