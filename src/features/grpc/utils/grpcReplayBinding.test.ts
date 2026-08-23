/**
 * Phase 5C — replay binding integration tests.
 */
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '@shared/grpc/contractFixtures';
import { createGrpcSavedRequestFromSnapshot } from '@shared/grpc/grpcSavedRequest';
import type { GrpcCallHistoryEntryV1 } from '@shared/grpc/grpcPersistenceSchema';
import { createGrpcStudioTab } from '../grpcStudioTypes';
import { createDefaultDescriptorSourceSelection } from '@shared/grpc/descriptorSourcePolicy';
import {
  analyzeReplaySchemaDrift,
  applyGrpcReplaySafeFallbackBody,
  createReplaySavedRequestFromHistoryEntry,
  isGrpcExecuteBlockedByDrift,
  isGrpcReplayExecutable,
  resolveBaselineDescriptorForReplay,
  resolveEffectiveReplayBaseline,
  resolveGrpcHistoryEntryReplay,
  resolveGrpcReplayBinding,
} from './grpcReplayBinding';

const TS = '2026-06-29T12:00:00.000Z';

function makeSavedRequest(body: Record<string, unknown> = { message: 'hello' }) {
  const tab = createGrpcStudioTab({ descriptorKey: FIXTURE_DESCRIPTOR_KEY });
  return createGrpcSavedRequestFromSnapshot(
    {
      tabId: tab.id,
      requestId: 'req-1',
      capturedAt: TS,
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body,
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    },
    { id: 'sr-1', revisionId: 'rev-1', updatedAt: TS },
  );
}

function makeHistoryEntry(body: Record<string, unknown> = { message: 'from-history' }): GrpcCallHistoryEntryV1 {
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
        body,
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
    },
  };
}

