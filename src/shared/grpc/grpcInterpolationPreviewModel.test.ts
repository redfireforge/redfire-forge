import { describe, expect, it } from 'vitest';
import {
  buildGrpcInterpolationTargetPreviewState,
  resolveGrpcInterpolationPreviewDisplayValue,
  shouldShowGrpcInterpolationErrorBanner,
  shouldShowGrpcInterpolationPreviewToggle,
} from './grpcInterpolationPreviewModel';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';

describe('grpcInterpolationPreviewModel (Phase 9G)', () => {
  it('shows toggle for template targets', () => {
    expect(shouldShowGrpcInterpolationPreviewToggle('{{grpcHost}}', 'localhost:50051')).toBe(true);
  });

  it('hides toggle for literal host:port with no templates', () => {
    expect(shouldShowGrpcInterpolationPreviewToggle('localhost:50051', 'localhost:50051')).toBe(false);
  });

  it('hides toggle for escaped literal drafts (Phase 9B grammar)', () => {
    expect(shouldShowGrpcInterpolationPreviewToggle(String.raw`\{{grpcHost}}`, String.raw`\{{grpcHost}}`)).toBe(false);
  });

  it('builds resolved display when view mode is resolved and validation ok', () => {
    const state = buildGrpcInterpolationTargetPreviewState({
      draftTarget: '{{grpcHost}}',
      resolvedTarget: 'localhost:50051',
      viewMode: 'resolved',
      ok: true,
      normalized: 'localhost:50051',
    });
    expect(state.displayValue).toBe('localhost:50051');
    expect(state.status).toBe('ready');
    expect(state.showToggle).toBe(true);
  });

  it('builds template display when view mode is template', () => {
    const state = buildGrpcInterpolationTargetPreviewState({
      draftTarget: '{{grpcHost}}',
      resolvedTarget: '{{grpcHost}}',
      viewMode: 'template',
      ok: false,
      issue: {
        field: 'target',
        code: GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN,
        message: '{{grpcHost}} is not configured for the active environment',
      },
    });
    expect(state.displayValue).toBe('{{grpcHost}}');
    expect(state.status).toBe('error');
    expect(state.diagnostic?.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN);
  });

  it('flags cycle diagnostics for error banner', () => {
    const diagnostic = {
      code: GRPC_INTERPOLATION_ERROR_CODES.CYCLE,
      message: 'Circular variable reference: a → b → a',
      tokenPath: ['a', 'b', 'a'],
    };
    expect(shouldShowGrpcInterpolationErrorBanner(diagnostic)).toBe(true);
  });

  it('does not show banner for generic invalid target without token/cycle codes', () => {
    expect(shouldShowGrpcInterpolationErrorBanner({
      code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
      message: 'Target must be host:port',
    })).toBe(false);
  });

  it('redacts secret env values from resolved preview display (Phase 9G)', () => {
    const value = resolveGrpcInterpolationPreviewDisplayValue(
      'resolved',
      '{{apiHost}}',
      'secret-host.example.com:50051',
      'secret-host.example.com:50051',
      { bearerToken: 'secret-host.example.com:50051' },
    );
    expect(value).not.toContain('secret-host.example.com');
    expect(value).toContain(GRPC_REDACTED_PLACEHOLDER);
  });
});
