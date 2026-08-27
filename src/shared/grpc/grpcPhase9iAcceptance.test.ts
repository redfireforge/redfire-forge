/**
 * Phase 9I — Consolidated Phase 9 acceptance checklist (hardening gate).
 *
 * Each checklist-N describe maps to one Phase 9 acceptance checklist item.
 * Tests use mocked transport — no live Docker/gRPC server required.
 */
import { describe, expect, it } from 'vitest';
import { makeScenario as _makeScenario } from '@test-utils/factories';
import type { Scenario } from '../types';
import { createGrpcStudioTab, captureGrpcTabExecuteSnapshotFromResolution } from '@grpc/grpcStudioTypes';
import {
  bindTabInterpolationEnvForExecute,
  resolveTabConnectionWithEnv,
} from '@grpc/hooks/grpcStudioSessionHelpers';
import { buildGrpcHarnessExecuteSnapshot } from './grpcHarnessSnapshotBuilder';
import { resolveGrpcHarnessSendMessages } from './grpcHarnessTemplateResolver';
import { createGrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';
import { buildGrpcWorkflowExecuteSnapshot } from '@workflow/utils/grpcWorkflowSnapshotBuilder';
import type { GrpcUnaryNodeData } from '@workflow/types/workflow/node-grpc';
import { createGrpcSavedRequestFromSnapshot } from './grpcSavedRequest';
import { buildGrpcSavedRequestTemplateSource } from './grpcReplayTemplateCompatibility';
import { sanitizeGrpcSavedRequestForTemplatePersist } from './grpcInterpolationPersistGuard';
import { createGrpcInterpolationEnvSnapshotFromMap } from './grpcInterpolationEnvSnapshot';
import {
  assertGrpcInterpolationExecuteParity,
  GRPC_CROSS_SURFACE_FIXTURE,
  grpcExecuteSnapshotToComparable,
} from './grpcInterpolationCrossSurface';
import {
  resolveGrpcStudioStreamMessageBodyForSend,
  resolveGrpcStudioTabFieldsForExecute,
} from './grpcStudioExecuteInterpolation';

const FIXTURE = GRPC_CROSS_SURFACE_FIXTURE;

function makeHarnessScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 'grpc-9i',
    name: 'Phase 9I',
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
    { scenario: makeHarnessScenario(), requestId: 'req-harness-9i' },
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
    { nodeId: 'wf-9i', requestId: 'req-wf-9i', data },
    {
      activeEnvironment: FIXTURE.env,
      profiles: FIXTURE.profiles,
      pageDefaults: FIXTURE.pageDefaults,
      resolveTemplate: () => '',
    },
  );
  return grpcExecuteSnapshotToComparable(snapshot.execute);
}

