/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { GrpcMethodDetailPanel } from './GrpcMethodDetailPanel';

describe('GrpcMethodDetailPanel (Phase 1E)', () => {
  it('shows empty state when no method selected', () => {
    render(
      <GrpcMethodDetailPanel
        descriptor={FIXTURE_DESCRIPTOR}
      />,
    );

    expect(screen.getByTestId('grpc-method-detail-empty')).toBeTruthy();
  });

  it('shows stale binding when selection exists without descriptor', () => {
    render(
      <GrpcMethodDetailPanel
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    expect(screen.getByTestId('grpc-method-detail-stale')).toBeTruthy();
  });

  it('shows stale binding message when selection is not in descriptor', () => {
    render(
      <GrpcMethodDetailPanel
        descriptor={FIXTURE_DESCRIPTOR}
        selectedService="echo.EchoService"
        selectedMethod="MissingMethod"
      />,
    );

    expect(screen.getByTestId('grpc-method-detail-stale')).toBeTruthy();
  });

  it('renders method metadata for valid selection', () => {
    render(
      <GrpcMethodDetailPanel
        descriptor={FIXTURE_DESCRIPTOR}
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    expect(screen.getByTestId('grpc-method-detail-service').textContent).toBe('echo.EchoService');
    expect(screen.getByTestId('grpc-method-detail-heading').textContent).toMatch(/EchoService \/ Echo/);
    expect(screen.getByTestId('grpc-call-method-name').textContent).toMatch(/EchoService \/ Echo/);
    expect(screen.getByTestId('grpc-method-detail-field-count').textContent).toBe('1 request field');
    expect(screen.getByTestId('grpc-method-call-type').className).toContain('grpc-method-detail-badge--ready');
    expect(screen.getByTestId('grpc-method-unary-ready').textContent).toBe('Ready to send');
  });

  it('renders stale method snapshot when provided for blocking drift', () => {
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo')!;
    render(
      <GrpcMethodDetailPanel
        descriptor={FIXTURE_DESCRIPTOR}
        selectedService="echo.EchoService"
        selectedMethod="Echo"
        staleMethod={echoMethod}
      />,
    );

    expect(screen.getByTestId('grpc-method-detail-heading').textContent).toMatch(/Echo/);
  });

  it('renders streaming-ready hint for streaming methods', () => {
    render(
      <GrpcMethodDetailPanel
        descriptor={FIXTURE_DESCRIPTOR}
        selectedService="echo.EchoService"
        selectedMethod="ServerStream"
      />,
    );

    expect(screen.getByTestId('grpc-method-streaming-ready').textContent).toBe('Streaming-ready');
    expect(screen.queryByTestId('grpc-method-unary-ready')).toBeNull();
  });
});
