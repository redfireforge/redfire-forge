/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FIXTURE_DESCRIPTOR, FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { createGrpcStudioTab } from '../grpcStudioTypes';
import { GrpcCallPanel } from './GrpcCallPanel';
import { ECHO_METHOD } from './GrpcCallPanel.testHelpers';

describe('GrpcCallPanel auth/TLS/hints (Phase 4)', () => {
  const method = ECHO_METHOD;

  it('focuses auth tab when authTabFocusRequest increments (Phase 4J-A)', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
      descriptorKey: FIXTURE_DESCRIPTOR.key,
    });

    const { rerender } = render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        authTabFocusRequest={0}
      />,
    );

    expect(screen.getByTestId('grpc-request-tab-form').className).toMatch(/active/);

    rerender(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        authTabFocusRequest={1}
      />,
    );

    expect(screen.getByTestId('grpc-request-tab-auth').className).toMatch(/active/);
    expect(screen.getByTestId('grpc-auth-panel')).toBeTruthy();
  });

  it('allows switching away from auth when authTabFocusRequest does not increment', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      auth: {
        type: 'api_key',
        apiKey: { key: 'x-api-key', value: 'my-key-123', addTo: 'metadata' },
      },
    });

    const { rerender } = render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        authTabFocusRequest={1}
      />,
    );

    expect(screen.getByTestId('grpc-request-tab-auth').className).toMatch(/active/);

    fireEvent.click(screen.getByTestId('grpc-request-tab-metadata'));

    expect(screen.getByTestId('grpc-request-tab-metadata').className).toMatch(/active/);

    rerender(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        authTabFocusRequest={1}
      />,
    );

    expect(screen.getByTestId('grpc-request-tab-metadata').className).toMatch(/active/);
  });

  it('focuses auth tab from connection bar even when metadata tab has validation errors (Phase 4J-A)', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: { 'payload-bin': '%%%' },
      descriptorKey: FIXTURE_DESCRIPTOR.key,
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        authTabFocusRequest={1}
      />,
    );

    expect(screen.getByTestId('grpc-request-tab-auth').className).toMatch(/active/);
    expect(screen.getByTestId('grpc-auth-panel')).toBeTruthy();
  });

  it('focuses auth tab via tab button even when metadata editor has errors (Phase 4J-A)', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
      descriptorKey: FIXTURE_DESCRIPTOR.key,
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-metadata'));
    fireEvent.click(screen.getByText('+ Add'));
    fireEvent.change(screen.getAllByPlaceholderText('Value')[0]!, {
      target: { value: 'orphan-value' },
    });

    fireEvent.click(screen.getByTestId('grpc-request-tab-auth'));

    expect(screen.getByTestId('grpc-request-tab-auth').className).toMatch(/active/);
    expect(screen.getByTestId('grpc-auth-panel')).toBeTruthy();
  });

  it('shows send block hint when auth is incomplete (Phase 4C)', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      auth: { type: 'bearer', bearerToken: '' },
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-send-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('grpc-call-send-block-hint').textContent).toMatch(/Bearer token/i);
  });

  it('keeps send enabled when oauth2 config is incomplete and falls back to no auth', () => {
    // tokenUrl is set but clientId/clientSecret are missing — hasTypedOAuth2Input = true so
    // the panel shows the "without OAuth2" fallback hint instead of blocking send.
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      auth: {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: '',
          clientSecret: '',
          scope: '',
        },
      },
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-send-btn') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('grpc-call-send-block-hint').textContent).toMatch(/without OAuth2/i);
  });

  it('shows send block hint for invalid persisted metadata from auth tab (Phase 4C)', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: { 'payload-bin': '%%%' },
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      auth: { type: 'bearer', bearerToken: 'valid-token' },
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        tlsValid
        onPatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-auth'));
    expect((screen.getByTestId('grpc-send-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('grpc-call-send-block-hint').textContent).toMatch(/base64/i);
  });

  it('shows send block hint when TLS config is invalid (Phase 4B)', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      tlsMode: 'mtls',
      tlsConfig: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        tlsValid={false}
        onPatch={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-send-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('grpc-call-send-block-hint').textContent).toMatch(/TLS configuration/i);
  });

  it('allows send from auth tab when form tab had no blocking errors (Phase 4C)', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      auth: { type: 'bearer', bearerToken: 'valid-token' },
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        tlsValid
        onPatch={vi.fn()}
        onSendUnary={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-auth'));
    const sendBtn = screen.getByTestId('grpc-send-btn') as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(false);
  });

  it('shows Spring health Actuator hint for health.v1.Health Check (Phase 4G)', () => {
    const healthService = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services.find(
      (service) => service.fullName === 'health.v1.Health',
    )!;
    const healthMethod = healthService.methods.find((entry) => entry.name === 'Check')!;
    const tab = createGrpcStudioTab({
      service: 'health.v1.Health',
      method: 'Check',
      body: { service: '' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={healthMethod}
        serviceFullName="health.v1.Health"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-spring-hint-spring_health_actuator')).toBeTruthy();
  });

  it('shows PERMISSION_DENIED hint on stream terminal status 7 (Phase 4G)', () => {
    const watchMethod = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services
      .find((service) => service.fullName === 'health.v1.Health')!
      .methods.find((entry) => entry.name === 'Watch')!;
    const tab = createGrpcStudioTab({
      service: 'health.v1.Health',
      method: 'Watch',
      body: { service: '' },
      metadata: {},
      streamLifecycle: 'error',
      streamError: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'The server rejected the call credentials (authentication or permission denied).',
        details: { grpcStatus: 7, authFailure: 'auth_denied' },
      },
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={watchMethod}
        serviceFullName="health.v1.Health"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-stream-response-hints')).toBeTruthy();
    expect(screen.getByTestId('grpc-spring-hint-spring_permission_denied')).toBeTruthy();
  });
});