function buildStudioComparable() {
  const tab = createGrpcStudioTab({
    target: FIXTURE.templates.target,
    body: FIXTURE.templates.body,
    metadata: FIXTURE.templates.metadata,
    auth: FIXTURE.templates.auth,
    descriptorKey: FIXTURE.descriptorKey,
    service: FIXTURE.service,
    method: FIXTURE.method,
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
  const snapshot = captureGrpcTabExecuteSnapshotFromResolution(
    executeTab,
    'req-studio-9i',
    resolution,
    'unary',
    { interpolationEnv },
  );
  return grpcExecuteSnapshotToComparable(snapshot);
}

describe('Phase 9I acceptance checklist', () => {
  describe('checklist-1: same input resolves identically across Studio, Workflow, Harness', () => {
    it('produces matching execute payloads on shared fixture', () => {
      const harness = buildHarnessComparable();
      const workflow = buildWorkflowComparable();
      const studio = buildStudioComparable();
      assertGrpcInterpolationExecuteParity('harness', harness, 'workflow', workflow);
      assertGrpcInterpolationExecuteParity('studio', studio, 'harness', harness);
      expect(studio.body).toEqual({ message: 'hello', nested: { tag: 'dev' } });
    });

    it('matches target address and bearer auth across surfaces', () => {
      const harness = buildHarnessComparable();
      const workflow = buildWorkflowComparable();
      const studio = buildStudioComparable();
      expect(studio.targetAddress).toBe(workflow.targetAddress);
      expect(studio.targetAddress).toBe(harness.targetAddress);
      expect(studio.authBearer).toBe('abc123');
      expect(workflow.authBearer).toBe('abc123');
    });

    it('stream send message body matches harness sendMessages resolution (Phase 9I)', () => {
      const env = { part: 'stream-frame' };
      const frozenEnv = createGrpcInterpolationEnvSnapshotFromMap(env);
      const template = { message: '{{part}}' };
      const studioBody = resolveGrpcStudioStreamMessageBodyForSend(template, frozenEnv);
      const harnessMessages = resolveGrpcHarnessSendMessages(
        [template],
        createGrpcInterpolationTemplateResolver(env),
      );
      expect(studioBody).toEqual(harnessMessages[0]);
      expect(studioBody).toEqual({ message: 'stream-frame' });
    });
  });

  describe('checklist-2: environment switch affects only subsequent calls', () => {
    it('keeps prior snapshot body when env map changes', () => {
      const first = buildStudioComparable();
      const tab = createGrpcStudioTab({
        target: FIXTURE.templates.target,
        body: FIXTURE.templates.body,
        descriptorKey: FIXTURE.descriptorKey,
        service: FIXTURE.service,
        method: FIXTURE.method,
      });
      const nextEnv = { ...FIXTURE.env, greeting: 'changed-after-switch' };
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
      const nextSnapshot = captureGrpcTabExecuteSnapshotFromResolution(
        { ...tab, ...resolvedFields },
        'req-next',
        resolution,
        'unary',
        { interpolationEnv },
      );
      expect(first.body).toEqual({ message: 'hello', nested: { tag: 'dev' } });
      expect(nextSnapshot.body).toEqual({ message: 'changed-after-switch', nested: { tag: 'dev' } });
    });

    it('stream send uses frozen env not subsequent env binding (Phase 9I)', () => {
      const frozenEnv = createGrpcInterpolationEnvSnapshotFromMap({ greeting: 'frozen-at-start' });
      const resolved = resolveGrpcStudioStreamMessageBodyForSend(
        { message: '{{greeting}}' },
        frozenEnv,
      );
      expect(resolved).toEqual({ message: 'frozen-at-start' });
      const laterEnv = createGrpcInterpolationEnvSnapshotFromMap({ greeting: 'env-switched' });
      const stillFrozen = resolveGrpcStudioStreamMessageBodyForSend(
        { message: '{{greeting}}' },
        frozenEnv,
      );
      expect(stillFrozen).toEqual({ message: 'frozen-at-start' });
      const withLater = resolveGrpcStudioStreamMessageBodyForSend(
        { message: '{{greeting}}' },
        laterEnv,
      );
      expect(withLater).toEqual({ message: 'env-switched' });
    });
  });

  describe('checklist-3: missing grpcHost blocks execution with validation error', () => {
    it('returns invalid target validation for studio', () => {
      const tab = createGrpcStudioTab({
        target: '{{grpcHost}}',
        body: {},
        descriptorKey: FIXTURE.descriptorKey,
        service: FIXTURE.service,
        method: FIXTURE.method,
      });
      const resolution = resolveTabConnectionWithEnv(
        tab,
        { greeting: 'hello' },
        FIXTURE.profiles,
        FIXTURE.pageDefaults,
      );
      expect(resolution.targetValidation.valid).toBe(false);
      expect(resolution.targetValidation.reason).toMatch(/grpcHost|Resolve|Environment Manager/i);
    });

    it('throws at harness snapshot build for missing grpcHost', () => {
      expect(() => buildGrpcHarnessExecuteSnapshot(
        { scenario: makeHarnessScenario(), requestId: 'req-missing-9i' },
        {
          activeEnvironment: { greeting: 'hello' },
          profiles: FIXTURE.profiles,
          pageDefaults: FIXTURE.pageDefaults,
          resolveTemplate: () => '',
        },
      )).toThrow(/grpcHost|Resolve|Environment Manager/i);
    });
  });

  describe('checklist-4: nested body/metadata/auth interpolate without mutating schema keys', () => {
    it('deep-resolves nested body and metadata keys', () => {
      const resolved = resolveGrpcStudioTabFieldsForExecute(
        {
          body: FIXTURE.templates.body,
          metadata: FIXTURE.templates.metadata,
          auth: FIXTURE.templates.auth,
        },
        FIXTURE.env,
      );
      expect(resolved.body).toEqual({ message: 'hello', nested: { tag: 'dev' } });
      expect(resolved.metadata).toEqual({ 'x-env': 'dev' });
      expect(resolved.auth?.bearerToken).toBe('abc123');
      expect(Object.keys(resolved.body)).toEqual(['message', 'nested']);
    });

    it('resolves templated metadata keys after value interpolation', () => {
      const resolved = resolveGrpcStudioTabFieldsForExecute(
        {
          body: {},
          metadata: { '{{headerName}}': '{{envName}}' },
          auth: { type: 'none' },
        },
        { ...FIXTURE.env, headerName: 'x-tenant' },
      );
      expect(resolved.metadata).toEqual({ 'x-tenant': 'dev' });
    });

    it('matches harness nested body on shared fixture', () => {
      const harness = buildHarnessComparable();
      const studio = buildStudioComparable();
      expect(studio.body).toEqual(harness.body);
      expect(studio.metadata).toEqual(harness.metadata);
    });
  });

  describe('checklist-5: escaped braces remain literal', () => {
    it('preserves escaped greeting token in body', () => {
      const escaped = String.raw`\{{greeting}}`;
      const resolved = resolveGrpcStudioTabFieldsForExecute(
        { body: { message: escaped }, metadata: {}, auth: { type: 'none' } },
        FIXTURE.env,
      );
      expect(resolved.body).toEqual({ message: escaped });
    });

    it('matches harness escaped literal body', () => {
      const escaped = String.raw`\{{greeting}}`;
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
          requestId: 'req-escaped-9i',
        },
        {
          activeEnvironment: FIXTURE.env,
          profiles: FIXTURE.profiles,
          pageDefaults: FIXTURE.pageDefaults,
          resolveTemplate: () => '',
        },
      );
      const resolved = resolveGrpcStudioTabFieldsForExecute(
        { body: { message: escaped }, metadata: {}, auth: { type: 'none' } },
        FIXTURE.env,
      );
      expect(harness.execute.body).toEqual(resolved.body);
    });
  });

  describe('checklist-6: secret values never exposed in exported artifacts', () => {
    it('sanitized saved request keeps templates and redacts resolved literals', () => {
      const tab = createGrpcStudioTab({
        target: 'localhost:50051',
        body: { tokenRef: 'super-secret-bearer' },
        descriptorKey: FIXTURE.descriptorKey,
        service: FIXTURE.service,
        method: FIXTURE.method,
      });
      const snapshot = captureGrpcTabExecuteSnapshotFromResolution(
        tab,
        'req-secret-9i',
        resolveTabConnectionWithEnv(
          tab,
          FIXTURE.env,
          FIXTURE.profiles,
          FIXTURE.pageDefaults,
        ),
        'unary',
      );
      const saved = createGrpcSavedRequestFromSnapshot(
        snapshot,
        {
          id: 'saved-secret-9i',
          revisionId: 'rev-secret-9i',
          updatedAt: '2026-06-29T00:00:00.000Z',
        },
        { rawBody: { tokenRef: '{{bearerToken}}' } },
      );
      const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
        saved,
        buildGrpcSavedRequestTemplateSource({ rawBody: { tokenRef: '{{bearerToken}}' } }),
      );
      expect(JSON.stringify(sanitized)).not.toContain('super-secret-bearer');
      expect(sanitized.body).toEqual({ tokenRef: '{{bearerToken}}' });
    });
  });
});

