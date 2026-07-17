/**
 * Integration coverage for useGrpcCallPanel via GrpcCallPanel rendering.
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '../../../../shared/grpc/contractFixtures';
import { createGrpcStudioTab } from '../../grpcStudioTypes';
import { GrpcCallPanel } from '../GrpcCallPanel';

const SERVER_STREAM = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'ServerStream')!;
const CLIENT_STREAM = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'ClientStream')!;
const ECHO_METHOD = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;

describe('useGrpcCallPanel integration coverage gaps', () => {
  it('covers streaming, mobile stages, TLS hint, timeout, and executeBlocked paths', async () => {
    const onPatch = vi.fn();
    const onCancelStream = vi.fn();
    const onSendUnary = vi.fn();
    const streamTab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hi' },
      streamLifecycle: 'streaming',
      streamError: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'certificate has expired',
        details: { tlsFailure: 'expired_cert' },
      },
      streamMessages: [{ direction: 'inbound', sequence: 1, timestamp: 't', data: { message: 'ok' } }],
    });

    const { rerender } = render(
      <GrpcCallPanel
        tab={streamTab}
        method={SERVER_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        executeBlocked
        onPatch={onPatch}
        onCancelStream={onCancelStream}
        onClearStreamLog={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-stream-tls-hint')).toBeTruthy();
    expect((screen.getByTestId('grpc-stream-cancel-btn') as HTMLButtonElement).disabled).toBe(true);

    const echoTab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      timeoutMs: 30_000,
    });
    rerender(
      <GrpcCallPanel
        tab={echoTab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        tlsValid={false}
        onPatch={onPatch}
        onSendUnary={onSendUnary}
      />,
    );
    expect(screen.getByTestId('grpc-call-send-block-hint').textContent).toMatch(/TLS configuration/i);
    fireEvent.change(screen.getByTestId('grpc-call-timeout-input'), { target: { value: '45000' } });
    expect(onPatch).toHaveBeenCalledWith({ timeoutMs: 45000 });

    fireEvent.click(screen.getByTestId('grpc-mobile-stage-response'));
    fireEvent.click(screen.getByTestId('grpc-mobile-stage-metadata'));
    fireEvent.click(screen.getByTestId('grpc-mobile-stage-auth'));
    fireEvent.click(screen.getByTestId('grpc-mobile-stage-request'));
  });

  it('covers auth focus, health hint, files tab, and unary send with uploaded bytes', async () => {
    const onSendUnary = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { payload: '' },
    });

    const readAsDataURL = vi.fn(function (this: FileReader) {
      queueMicrotask(() => {
        Object.defineProperty(this, 'result', { value: 'data:application/octet-stream;base64,YWJj', configurable: true });
        this.onload?.({ target: this } as ProgressEvent<FileReader>);
      });
    });
    vi.stubGlobal('FileReader', class {
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      readAsDataURL = readAsDataURL;
    });

    const { rerender } = render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onSendUnary={onSendUnary}
        authTabFocusRequest={1}
      />,
    );
    expect(screen.getByTestId('grpc-auth-type-select')).toBeTruthy();

    fireEvent.click(screen.getByTestId('grpc-request-tab-files'));
    const file = new File(['abc'], 'payload.bin', { type: 'application/octet-stream' });
    fireEvent.change(screen.getByTestId('grpc-request-files-input'), { target: { files: [file] } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('grpc-send-btn'));
    });
    expect(onSendUnary).toHaveBeenCalled();

    const healthMethod = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services
      .find((s) => s.fullName === 'health.v1.Health')!
      .methods.find((m) => m.name === 'Check')!;
    rerender(
      <GrpcCallPanel
        tab={createGrpcStudioTab({ service: 'health.v1.Health', method: 'Check', body: { service: '' } })}
        method={healthMethod}
        serviceFullName="health.v1.Health"
        targetValid
        onPatch={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-spring-hint-spring_health_actuator')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('covers client stream compose callbacks and calling lifecycle cancel', async () => {
    const onCancelUnary = vi.fn();
    const callingTab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      lifecycle: 'calling',
    });
    render(
      <GrpcCallPanel
        tab={callingTab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onCancelUnary={onCancelUnary}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-mobile-cancel-action'));
    expect(onCancelUnary).toHaveBeenCalled();

    const streamTab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'ClientStream',
      body: { message: 'hi' },
      streamLifecycle: 'streaming',
      streamPendingBodies: [{ message: 'queued' }],
    });
    const onEnqueueStreamMessage = vi.fn();
    const onSendAllPendingStreamMessages = vi.fn();
    const onEndStream = vi.fn();
    render(
      <GrpcCallPanel
        tab={streamTab}
        method={CLIENT_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onEnqueueStreamMessage={onEnqueueStreamMessage}
        onSendAllPendingStreamMessages={onSendAllPendingStreamMessages}
        onEndStream={onEndStream}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('grpc-stream-add-queue-btn'));
      fireEvent.click(screen.getByTestId('grpc-stream-send-all-btn'));
      fireEvent.click(screen.getByTestId('grpc-stream-pending-end-btn'));
    });
    expect(onEnqueueStreamMessage).toHaveBeenCalled();
    expect(onSendAllPendingStreamMessages).toHaveBeenCalled();
    expect(onEndStream).toHaveBeenCalled();
  });

  it('covers empty method state', () => {
    render(
      <GrpcCallPanel
        tab={createGrpcStudioTab({ body: {}, metadata: {} })}
        targetValid
        onPatch={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-call-panel-empty')).toBeTruthy();
  });

  it('covers auth secret handlers', () => {
    const authTab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      auth: { type: 'bearer', bearerToken: 'secret-token-value' },
      maskedSecretFields: { auth: { bearerToken: true } },
      metadata: {},
      body: { message: '' },
    });
    const onUnmaskAuthSecretField = vi.fn();
    const onClearAuthSecretField = vi.fn();
    render(
      <GrpcCallPanel
        tab={authTab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onUnmaskAuthSecretField={onUnmaskAuthSecretField}
        onClearAuthSecretField={onClearAuthSecretField}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-request-tab-auth'));
    fireEvent.click(screen.getByTestId('grpc-auth-bearer-token-clear'));
    fireEvent.change(screen.getByTestId('grpc-auth-bearer-token'), { target: { value: 'x' } });
    expect(onClearAuthSecretField).toHaveBeenCalled();
    expect(onUnmaskAuthSecretField).toHaveBeenCalled();
  });
});
