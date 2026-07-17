/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GrpcInterpolationErrorBanner } from './GrpcInterpolationErrorBanner';
import { GRPC_INTERPOLATION_ERROR_CODES } from '../../../shared/grpc/grpcInterpolationConstants';

describe('GrpcInterpolationErrorBanner (Phase 9G)', () => {
  it('renders cycle banner with token path and alert role', () => {
    render(
      <GrpcInterpolationErrorBanner
        diagnostic={{
          code: GRPC_INTERPOLATION_ERROR_CODES.CYCLE,
          message: 'Circular variable reference: grpcHost → apiHost → grpcHost',
          tokenPath: ['grpcHost', 'apiHost', 'grpcHost'],
        }}
      />,
    );
    const banner = screen.getByTestId('grpc-interpolation-error-banner');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('grpc-interpolation-error-message').textContent)
      .toMatch(/Circular variable reference/);
    expect(screen.getByTestId('grpc-interpolation-error-token-path').textContent)
      .toMatch(/grpcHost/);
    expect(screen.getByTestId('grpc-interpolation-error-token-path').textContent)
      .toMatch(/apiHost/);
  });

  it('renders missing token banner without path chips', () => {
    render(
      <GrpcInterpolationErrorBanner
        diagnostic={{
          code: GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN,
          message: '{{grpcHost}} is not configured for the active environment',
        }}
      />,
    );
    expect(screen.getByText('Unresolved environment variable')).toBeTruthy();
    expect(screen.queryByTestId('grpc-interpolation-error-token-path')).toBeNull();
  });

  it('never renders raw secret values when message is pre-sanitized', () => {
    render(
      <GrpcInterpolationErrorBanner
        diagnostic={{
          code: GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN,
          message: 'Resolve {{apiToken}} before connecting',
        }}
      />,
    );
    expect(screen.getByTestId('grpc-interpolation-error-message').textContent)
      .not.toMatch(/super-secret-value/);
  });

  it('renders invalid syntax and generic interpolation error titles', () => {
    const { rerender } = render(
      <GrpcInterpolationErrorBanner
        diagnostic={{
          code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX,
          message: 'Invalid token name in {{}}',
        }}
      />,
    );
    expect(screen.getByText('Invalid interpolation syntax')).toBeTruthy();

    rerender(
      <GrpcInterpolationErrorBanner
        diagnostic={{
          code: GRPC_INTERPOLATION_ERROR_CODES.SERIALIZATION,
          message: 'Template persistence failed',
        }}
      />,
    );
    expect(screen.getByText('Interpolation error')).toBeTruthy();
  });
});
