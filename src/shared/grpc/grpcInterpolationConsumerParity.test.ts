/**
 * Phase 9B — cross-consumer resolver parity tests.
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { createGrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';
import { resolveGrpcHarnessJsonValue } from './grpcHarnessTemplateResolver';
import { resolveGrpcWorkflowJsonValue } from '../../features/workflow/utils/grpcWorkflowTemplateResolver';
import { substituteGrpcHarnessTemplateVars } from './grpcHarnessDataSourceInterpolation';
import { resolveTabConnectionWithEnv } from '../../features/grpc/hooks/grpcStudioSessionHelpers';
import { useGrpcTargetValidation } from '../../features/grpc/hooks/useGrpcTargetValidation';
import { createGrpcStudioTab } from '../../features/grpc/grpcStudioTypes';
import { renderHook } from '@testing-library/react';

describe('grpcInterpolation consumer parity (Phase 9B)', () => {
  const env = {
    grpcHost: 'localhost:50051',
    greeting: 'hello',
    token: 'secret',
  };

  it('resolves identical strings across harness, workflow, and shared resolver', () => {
    const template = 'grpc://{{grpcHost}}/{{greeting}}';
    const shared = createGrpcInterpolationTemplateResolver(env);
    expect(shared(template)).toBe('grpc://localhost:50051/hello');
    expect(resolveGrpcHarnessJsonValue({ msg: template }, shared)).toEqual({
      msg: 'grpc://localhost:50051/hello',
    });
    expect(resolveGrpcWorkflowJsonValue({ msg: template }, shared)).toEqual({
      msg: 'grpc://localhost:50051/hello',
    });
    expect(substituteGrpcHarnessTemplateVars(template, env)).toBe('grpc://localhost:50051/hello');
  });

  it('preserves escaped literals consistently across consumers', () => {
    const escaped = String.raw`\{{grpcHost}}`;
    const shared = createGrpcInterpolationTemplateResolver(env);
    expect(shared(escaped)).toBe(escaped);
    expect(substituteGrpcHarnessTemplateVars(escaped, env)).toBe(escaped);
    expect(resolveGrpcHarnessJsonValue({ note: escaped }, shared)).toEqual({ note: escaped });
  });

  it('resolveTabConnectionWithEnv uses the shared resolver for tab targets', () => {
    const tab = createGrpcStudioTab();
    tab.target = '{{grpcHost}}';
    const resolution = resolveTabConnectionWithEnv(tab, env, [], {
      target: 'fallback:50051',
      tlsMode: 'disabled',
    });
    expect(resolution.target).toBe('localhost:50051');
  });

  it('resolveTabConnectionWithEnv preserves escaped target literals', () => {
    const escaped = String.raw`\{{grpcHost}}`;
    const tab = createGrpcStudioTab();
    tab.target = escaped;
    const resolution = resolveTabConnectionWithEnv(tab, env, [], {
      target: 'fallback:50051',
      tlsMode: 'disabled',
    });
    expect(resolution.target).toBe(escaped);
    expect(resolution.targetValidation.valid).toBe(false);
  });

  it('useGrpcTargetValidation matches resolveTabConnectionWithEnv resolution', () => {
    const tab = createGrpcStudioTab();
    tab.target = '{{grpcHost}}';
    const executionTarget = resolveTabConnectionWithEnv(tab, env, [], {
      target: 'fallback:50051',
      tlsMode: 'disabled',
    }).target;

    const { result } = renderHook(() => useGrpcTargetValidation({
      target: tab.target,
      envVarMap: env,
    }));
    expect(result.current.resolvedTarget).toBe(executionTarget);
    expect(result.current.ok).toBe(true);
  });

  it('grpc header preview matches execution resolver for escaped targets', async () => {
    const { computeGrpcStudioTargetPreview } = await import('./grpcStudioTargetPreview');
    const escaped = String.raw`\{{grpcHost}}`;
    const tab = createGrpcStudioTab();
    tab.target = escaped;
    const executionTarget = resolveTabConnectionWithEnv(tab, env, [], {
      target: 'fallback:50051',
      tlsMode: 'disabled',
    }).target;
    const preview = computeGrpcStudioTargetPreview(escaped, env, 'explicit');
    expect(preview.resolvedUrl).toBe(executionTarget);
  });

  it('studio validation and preview drafts align for profile template targets', () => {
    const tabTarget = '';
    const rawConnectionTarget = '{{grpcHost}}';
    const previewDraft = tabTarget.trim() || rawConnectionTarget || '{{grpcHost}}';
    const validationDraft = tabTarget.trim() || rawConnectionTarget;
    const resolver = createGrpcInterpolationTemplateResolver(env);
    expect(resolver(previewDraft)).toBe(resolver(validationDraft));
    expect(resolver(previewDraft)).toBe('localhost:50051');
  });
});
