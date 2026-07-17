/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { GrpcMethodDetailPanel } from './GrpcMethodDetailPanel';

describe('GrpcMethodDetailPanel coverage gaps', () => {
  it('renders docComment when present on method', () => {
    const echoWithDoc = {
      ...FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!,
      docComment: 'Echoes the request message back to the caller.',
    };
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((m) =>
          m.name === 'Echo' ? echoWithDoc : m,
        ),
      }],
    };

    render(
      <GrpcMethodDetailPanel
        descriptor={descriptor}
        selectedService="echo.EchoService"
        selectedMethod="Echo"
      />,
    );

    expect(screen.getByText(/Echoes the request message/)).toBeTruthy();
  });

  it('falls back to staleMethod when descriptor no longer contains selection', () => {
    const staleMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
    render(
      <GrpcMethodDetailPanel
        selectedService="echo.EchoService"
        selectedMethod="Echo"
        staleMethod={staleMethod}
      />,
    );

    expect(screen.getByTestId('grpc-method-detail-heading').textContent).toMatch(/Echo/);
    expect(screen.getByTestId('grpc-method-call-type').className).toContain('grpc-method-detail-badge--ready');
  });

  it('falls back to staleMethod when descriptor is present but method is missing', () => {
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
    render(
      <GrpcMethodDetailPanel
        descriptor={FIXTURE_DESCRIPTOR}
        selectedService="echo.EchoService"
        selectedMethod="MissingMethod"
        staleMethod={echoMethod}
      />,
    );
    expect(screen.getByTestId('grpc-method-detail-heading').textContent).toMatch(/Echo/);
    expect(screen.getByTestId('grpc-method-call-type').className).toContain('grpc-method-detail-badge--ready');
  });

  it('renders no ready hint for unsupported call types', () => {
    const neitherReady = {
      ...FIXTURE_DESCRIPTOR.services[0]!.methods[0]!,
      name: 'CustomRpc',
      callType: 'other' as never,
    };
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: [neitherReady],
      }],
    };

    render(
      <GrpcMethodDetailPanel
        descriptor={descriptor}
        selectedService="echo.EchoService"
        selectedMethod="CustomRpc"
      />,
    );

    expect(screen.queryByTestId('grpc-method-streaming-ready')).toBeNull();
    expect(screen.getByTestId('grpc-method-call-type').className).not.toContain('--ready');
  });
});