describe('Phase 9I hardening deliverables', () => {
  it('registers npm gate scripts for phase 9I and full phase 9 chain', async () => {
    const pkg = JSON.parse(
      await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      ),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:grpc:phase9i']).toContain('test-grpc-phase9i.sh');
    expect(pkg.scripts?.['test:grpc:phase9']).toContain('test-grpc-phase9.sh');
  });

  it('exports stream message send resolver wired in useGrpcStreamSession', async () => {
    const studioExec = await import('./grpcStudioExecuteInterpolation');
    expect(typeof studioExec.resolveGrpcStudioStreamMessageBodyForSend).toBe('function');
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/useGrpcStreamSession.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('resolveGrpcStudioStreamMessageBodyForSend');
    expect(source).toContain('buildStreamValidationErrorBody');
    expect(source).toContain('cancelGrpcStream(streamId, tabId)');
    const helpersSource = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/grpcStreamSessionHelpers.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(helpersSource).toContain('buildStreamValidationErrorBody');
  });

  it('sub-phase acceptance files remain for 9A through 9H traceability', async () => {
    const fs = await import('fs/promises');
    for (const phase of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const) {
      const path = new URL(`./grpcPhase9${phase}Acceptance.test.ts`, import.meta.url);
      await expect(fs.access(path)).resolves.toBeUndefined();
    }
  });

  it('rejects unresolved stream message templates before transport', () => {
    const env = createGrpcInterpolationEnvSnapshotFromMap({});
    expect(() => resolveGrpcStudioStreamMessageBodyForSend(
      { message: '{{missing}}' },
      env,
    )).toThrow(/unresolved template variables/i);
  });

  it('rejects stream send when frozen env snapshot is absent', () => {
    expect(() => resolveGrpcStudioStreamMessageBodyForSend({ message: 'x' }, undefined))
      .toThrow(/active execute snapshot/i);
  });
});
