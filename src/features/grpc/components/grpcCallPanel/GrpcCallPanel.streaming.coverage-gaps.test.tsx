/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { FIXTURE_DESCRIPTOR, FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '../../../../shared/grpc/contractFixtures';
import { createGrpcStudioTab } from '../../grpcStudioTypes';
import { GrpcCallPanel } from '../GrpcCallPanel';
import {
  BIDI_STREAM,
  CLIENT_STREAM,
  clickByTestIdAsync,
  ECHO_METHOD,
  SERVER_STREAM,
} from './grpcCallPanelCoverageGaps.testHelpers';

describe('GrpcCallPanel coverage gaps — streaming and compose', () => {
  it('renders streaming panel for server streaming methods', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hi' },
      streamLifecycle: 'streaming',
      streamMessages: [{ direction: 'inbound', sequence: 1, timestamp: 't', data: { message: 'ok' } }],
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={SERVER_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onCancelStream={vi.fn()}
        onClearStreamLog={vi.fn()}
        onEndStream={vi.fn()}
        onSendStreamMessage={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-stream-panel')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-stream-cancel-btn'));
    expect(screen.getByTestId('grpc-stream-cancel-btn')).toBeTruthy();
  });

  it('renders client and bidi stream compose panels', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'ClientStream',
      body: { message: 'hi' },
      streamLifecycle: 'idle',
    });

    const { rerender } = render(
      <GrpcCallPanel
        tab={tab}
        method={CLIENT_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onStartStream={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-stream-panel')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-stream-start-btn'));

    rerender(
      <GrpcCallPanel
        tab={{ ...tab, method: 'BidiStream' }}
        method={BIDI_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onStartStream={vi.fn()}
      />,
    );
    expect(document.querySelector('.grpc-stream-panel--bidi')).toBeTruthy();
  });

  it('renders non-hybrid form composer when hybrid workspace is unavailable', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      requestMode: 'form',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('grpc-open-full-form-editor-btn-inline')).toBeNull();
    expect(screen.getByTestId('grpc-proto-field-input-message')).toBeTruthy();
  });

  it.skip('switches to JSON composer and surfaces parse validation errors', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      requestMode: 'form',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-form'));
    fireEvent.change(screen.getByTestId('grpc-request-json'), { target: { value: '[]' } });
    expect(screen.getByTestId('grpc-request-json-error').textContent).toMatch(/JSON object/i);
  });

  it('focuses auth tab when authTabFocusRequest increments', () => {
    const tab = createGrpcStudioTab({ metadata: {}, body: {} });
    const { rerender } = render(
      <GrpcCallPanel
        tab={tab}
        targetValid
        onPatch={vi.fn()}
        authTabFocusRequest={0}
      />,
    );
    rerender(
      <GrpcCallPanel
        tab={tab}
        targetValid
        onPatch={vi.fn()}
        authTabFocusRequest={1}
      />,
    );
    expect(screen.getByTestId('grpc-auth-type-select')).toBeTruthy();
  });

  it('shows health hint for health check method on multi-service descriptor', () => {
    const healthMethod = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services
      .find((s) => s.fullName === 'health.v1.Health')!
      .methods.find((m) => m.name === 'Check')!;
    const tab = createGrpcStudioTab({
      service: 'health.v1.Health',
      method: 'Check',
      body: { service: '' },
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
    fireEvent.click(screen.getByLabelText('Dismiss Spring Boot Actuator health hint'));
    expect(screen.queryByTestId('grpc-spring-hint-spring_health_actuator')).toBeNull();
  });

  it('shows empty method state and switches composer tabs', () => {
    const tab = createGrpcStudioTab({ body: {}, metadata: {} });
    render(
      <GrpcCallPanel
        tab={tab}
        targetValid
        onPatch={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-call-panel-empty')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-request-tab-auth'));
    expect(screen.getByTestId('grpc-auth-type-select')).toBeTruthy();
  });

  it('renders files tab and supports remove and clear actions', () => {
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={echoMethod}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-files'));
    expect(screen.getByTestId('grpc-request-files-empty')).toBeTruthy();

    const input = screen.getByTestId('grpc-request-files-input') as HTMLInputElement;
    const first = new File(['hello'], 'payload.bin', { type: 'application/octet-stream' });
    const second = new File(['abc'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [first, second] } });

    expect(screen.getByTestId('grpc-request-files-count').textContent).toContain('2 selected');
    expect(screen.getByTestId('grpc-request-files-list').textContent).toContain('payload.bin');
    expect(screen.getByTestId('grpc-request-files-list').textContent).toContain('avatar.png');

    fireEvent.click(screen.getByTestId('grpc-request-files-remove-0'));
    expect(screen.getByTestId('grpc-request-files-count').textContent).toContain('1 selected');
    expect(screen.getByTestId('grpc-request-files-list').textContent).toContain('avatar.png');
    expect(screen.getByTestId('grpc-request-files-list').textContent).not.toContain('payload.bin');

    fireEvent.click(screen.getByTestId('grpc-request-files-clear'));
    expect(screen.getByTestId('grpc-request-files-empty')).toBeTruthy();
  });

  it('shows cancel button during unary in-flight lifecycle', () => {
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      lifecycle: 'calling',
    });
    const onCancelUnary = vi.fn();

    render(
      <GrpcCallPanel
        tab={tab}
        method={echoMethod}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onCancelUnary={onCancelUnary}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-cancel-btn'));
    expect(onCancelUnary).toHaveBeenCalled();
  });

  it('invokes onSendUnary when send button is clicked', async () => {
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      lifecycle: 'idle',
    });
    const onSendUnary = vi.fn();

    render(
      <GrpcCallPanel
        tab={tab}
        method={echoMethod}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onSendUnary={onSendUnary}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('grpc-send-btn'));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(onSendUnary).toHaveBeenCalled();
  });

  it('reuses send and cancel handlers from the mobile action bar', async () => {
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
    const onSendUnary = vi.fn();
    const onCancelUnary = vi.fn();
    const callingTab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      lifecycle: 'calling',
    });

    const { rerender } = render(
      <GrpcCallPanel
        tab={callingTab}
        method={echoMethod}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onSendUnary={onSendUnary}
        onCancelUnary={onCancelUnary}
      />,
    );

    expect(screen.getByTestId('grpc-call-mobile-action-bar')).toBeTruthy();
    expect(screen.getByTestId('grpc-mobile-primary-action')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-mobile-cancel-action'));
    expect(onCancelUnary).toHaveBeenCalled();

    const idleTab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      lifecycle: 'idle',
    });

    rerender(
      <GrpcCallPanel
        tab={idleTab}
        method={echoMethod}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onSendUnary={onSendUnary}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('grpc-mobile-primary-action'));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(onSendUnary).toHaveBeenCalled();
  });

  it('shows stream error, TLS hint, and clears stream log', () => {
    const onClearStreamLog = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hi' },
      streamLifecycle: 'error',
      streamError: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'certificate has expired',
        details: { tlsFailure: 'expired_cert' },
      },
      streamMessages: [{ direction: 'inbound', sequence: 1, timestamp: 't', data: { message: 'ok' } }],
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={SERVER_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onClearStreamLog={onClearStreamLog}
      />,
    );

    expect(screen.getByTestId('grpc-stream-error').textContent).toMatch(/expired/i);
    expect(screen.getByTestId('grpc-stream-tls-hint')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-stream-clear-log'));
    expect(onClearStreamLog).toHaveBeenCalled();
  });

  it('blocks send with TLS hint when tlsValid is false', () => {
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={echoMethod}
        serviceFullName="echo.EchoService"
        targetValid
        tlsValid={false}
        onPatch={vi.fn()}
        onSendUnary={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-call-send-block-hint').textContent).toMatch(/TLS configuration/i);
  });

  it('updates timeoutMs from deadline input', () => {
    const onPatch = vi.fn();
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
      timeoutMs: 30_000,
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={echoMethod}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-call-timeout-input'), { target: { value: '45000' } });
    expect(onPatch).toHaveBeenCalledWith({ timeoutMs: 45000 });
  });

  it.skip('switches from JSON editor back to form tab', () => {
    const onPatch = vi.fn();
    const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'seed' },
      metadata: {},
      requestMode: 'json',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={echoMethod}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-form'));
    fireEvent.click(screen.getByTestId('grpc-request-tab-form'));
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ requestMode: 'form' }));
    expect(screen.getByTestId('grpc-proto-form')).toBeTruthy();
  });

  it('wires auth panel secret handlers', () => {
    const onPatch = vi.fn();
    const onUnmaskAuthSecretField = vi.fn();
    const onClearAuthSecretField = vi.fn();
    const tab = createGrpcStudioTab({
      metadata: {},
      body: {},
      auth: { type: 'bearer', bearerToken: 'secret-token-value' },
      maskedSecretFields: { auth: { bearerToken: true } },
    });

    render(
      <GrpcCallPanel
        tab={tab}
        targetValid
        onPatch={onPatch}
        onUnmaskAuthSecretField={onUnmaskAuthSecretField}
        onClearAuthSecretField={onClearAuthSecretField}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-auth'));
    fireEvent.click(screen.getByTestId('grpc-auth-bearer-token-clear'));
    expect(onClearAuthSecretField).toHaveBeenCalledWith('bearerToken');
    fireEvent.change(screen.getByTestId('grpc-auth-bearer-token'), { target: { value: 'x' } });
    expect(onUnmaskAuthSecretField).toHaveBeenCalledWith('bearerToken');
  });

  it('shows unary response shell by default when no method is selected', () => {
    const tab = createGrpcStudioTab({
      body: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        targetValid
        onPatch={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('grpc-call-type-selector')).toBeNull();
    expect(screen.queryByTestId('grpc-stream-panel')).toBeNull();
    expect(screen.getByTestId('grpc-response-panel')).toBeTruthy();
  });

  it('invokes stream compose callbacks for client streaming', async () => {
    const onEndStream = vi.fn();
    const onEnqueueStreamMessage = vi.fn();
    const onSendAllPendingStreamMessages = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'ClientStream',
      body: { message: 'hi' },
      streamLifecycle: 'streaming',
      streamPendingBodies: [{ message: 'queued' }],
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={CLIENT_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onEnqueueStreamMessage={onEnqueueStreamMessage}
        onSendAllPendingStreamMessages={onSendAllPendingStreamMessages}
        onEndStream={onEndStream}
      />,
    );

    await clickByTestIdAsync('grpc-stream-add-queue-btn');
    await clickByTestIdAsync('grpc-stream-send-all-btn');
    await clickByTestIdAsync('grpc-stream-pending-end-btn');
    expect(onEnqueueStreamMessage).toHaveBeenCalled();
    expect(onSendAllPendingStreamMessages).toHaveBeenCalled();
    expect(onEndStream).toHaveBeenCalled();
  });

});