describe('grpcReplayBinding (Phase 5C)', () => {
  it('resolveBaselineDescriptorForReplay prefers lastKnownGood when keys match', () => {
    const baseline = { ...FIXTURE_DESCRIPTOR, key: FIXTURE_DESCRIPTOR_KEY };
    const current = { ...FIXTURE_DESCRIPTOR, key: 'other-key' };
    const resolved = resolveBaselineDescriptorForReplay(
      {
        loadState: 'loaded',
        descriptor: current,
        lastKnownGoodDescriptor: baseline,
        expandedServiceIds: [],
        sourceSelection: createDefaultDescriptorSourceSelection(),
        driftState: 'none',
      },
      FIXTURE_DESCRIPTOR_KEY,
    );
    expect(resolved?.key).toBe(FIXTURE_DESCRIPTOR_KEY);
  });

  it('analyzeReplaySchemaDrift detects blocking when method removed', () => {
    const nextDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((m) => m.name !== 'Echo'),
      }],
    };
    const drift = analyzeReplaySchemaDrift({
      currentDescriptor: nextDescriptor,
      baselineDescriptor: FIXTURE_DESCRIPTOR,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
    });
    expect(drift.state).toBe('blocking');
    expect(drift.issues[0]?.kind).toBe('method_missing');
  });

  it('analyzeReplaySchemaDrift warns on removed field when baseline provided', () => {
    const nextDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
          entry.name === 'Echo'
            ? { ...entry, requestSchema: { ...entry.requestSchema, fields: [] } }
            : entry
        )),
      }],
    };
    const drift = analyzeReplaySchemaDrift({
      currentDescriptor: nextDescriptor,
      baselineDescriptor: FIXTURE_DESCRIPTOR,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
    });
    expect(drift.state).toBe('warning');
    expect(drift.issues.some((i) => i.kind === 'field_removed')).toBe(true);
  });

  it('analyzeReplaySchemaDrift detects blocking when method removed without baseline', () => {
    const nextDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((m) => m.name !== 'Echo'),
      }],
    };
    const drift = analyzeReplaySchemaDrift({
      currentDescriptor: nextDescriptor,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
    });
    expect(drift.state).toBe('blocking');
    expect(drift.issues[0]?.kind).toBe('method_missing');
  });

  it('resolveEffectiveReplayBaseline prefers explicit baseline when keys match', () => {
    const baseline = resolveEffectiveReplayBaseline({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      baselineDescriptor: FIXTURE_DESCRIPTOR,
    });
    expect(baseline?.key).toBe(FIXTURE_DESCRIPTOR_KEY);
  });

  it('resolveEffectiveReplayBaseline ignores explicit baseline when keys mismatch', () => {
    const baseline = resolveEffectiveReplayBaseline({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      baselineDescriptor: { ...FIXTURE_DESCRIPTOR, key: 'wrong-key' },
      tabDescriptorState: {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
        expandedServiceIds: [],
        sourceSelection: createDefaultDescriptorSourceSelection(),
        driftState: 'none',
      },
    });
    expect(baseline?.key).toBe(FIXTURE_DESCRIPTOR_KEY);
  });

  it('resolveGrpcReplayBinding auto-resolves baseline from tabDescriptorState', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const saved = makeSavedRequest();
    const nextDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
          entry.name === 'Echo'
            ? { ...entry, requestSchema: { ...entry.requestSchema, fields: [] } }
            : entry
        )),
      }],
    };

    const result = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-auto-baseline',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: nextDescriptor,
      tabDescriptorState: {
        loadState: 'loaded',
        descriptor: nextDescriptor,
        lastKnownGoodDescriptor: FIXTURE_DESCRIPTOR,
        expandedServiceIds: [],
        sourceSelection: createDefaultDescriptorSourceSelection(),
        driftState: 'none',
      },
    });

    expect(result.drift.state).toBe('warning');
    expect(result.drift.issues.some((i) => i.kind === 'field_removed')).toBe(true);
  });

  it('analyzeReplaySchemaDrift flags unknown body keys without baseline', () => {
    const drift = analyzeReplaySchemaDrift({
      currentDescriptor: FIXTURE_DESCRIPTOR,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello', orphanField: 'x' },
    });
    expect(drift.state).toBe('warning');
    expect(drift.issues.some((i) => i.fieldName === 'orphanField')).toBe(true);
  });

  it('applyGrpcReplaySafeFallbackBody prunes only on warning drift', () => {
    const pruned = applyGrpcReplaySafeFallbackBody(
      { message: 'hello', orphanField: 'drop-me' },
      {
        state: 'warning',
        message: 'orphan',
        issues: [],
        suggestedRebinds: [],
      },
      FIXTURE_DESCRIPTOR,
      'echo.EchoService',
      'Echo',
    );
    expect(pruned).toEqual({ message: 'hello' });
  });

  it('applyGrpcReplaySafeFallbackBody does not mutate body on blocking drift', () => {
    const body = { message: 'hello', orphanField: 'keep' };
    const result = applyGrpcReplaySafeFallbackBody(
      body,
      {
        state: 'blocking',
        message: 'method gone',
        issues: [{ kind: 'method_missing', message: 'gone' }],
        suggestedRebinds: [],
      },
      FIXTURE_DESCRIPTOR,
      'echo.EchoService',
      'Echo',
    );
    expect(result).toEqual(body);
  });

  it('resolveGrpcReplayBinding resolves env vars and returns drift metadata', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const saved = makeSavedRequest();
    saved.target = '{{grpcHost}}';

    const result = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-1',
      envVarMap: { grpcHost: 'localhost:50051' },
      profiles: [],
      pageDefaults: { target: 'localhost:59999', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
      baselineDescriptor: FIXTURE_DESCRIPTOR,
    });

    expect(result.snapshot.target.address).toBe('localhost:50051');
    expect(result.drift.state).toBe('none');
    expect(result.safeFallbackApplied).toBe(false);
  });

  it('resolveGrpcReplayBinding applies safe fallback when opted in', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const saved = makeSavedRequest({ message: 'hello', staleField: 'remove' });

    const result = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-2',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
      applySafeFallback: true,
    });

    expect(result.drift.state).toBe('warning');
    expect(result.safeFallbackApplied).toBe(true);
    expect(result.body).toEqual({ message: 'hello' });
    expect(result.snapshot.body).toEqual({ message: 'hello' });
  });

  it('resolveGrpcReplayBinding does not apply safe fallback on blocking drift', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const saved = makeSavedRequest();
    const nextDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((m) => m.name !== 'Echo'),
      }],
    };

    const result = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-3',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: nextDescriptor,
      baselineDescriptor: FIXTURE_DESCRIPTOR,
      applySafeFallback: true,
    });

    expect(result.drift.state).toBe('blocking');
    expect(result.safeFallbackApplied).toBe(false);
    expect(result.snapshot.body).toEqual(saved.body);
  });

  it('createReplaySavedRequestFromHistoryEntry maps snapshot fields', () => {
    const entry = makeHistoryEntry({ message: 'hist-body' });
    const saved = createReplaySavedRequestFromHistoryEntry(entry);
    expect(saved.id).toBe('hist-1');
    expect(saved.service).toBe('echo.EchoService');
    expect(saved.method).toBe('Echo');
    expect(saved.body).toEqual({ message: 'hist-body' });
    expect(saved.name).toBe('echo.EchoService/Echo');
  });

  it('resolveGrpcHistoryEntryReplay re-resolves template target from history snapshot (Phase 9F)', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: '{{grpcHost}}',
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const entry = makeHistoryEntry({ message: 'replay-me' });
    entry.target = 'old-resolved:50051';
    entry.record.snapshot.target = {
      ...entry.record.snapshot.target,
      address: '{{grpcHost}}',
    };

    const result = resolveGrpcHistoryEntryReplay({
      entry,
      tab,
      requestId: 'replay-hist-env',
      envVarMap: { grpcHost: 'new-resolved:50051' },
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
    });

    expect(result.snapshot.target.address).toBe('new-resolved:50051');
  });

  it('resolveGrpcHistoryEntryReplay shares binding path with saved requests', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const entry = makeHistoryEntry({ message: 'replay-me' });

    const result = resolveGrpcHistoryEntryReplay({
      entry,
      tab,
      requestId: 'replay-hist',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
    });

    expect(result.snapshot.body).toEqual({ message: 'replay-me' });
    expect(result.snapshot.service).toBe('echo.EchoService');
    expect(result.drift.state).toBe('none');
  });

  it('resolveGrpcHistoryEntryReplay blocks when history body was truncated', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const entry = makeHistoryEntry({ message: 'partial' });
    entry.bodyTruncated = true;

    const result = resolveGrpcHistoryEntryReplay({
      entry,
      tab,
      requestId: 'replay-truncated',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
    });

    expect(result.historyBodyTruncated).toBe(true);
    expect(result.drift.state).toBe('blocking');
    expect(result.drift.message).toContain('truncated');
    expect(isGrpcReplayExecutable(result.drift)).toBe(false);
  });

  it('resolveGrpcHistoryEntryReplay merges truncation blocking with existing schema drift', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const entry = makeHistoryEntry({ message: 'hello', orphanField: 'x' });
    entry.bodyTruncated = true;

    const result = resolveGrpcHistoryEntryReplay({
      entry,
      tab,
      requestId: 'replay-truncated-drift',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
    });

    expect(result.drift.state).toBe('blocking');
    expect(result.drift.issues.length).toBeGreaterThan(1);
    expect(result.drift.message).toContain('truncated');
    expect(isGrpcReplayExecutable(result.drift)).toBe(false);
  });

  it('resolveGrpcReplayBinding blocks when loaded descriptor key mismatches saved request', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const saved = makeSavedRequest();
    const otherDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      key: 'reflection:localhost:50051:other-hash',
    };

    const result = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-key-mismatch',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: otherDescriptor,
      baselineDescriptor: FIXTURE_DESCRIPTOR,
      applySafeFallback: true,
    });

    expect(result.drift.state).toBe('blocking');
    expect(result.drift.issues[0]?.message).toContain('Descriptor key mismatch');
    expect(result.safeFallbackApplied).toBe(false);
    expect(result.snapshot.descriptorKey).toBe(saved.descriptorKey);
  });

  it('resolveGrpcHistoryEntryReplay preserves streaming callType from snapshot', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const entry = makeHistoryEntry({ message: 'stream' });
    entry.callType = 'server_streaming';
    entry.method = 'ServerStream';
    entry.service = 'echo.EchoService';
    entry.record.snapshot.callType = 'server_streaming';
    entry.record.snapshot.method = 'ServerStream';

    const result = resolveGrpcHistoryEntryReplay({
      entry,
      tab,
      requestId: 'replay-stream',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
    });

    expect(result.snapshot.callType).toBe('server_streaming');
    expect(result.snapshot.method).toBe('ServerStream');
  });

  it('resolveGrpcHistoryEntryReplay keeps blocking drift when descriptor keys mismatch', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const entry = makeHistoryEntry({ message: 'partial' });
    entry.bodyTruncated = true;
    const otherDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      key: 'reflection:localhost:50051:other-hash',
    };

    const result = resolveGrpcHistoryEntryReplay({
      entry,
      tab,
      requestId: 'replay-truncated-blocking',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: otherDescriptor,
    });

    expect(result.drift.state).toBe('blocking');
    expect(result.drift.message).not.toContain('truncated');
    expect(result.historyBodyTruncated).toBe(true);
  });

  it('analyzeReplaySchemaDrift ignores baseline when baseline key differs from current', () => {
    const currentDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      key: 'reflection:localhost:50051:new-hash',
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
          entry.name === 'Echo'
            ? { ...entry, requestSchema: { ...entry.requestSchema, fields: [] } }
            : entry
        )),
      }],
    };
    const drift = analyzeReplaySchemaDrift({
      currentDescriptor,
      baselineDescriptor: FIXTURE_DESCRIPTOR,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
    });
    expect(drift.state).toBe('warning');
    expect(drift.issues.some((i) => i.fieldName === 'message')).toBe(true);
  });

  it('isGrpcExecuteBlockedByDrift blocks only on blocking state', () => {
    expect(isGrpcExecuteBlockedByDrift('none')).toBe(false);
    expect(isGrpcExecuteBlockedByDrift('warning')).toBe(false);
    expect(isGrpcExecuteBlockedByDrift('blocking')).toBe(true);
    expect(isGrpcExecuteBlockedByDrift(undefined)).toBe(false);
  });

  it('isGrpcReplayExecutable reflects blocking vs warning/none drift', () => {
    expect(isGrpcReplayExecutable({ state: 'none', message: '', issues: [], suggestedRebinds: [] })).toBe(true);
    expect(isGrpcReplayExecutable({ state: 'warning', message: 'warn', issues: [], suggestedRebinds: [] })).toBe(true);
    expect(isGrpcReplayExecutable({
      state: 'blocking',
      message: 'blocked',
      issues: [{ kind: 'method_missing', message: 'gone' }],
      suggestedRebinds: [],
    })).toBe(false);
  });

  it('resolveGrpcReplayBinding blocks when no descriptor is loaded', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const saved = makeSavedRequest();

    const result = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-no-desc',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    });

    expect(result.drift.state).toBe('blocking');
    expect(isGrpcReplayExecutable(result.drift)).toBe(false);
  });

  it('resolveGrpcReplayBinding preserves orphan fields when safe fallback is not opted in', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const saved = makeSavedRequest({ message: 'hello', staleField: 'keep-me' });

    const result = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-no-fallback',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
      applySafeFallback: false,
    });

    expect(result.drift.state).toBe('warning');
    expect(result.safeFallbackApplied).toBe(false);
    expect(result.snapshot.body).toEqual({ message: 'hello', staleField: 'keep-me' });
  });

  it('resolveGrpcReplayBinding defaults sourceFingerprint from loaded descriptor', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const saved = makeSavedRequest();

    const result = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-fingerprint',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
    });

    expect(result.snapshot.sourceFingerprint).toEqual(FIXTURE_DESCRIPTOR.sourceFingerprint);
  });

  it('resolveGrpcReplayBinding preserves streaming callType from saved request', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const saved = createGrpcSavedRequestFromSnapshot(
      {
        tabId: tab.id,
        requestId: 'req-stream',
        capturedAt: TS,
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: 'echo.EchoService',
        method: 'ServerStream',
        body: { message: 'stream' },
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      { id: 'sr-stream', revisionId: 'rev-stream', updatedAt: TS },
    );

    const result = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-saved-stream',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
    });

    expect(result.snapshot.callType).toBe('server_streaming');
    expect(result.snapshot.method).toBe('ServerStream');
  });

  it('resolveGrpcHistoryEntryReplay interpolates env vars in snapshot target', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const entry = makeHistoryEntry({ message: 'hello' });
    entry.record.snapshot.target = {
      address: '{{grpcHost}}',
      tlsMode: 'disabled',
    };

    const result = resolveGrpcHistoryEntryReplay({
      entry,
      tab,
      requestId: 'replay-hist-env',
      envVarMap: { grpcHost: 'localhost:50051' },
      profiles: [],
      pageDefaults: { target: 'localhost:59999', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
    });

    expect(result.snapshot.target.address).toBe('localhost:50051');
    expect(result.snapshot.descriptorKey).toBe(FIXTURE_DESCRIPTOR_KEY);
  });

  it('does not mutate source tab during replay binding', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'tab-original' },
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const beforeBody = structuredClone(tab.body);
    const saved = makeSavedRequest({ message: 'saved-only' });

    resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-tab-guard',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: FIXTURE_DESCRIPTOR,
      applySafeFallback: true,
    });

    expect(tab.body).toEqual(beforeBody);
  });
});
