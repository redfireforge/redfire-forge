/**
 * Phase 9H — cross-surface interpolation parity matrix.
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { makeScenario as _makeScenario } from '@test-utils/factories';
import type { Scenario } from '../types';
import { createGrpcStudioTab, captureGrpcTabExecuteSnapshotFromResolution } from '@grpc/grpcStudioTypes';
import { resolveTabConnectionWithEnv, bindTabInterpolationEnvForExecute } from '@grpc/hooks/grpcStudioSessionHelpers';
import { buildGrpcHarnessExecuteSnapshot } from './grpcHarnessSnapshotBuilder';
import { buildGrpcWorkflowExecuteSnapshot } from '@workflow/utils/grpcWorkflowSnapshotBuilder';
import type { GrpcUnaryNodeData } from '@workflow/types/workflow/node-grpc';
import { resolveGrpcSavedRequestReplay } from '@grpc/utils/grpcReplayResolver';
import { createGrpcSavedRequestFromSnapshot } from './grpcSavedRequest';
import { buildGrpcSavedRequestTemplateSource } from './grpcReplayTemplateCompatibility';
import { sanitizeGrpcSavedRequestForTemplatePersist } from './grpcInterpolationPersistGuard';
import {
  assertGrpcInterpolationExecuteParity,
  GRPC_CROSS_SURFACE_FIXTURE,
  grpcExecuteSnapshotToComparable,
  grpcExecuteSnapshotToInterpolationComparable,
} from './grpcInterpolationCrossSurface';
import { resolveGrpcStudioTabFieldsForExecute } from './grpcStudioExecuteInterpolation';

const FIXTURE = GRPC_CROSS_SURFACE_FIXTURE;

function makeHarnessScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 'grpc-cross',
    name: 'Cross surface',
    url: '',
    method: 'GRPC',
    actionType: 'grpcCall',
    grpcCallAction: {
      callType: 'unary',
      target: FIXTURE.templates.target,
      descriptorKey: FIXTURE.descriptorKey,
      service: FIXTURE.service,
      method: FIXTURE.method,
      body: FIXTURE.templates.body,
      metadata: FIXTURE.templates.metadata,
      auth: FIXTURE.templates.auth,
    },
    ...overrides,
  }) as Scenario;
}

function buildHarnessComparable() {
  const snapshot = buildGrpcHarnessExecuteSnapshot(
    { scenario: makeHarnessScenario(), requestId: 'req-harness' },
    {
      activeEnvironment: FIXTURE.env,
      profiles: FIXTURE.profiles,
      pageDefaults: FIXTURE.pageDefaults,
      resolveTemplate: () => '',
    },
  );
  return grpcExecuteSnapshotToComparable(snapshot.execute);
}

function buildWorkflowComparable() {
  const data: GrpcUnaryNodeData = {
    label: 'Echo',
    callType: 'unary',
    target: FIXTURE.templates.target,
    descriptorKey: FIXTURE.descriptorKey,
    service: FIXTURE.service,
    method: FIXTURE.method,
    body: FIXTURE.templates.body,
    metadata: FIXTURE.templates.metadata,
    auth: FIXTURE.templates.auth,
  };
  const snapshot = buildGrpcWorkflowExecuteSnapshot(
    { nodeId: 'wf-1', requestId: 'req-wf', data },
    {
      activeEnvironment: FIXTURE.env,
      profiles: FIXTURE.profiles,
      pageDefaults: FIXTURE.pageDefaults,
      resolveTemplate: () => '',
    },
  );
  return grpcExecuteSnapshotToComparable(snapshot.execute);
}

function buildStudioSnapshot() {
  const tab = createGrpcStudioTab({
    target: FIXTURE.templates.target,
    body: FIXTURE.templates.body,
    metadata: FIXTURE.templates.metadata,
    auth: FIXTURE.templates.auth,
    descriptorKey: FIXTURE.descriptorKey,
    service: FIXTURE.service,
    method: FIXTURE.method,
    transportMode: 'express',
  });
  const interpolationEnv = bindTabInterpolationEnvForExecute(
    tab,
    FIXTURE.env,
    FIXTURE.profiles,
    FIXTURE.pageDefaults,
  );
  const resolution = resolveTabConnectionWithEnv(
    tab,
    FIXTURE.env,
    FIXTURE.profiles,
    FIXTURE.pageDefaults,
  );
  const resolvedFields = resolveGrpcStudioTabFieldsForExecute(tab, interpolationEnv.env);
  const executeTab = { ...tab, ...resolvedFields };
  return captureGrpcTabExecuteSnapshotFromResolution(
    executeTab,
    'req-studio',
    resolution,
    'unary',
    { interpolationEnv },
  );
}

function buildStudioComparable() {
  return grpcExecuteSnapshotToComparable(buildStudioSnapshot());
}

describe('grpcInterpolationCrossSurface (Phase 9H)', () => {
  it('resolves identical execute payloads across harness, workflow, and studio', () => {
    const harness = buildHarnessComparable();
    const workflow = buildWorkflowComparable();
    const studio = buildStudioComparable();
    assertGrpcInterpolationExecuteParity('harness', harness, 'workflow', workflow);
    assertGrpcInterpolationExecuteParity('studio', studio, 'harness', harness);
    expect(studio.targetAddress).toBe('localhost:50051');
    expect(studio.body).toEqual({ message: 'hello', nested: { tag: 'dev' } });
  });

  it('resolves templated metadata keys across harness and studio', () => {
    const env = { ...FIXTURE.env, headerName: 'x-tenant', envName: 'dev' };
    const templates = { '{{headerName}}': '{{envName}}' };
    const harness = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeHarnessScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE.templates.target,
            descriptorKey: FIXTURE.descriptorKey,
            service: FIXTURE.service,
            method: FIXTURE.method,
            body: {},
            metadata: templates,
          },
        }),
        requestId: 'req-meta-key',
      },
      {
        activeEnvironment: env,
        profiles: FIXTURE.profiles,
        pageDefaults: FIXTURE.pageDefaults,
        resolveTemplate: () => '',
      },
    );
    const tab = createGrpcStudioTab({
      target: FIXTURE.templates.target,
      body: {},
      metadata: templates,
      descriptorKey: FIXTURE.descriptorKey,
      service: FIXTURE.service,
      method: FIXTURE.method,
    });
    const interpolationEnv = bindTabInterpolationEnvForExecute(
      tab,
      env,
      FIXTURE.profiles,
      FIXTURE.pageDefaults,
    );
    const resolved = resolveGrpcStudioTabFieldsForExecute(tab, interpolationEnv.env);
    expect(harness.execute.metadata).toEqual(resolved.metadata);
    expect(resolved.metadata).toEqual({ 'x-tenant': 'dev' });
  });

  it('applies profile env variable precedence to body interpolation (Phase 9C/9H)', () => {
    const profiles = [{
      id: 'profile-a',
      name: 'Local',
      target: FIXTURE.templates.target,
      tlsMode: 'disabled' as const,
      variables: { greeting: 'from-profile' },
    }];
    const tab = createGrpcStudioTab({
      target: FIXTURE.templates.target,
      connectionId: 'profile-a',
      body: { message: '{{greeting}}' },
      descriptorKey: FIXTURE.descriptorKey,
      service: FIXTURE.service,
      method: FIXTURE.method,
    });
    const env = { ...FIXTURE.env, greeting: 'from-env' };
    const interpolationEnv = bindTabInterpolationEnvForExecute(
      tab,
      env,
      profiles,
      FIXTURE.pageDefaults,
    );
    const resolved = resolveGrpcStudioTabFieldsForExecute(tab, interpolationEnv.env);
    expect(interpolationEnv.env.greeting).toBe('from-profile');
    expect(resolved.body).toEqual({ message: 'from-profile' });

    const harness = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeHarnessScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE.templates.target,
            connectionId: 'profile-a',
            descriptorKey: FIXTURE.descriptorKey,
            service: FIXTURE.service,
            method: FIXTURE.method,
            body: { message: '{{greeting}}' },
          },
        }),
        requestId: 'req-profile-body',
      },
      {
        activeEnvironment: env,
        profiles,
        pageDefaults: FIXTURE.pageDefaults,
        resolveTemplate: () => '',
      },
    );
    expect(harness.execute.body).toEqual(resolved.body);
  });

  it('preserves escaped literals consistently across studio and harness', () => {
    const escaped = String.raw`\{{greeting}}`;
    const env = { ...FIXTURE.env, greeting: 'ignored' };
    const harness = buildGrpcHarnessExecuteSnapshot(
      {
        scenario: makeHarnessScenario({
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE.templates.target,
            descriptorKey: FIXTURE.descriptorKey,
            service: FIXTURE.service,
            method: FIXTURE.method,
            body: { message: escaped },
          },
        }),
        requestId: 'req-escaped',
      },
      {
        activeEnvironment: env,
        profiles: FIXTURE.profiles,
        pageDefaults: FIXTURE.pageDefaults,
        resolveTemplate: () => '',
      },
    );
    const tab = createGrpcStudioTab({
      target: FIXTURE.templates.target,
      body: { message: escaped },
      descriptorKey: FIXTURE.descriptorKey,
      service: FIXTURE.service,
      method: FIXTURE.method,
    });
    const interpolationEnv = bindTabInterpolationEnvForExecute(
      tab,
      env,
      FIXTURE.profiles,
      FIXTURE.pageDefaults,
    );
    const resolved = resolveGrpcStudioTabFieldsForExecute(tab, interpolationEnv.env);
    expect(harness.execute.body).toEqual(resolved.body);
    expect(resolved.body).toEqual({ message: escaped });
  });

  it('blocks missing grpcHost consistently across studio and harness', () => {
    const env = { greeting: 'hello' };
    expect(() => buildGrpcHarnessExecuteSnapshot(
      { scenario: makeHarnessScenario(), requestId: 'req-missing' },
      {
        activeEnvironment: env,
        profiles: FIXTURE.profiles,
        pageDefaults: FIXTURE.pageDefaults,
        resolveTemplate: () => '',
      },
    )).toThrow(/grpcHost|Resolve|Environment Manager/i);

    const tab = createGrpcStudioTab({
      target: '{{grpcHost}}',
      body: {},
      descriptorKey: FIXTURE.descriptorKey,
      service: FIXTURE.service,
      method: FIXTURE.method,
    });
    const resolution = resolveTabConnectionWithEnv(
      tab,
      env,
      FIXTURE.profiles,
      FIXTURE.pageDefaults,
    );
    expect(resolution.targetValidation.valid).toBe(false);
    expect(resolution.targetValidation.reason).toMatch(/grpcHost|Resolve|Environment Manager/i);
  });

  it('keeps prior execute snapshot immutable when env map changes', () => {
    const first = buildStudioComparable();
    const tab = createGrpcStudioTab({
      target: FIXTURE.templates.target,
      body: FIXTURE.templates.body,
      metadata: FIXTURE.templates.metadata,
      auth: FIXTURE.templates.auth,
      descriptorKey: FIXTURE.descriptorKey,
      service: FIXTURE.service,
      method: FIXTURE.method,
    });
    const nextEnv = { ...FIXTURE.env, greeting: 'changed' };
    const interpolationEnv = bindTabInterpolationEnvForExecute(
      tab,
      nextEnv,
      FIXTURE.profiles,
      FIXTURE.pageDefaults,
    );
    const resolution = resolveTabConnectionWithEnv(
      tab,
      nextEnv,
      FIXTURE.profiles,
      FIXTURE.pageDefaults,
    );
    const resolvedFields = resolveGrpcStudioTabFieldsForExecute(tab, interpolationEnv.env);
    const executeTab = { ...tab, ...resolvedFields };
    const second = grpcExecuteSnapshotToComparable(
      captureGrpcTabExecuteSnapshotFromResolution(
        executeTab,
        'req-2',
        resolution,
        'unary',
        { interpolationEnv },
      ),
    );
    expect(first.body).toEqual({ message: 'hello', nested: { tag: 'dev' } });
    expect(second.body).toEqual({ message: 'changed', nested: { tag: 'dev' } });
  });

  it('replay re-resolves saved request templates against current env', () => {
    const tab = createGrpcStudioTab({
      target: FIXTURE.templates.target,
      body: FIXTURE.templates.body,
      metadata: FIXTURE.templates.metadata,
      auth: FIXTURE.templates.auth,
      descriptorKey: FIXTURE.descriptorKey,
      service: FIXTURE.service,
      method: FIXTURE.method,
    });
    const studioSnapshot = buildStudioSnapshot();
    const saved = createGrpcSavedRequestFromSnapshot(
      studioSnapshot,
      {
        id: 'saved-1',
        revisionId: 'rev-1',
        updatedAt: '2026-06-29T00:00:00.000Z',
        name: 'Saved',
      },
      {
        rawTarget: FIXTURE.templates.target,
        rawBody: FIXTURE.templates.body,
        rawMetadata: FIXTURE.templates.metadata,
        rawAuth: FIXTURE.templates.auth,
      },
    );
    const templateSource = buildGrpcSavedRequestTemplateSource({
      rawTarget: FIXTURE.templates.target,
      rawBody: FIXTURE.templates.body,
      rawMetadata: FIXTURE.templates.metadata,
      rawAuth: FIXTURE.templates.auth,
    });
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(saved, templateSource);
    expect(sanitized.target).toBe('{{grpcHost}}');

    const nextEnv = { ...FIXTURE.env, greeting: 'replayed' };
    const replaySnapshot = resolveGrpcSavedRequestReplay({
      saved: sanitized,
      tab,
      requestId: 'req-replay',
      envVarMap: nextEnv,
      profiles: FIXTURE.profiles,
      pageDefaults: FIXTURE.pageDefaults,
    });
    expect(replaySnapshot.body).toEqual({
      message: 'replayed',
      nested: { tag: 'dev' },
    });
    expect(replaySnapshot.target.address).toBe('localhost:50051');

    const replayEpochEnv = bindTabInterpolationEnvForExecute(
      tab,
      nextEnv,
      FIXTURE.profiles,
      FIXTURE.pageDefaults,
    );
    const replayEpochResolution = resolveTabConnectionWithEnv(
      tab,
      nextEnv,
      FIXTURE.profiles,
      FIXTURE.pageDefaults,
    );
    const replayEpochFields = resolveGrpcStudioTabFieldsForExecute(tab, replayEpochEnv.env);
    const studioReplayEpoch = captureGrpcTabExecuteSnapshotFromResolution(
      { ...tab, ...replayEpochFields },
      'req-studio-replay-epoch',
      replayEpochResolution,
      'unary',
      { interpolationEnv: replayEpochEnv },
    );
    assertGrpcInterpolationExecuteParity(
      'studio-replay-epoch',
      grpcExecuteSnapshotToInterpolationComparable(studioReplayEpoch),
      'saved-replay',
      grpcExecuteSnapshotToInterpolationComparable(replaySnapshot),
    );
  });

  it('does not leak secret env values into export-safe saved request previews', () => {
    const snapshot = buildStudioSnapshot();
    const saved = createGrpcSavedRequestFromSnapshot(
      { ...snapshot, body: { tokenRef: 'super-secret-bearer' } },
      {
        id: 'saved-secret',
        revisionId: 'rev-secret',
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
      { rawBody: { tokenRef: '{{bearerToken}}' } },
    );
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
      saved,
      buildGrpcSavedRequestTemplateSource({ rawBody: { tokenRef: '{{bearerToken}}' } }),
    );
    expect(JSON.stringify(sanitized)).not.toContain('super-secret-bearer');
    expect(JSON.stringify(sanitized)).toContain('{{bearerToken}}');
    expect(JSON.stringify(sanitized)).not.toContain('abc123');
  });

  it('interpolation resolves identically regardless of studio transport mode selection', () => {
    const expressTab = createGrpcStudioTab({
      target: FIXTURE.templates.target,
      body: FIXTURE.templates.body,
      descriptorKey: FIXTURE.descriptorKey,
      service: FIXTURE.service,
      method: FIXTURE.method,
      transportMode: 'express',
    });
    const tauriTab = createGrpcStudioTab({
      target: FIXTURE.templates.target,
      body: FIXTURE.templates.body,
      descriptorKey: FIXTURE.descriptorKey,
      service: FIXTURE.service,
      method: FIXTURE.method,
      transportMode: 'tauri',
    });
    const expressEnv = bindTabInterpolationEnvForExecute(
      expressTab,
      FIXTURE.env,
      FIXTURE.profiles,
      FIXTURE.pageDefaults,
    );
    const tauriEnv = bindTabInterpolationEnvForExecute(
      tauriTab,
      FIXTURE.env,
      FIXTURE.profiles,
      FIXTURE.pageDefaults,
    );
    const expressFields = resolveGrpcStudioTabFieldsForExecute(
      expressTab,
      expressEnv.env,
    );
    const tauriFields = resolveGrpcStudioTabFieldsForExecute(
      tauriTab,
      tauriEnv.env,
    );
    expect(tauriFields).toEqual(expressFields);
    expect(expressTab.transportMode).toBe('express');
    expect(tauriTab.transportMode).toBe('tauri');
  });

  it('strips auth-injected metadata when comparing replay interpolation parity', () => {
    const snapshot = buildStudioSnapshot();
    const withAuthMetadata = {
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        authorization: 'Bearer abc123',
      },
    };
    const comparable = grpcExecuteSnapshotToInterpolationComparable(withAuthMetadata);
    expect(comparable.metadata).toEqual(snapshot.metadata);
    expect(comparable.authBearer).toBe('abc123');
  });
});
