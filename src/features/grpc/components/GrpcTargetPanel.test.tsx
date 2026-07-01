/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrpcTargetPanel } from './GrpcTargetPanel';
import { GRPC_INTERPOLATION_ERROR_CODES } from '../../../shared/grpc/grpcInterpolationConstants';

describe('GrpcTargetPanel (Phase 4J-A validation strip)', () => {
  it('shows ready state when target resolves via env fallback', () => {
    render(
      <GrpcTargetPanel
        target=""
        fallbackTarget="{{grpcHost}}"
        envVarMap={{ grpcHost: 'localhost:50051' }}
        tlsMode="tls"
      />,
    );
    expect(screen.getByTestId('grpc-target-validation-strip')).toBeTruthy();
    expect(screen.getByTestId('grpc-target-status-ok').textContent).toBe('localhost:50051');
    expect(screen.getByTestId('grpc-target-validation').textContent).toMatch(/Ready/);
    expect(screen.getByTestId('grpc-interpolation-preview-strip')).toBeTruthy();
  });

  it('shows error state for invalid target', () => {
    render(
      <GrpcTargetPanel
        target="not-valid"
        envVarMap={{}}
      />,
    );
    expect(screen.getByTestId('grpc-target-status-error')).toBeTruthy();
    expect(screen.getByTestId('grpc-target-validation').textContent).not.toMatch(/Ready/);
  });

  it('hides preview strip for literal host:port without templates', () => {
    render(
      <GrpcTargetPanel
        target="localhost:50051"
        envVarMap={{}}
      />,
    );
    expect(screen.getByTestId('grpc-target-status-ok')).toBeTruthy();
    expect(screen.queryByTestId('grpc-interpolation-preview-strip')).toBeNull();
  });

  it('returns null when showValidation is false', () => {
    const { container } = render(
      <GrpcTargetPanel target="localhost:50051" envVarMap={{}} showValidation={false} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('GrpcTargetPanel (Phase 9G interpolation UX)', () => {
  it('shows template/resolved toggle and switches preview value', async () => {
    const user = userEvent.setup();
    render(
      <GrpcTargetPanel
        target="{{grpcHost}}"
        envVarMap={{ grpcHost: 'localhost:50051' }}
      />,
    );
    expect(screen.getByTestId('grpc-interpolation-preview-value').textContent).toBe('{{grpcHost}}');
    await user.click(screen.getByTestId('grpc-interpolation-preview-resolved'));
    expect(screen.getByTestId('grpc-interpolation-preview-value').textContent).toBe('localhost:50051');
  });

  it('shows cycle error banner with alert role', () => {
    render(
      <GrpcTargetPanel
        target="{{grpcHost}}"
        envVarMap={{
          grpcHost: '{{apiHost}}',
          apiHost: '{{grpcHost}}',
        }}
      />,
    );
    const banner = screen.getByTestId('grpc-interpolation-error-banner');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.getAttribute('data-code')).toBe(GRPC_INTERPOLATION_ERROR_CODES.CYCLE);
    expect(screen.getByTestId('grpc-interpolation-error-token-path').textContent).toMatch(/grpcHost/);
    expect(screen.getByTestId('grpc-target-validation').textContent)
      .toMatch(/Connection blocked until the interpolation issue above is resolved/);
    expect(screen.getByTestId('grpc-target-validation').textContent)
      .not.toMatch(/Circular variable reference/);
  });

  it('shows missing grpcHost banner without exposing secret env values', () => {
    render(
      <GrpcTargetPanel
        target="{{grpcHost}}"
        envVarMap={{ apiToken: 'super-secret-value' }}
      />,
    );
    expect(screen.getByTestId('grpc-interpolation-error-banner')).toBeTruthy();
    expect(screen.getByTestId('grpc-interpolation-error-message').textContent)
      .toMatch(/Environment Manager/i);
    expect(screen.getByTestId('grpc-target-panel-stack').textContent)
      .not.toMatch(/super-secret-value/);
    expect(screen.getByTestId('grpc-target-validation').textContent)
      .toMatch(/Connection blocked until the interpolation issue above is resolved/);
  });

  it('redacts secret-backed env values in resolved preview display', async () => {
    const user = userEvent.setup();
    render(
      <GrpcTargetPanel
        target="{{apiHost}}"
        envVarMap={{
          apiHost: 'secret-host.example.com:50051',
          bearerToken: 'secret-host.example.com:50051',
        }}
      />,
    );
    await user.click(screen.getByTestId('grpc-interpolation-preview-resolved'));
    expect(screen.getByTestId('grpc-interpolation-preview-value').textContent)
      .not.toMatch(/secret-host\.example\.com/);
    expect(screen.getByTestId('grpc-interpolation-preview-value').textContent)
      .toMatch(/\[REDACTED\]/);
  });

  it('shows invalid syntax error banner', () => {
    render(
      <GrpcTargetPanel
        target="{{9bad}}"
        envVarMap={{}}
      />,
    );
    const banner = screen.getByTestId('grpc-interpolation-error-banner');
    expect(banner.getAttribute('data-code')).toBe(GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX);
    expect(banner.getAttribute('role')).toBe('alert');
  });

  it('resets preview to template mode when draft target changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <GrpcTargetPanel
        target="{{grpcHost}}"
        envVarMap={{ grpcHost: 'localhost:50051' }}
      />,
    );
    await user.click(screen.getByTestId('grpc-interpolation-preview-resolved'));
    expect(screen.getByTestId('grpc-interpolation-preview-value').textContent).toBe('localhost:50051');

    rerender(
      <GrpcTargetPanel
        target="{{otherHost}}"
        envVarMap={{ otherHost: 'example.com:50051' }}
      />,
    );
    expect(screen.getByTestId('grpc-interpolation-preview-template').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('grpc-interpolation-preview-value').textContent).toBe('{{otherHost}}');
  });
});
