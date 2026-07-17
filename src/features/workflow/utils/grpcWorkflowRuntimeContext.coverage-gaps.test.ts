/**
 * Coverage gaps — grpcWorkflowRuntimeContext.ts
 */
import { describe, expect, it } from 'vitest';
import { VariableContext } from '../engine/variableContext';
import {
  createGrpcWorkflowNodeSnapshotContext,
  createGrpcWorkflowSnapshotBuildContext,
  mergeGrpcWorkflowRuntimeOverrides,
  resolveGrpcWorkflowPageDefaultTarget,
} from './grpcWorkflowRuntimeContext';

describe('grpcWorkflowRuntimeContext coverage gaps', () => {
  it('resolveGrpcWorkflowPageDefaultTarget keeps {{grpcHost}} template when env provides grpcHost', () => {
    const ctx = new VariableContext(undefined, { grpcHost: 'staging.example.com:50051' });
    const built = createGrpcWorkflowSnapshotBuildContext(ctx);
    expect(built.pageDefaults.target).toBe('{{grpcHost}}');
  });

  it('resolveGrpcWorkflowPageDefaultTarget falls back when {{grpcHost}} is absent', () => {
    expect(resolveGrpcWorkflowPageDefaultTarget({})).toBe('localhost:50051');
    const ctx = new VariableContext(undefined, {});
    const built = createGrpcWorkflowSnapshotBuildContext(ctx);
    expect(built.pageDefaults.target).toBe('localhost:50051');
  });

  it('createGrpcWorkflowNodeSnapshotContext uses execution runtime when provided', () => {
    const ctx = new VariableContext(undefined, { greeting: 'hi' });
    const built = createGrpcWorkflowNodeSnapshotContext(
      ctx,
      { tlsConfig: { serverCaPem: 'node-pem' } },
      {
        profiles: [{ id: 'p1', name: 'Exec', target: 'exec:50051', tlsMode: 'disabled' }],
        globalAuthProfiles: [{ id: 'a1', name: 'Auth', type: 'bearer', config: { token: 't' } }],
        defaultAuthProfileId: 'a1',
      },
    );
    expect(built.profiles).toHaveLength(1);
    expect(built.tlsConfig).toEqual({ serverCaPem: 'node-pem' });
    expect(built.globalAuthProfiles).toHaveLength(1);
    expect(built.defaultAuthProfileId).toBe('a1');
    expect(built.resolveTemplate('{{greeting}}')).toBe('hi');
  });

  it('createGrpcWorkflowNodeSnapshotContext loads profiles from storage without runtime', () => {
    const ctx = new VariableContext(undefined, {});
    const built = createGrpcWorkflowNodeSnapshotContext(ctx, {});
    expect(built.profiles).toEqual([]);
    expect(built.pageDefaults.tlsMode).toBe('disabled');
  });

  it('createGrpcWorkflowSnapshotBuildContext uses overrides when provided', () => {
    const ctx = new VariableContext(undefined, { greeting: 'hello' });
    const built = createGrpcWorkflowSnapshotBuildContext(ctx, {
      profiles: [{ id: 'p1', name: 'Local', target: 'localhost:50051', tlsMode: 'disabled' }],
      pageDefaults: { target: 'custom:50051', tlsMode: 'tls' },
      tlsConfig: { serverCaPem: 'pem' },
      sourceFingerprint: 'fp-1',
    });
    expect(built.resolveTemplate('{{greeting}}')).toBe('hello');
    expect(built.profiles).toHaveLength(1);
    expect(built.pageDefaults.target).toBe('custom:50051');
    expect(built.tlsConfig).toEqual({ serverCaPem: 'pem' });
    expect(built.sourceFingerprint).toBe('fp-1');
    expect(built.interpolationEnv.env.greeting).toBe('hello');
  });

  it('createGrpcWorkflowSnapshotBuildContext defaults profiles and page target from env', () => {
    const ctx = new VariableContext(undefined, { grpcHost: 'env-host:50051' });
    const built = createGrpcWorkflowSnapshotBuildContext(ctx);
    expect(built.profiles).toEqual([]);
    expect(built.pageDefaults.target).toBe('{{grpcHost}}');
    expect(built.pageDefaults.tlsMode).toBe('disabled');
  });

  it('mergeGrpcWorkflowRuntimeOverrides delegates to createGrpcWorkflowSnapshotBuildContext', () => {
    const ctx = new VariableContext(undefined, {});
    const merged = mergeGrpcWorkflowRuntimeOverrides(ctx, {
      pageDefaults: { target: 'merged:50051', tlsMode: 'disabled' },
    });
    expect(merged.pageDefaults.target).toBe('merged:50051');
  });

  it('createGrpcWorkflowSnapshotBuildContext rejects cyclic env variables (Phase 9E)', () => {
    const ctx = new VariableContext(undefined, {
      grpcHost: '{{apiHost}}',
      apiHost: '{{grpcHost}}',
    });
    expect(() => createGrpcWorkflowSnapshotBuildContext(ctx))
      .toThrow(/Circular variable reference/);
  });
});
