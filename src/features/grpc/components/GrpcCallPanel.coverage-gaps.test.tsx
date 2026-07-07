/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { FIXTURE_DESCRIPTOR, FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { createGrpcStudioTab } from '../grpcStudioTypes';
import * as grpcStreamLogExport from '../utils/grpcStreamLogExport';
import { GrpcCallPanel } from './GrpcCallPanel';

const SERVER_STREAM = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'ServerStream')!;
const CLIENT_STREAM = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'ClientStream')!;
const BIDI_STREAM = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'BidiStream')!;
const ECHO_METHOD = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;

async function clickByTestIdAsync(testId: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
    await Promise.resolve();
  });
}

describe('GrpcCallPanel coverage gaps', () => {
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

  it('switches to JSON composer and surfaces parse validation errors', () => {
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

    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));
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

  it('switches from JSON tab back to form tab', () => {
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

    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));
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

  it('switches mobile stage tabs between request, response, metadata, and auth', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
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

    const split = document.querySelector('.grpc-call-split') as HTMLElement;
    expect(split.className).toContain('grpc-call-split--stage-request');

    fireEvent.click(screen.getByTestId('grpc-mobile-stage-response'));
    expect(split.className).toContain('grpc-call-split--stage-response');

    fireEvent.click(screen.getByTestId('grpc-mobile-stage-metadata'));
    expect(screen.getByTestId('grpc-request-tab-metadata').className).toMatch(/active/);
    expect(split.className).toContain('grpc-call-split--stage-metadata');

    fireEvent.click(screen.getByTestId('grpc-mobile-stage-auth'));
    expect(screen.getByTestId('grpc-request-tab-auth').className).toMatch(/active/);
    expect(split.className).toContain('grpc-call-split--stage-auth');

    fireEvent.click(screen.getByTestId('grpc-mobile-stage-request'));
    expect(split.className).toContain('grpc-call-split--stage-request');
  });

  it('stages uploaded files and clears them from the files tab', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
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

    fireEvent.click(screen.getByTestId('grpc-request-tab-files'));
    expect(screen.getByTestId('grpc-request-files-empty')).toBeTruthy();

    const file = new File(['payload'], 'payload.bin', { type: 'application/octet-stream' });
    fireEvent.change(screen.getByTestId('grpc-request-files-input'), {
      target: { files: [file] },
    });
    expect(screen.getByTestId('grpc-request-files-count').textContent).toBe('1 selected');

    fireEvent.click(screen.getByTestId('grpc-request-files-remove-0'));
    expect(screen.getByTestId('grpc-request-files-empty')).toBeTruthy();

    fireEvent.change(screen.getByTestId('grpc-request-files-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId('grpc-request-files-clear'));
    expect(screen.getByTestId('grpc-request-files-empty')).toBeTruthy();
  });

  it('merges uploaded bytes into the request body when sending unary calls', async () => {
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

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onSendUnary={onSendUnary}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-files'));
    const file = new File(['abc'], 'payload.bin', { type: 'application/octet-stream' });
    fireEvent.change(screen.getByTestId('grpc-request-files-input'), {
      target: { files: [file] },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('grpc-send-btn'));
    });

    expect(onSendUnary).toHaveBeenCalledWith({ body: { payload: 'YWJj' } });
    vi.unstubAllGlobals();
  });

  it('blocks unary send and stream cancel when executeBlocked is true', () => {
    const onCancelStream = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hi' },
      streamLifecycle: 'streaming',
    });

    const { rerender } = render(
      <GrpcCallPanel
        tab={tab}
        method={SERVER_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        executeBlocked
        onPatch={vi.fn()}
        onCancelStream={onCancelStream}
      />,
    );

    expect((screen.getByTestId('grpc-stream-cancel-btn') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('grpc-stream-cancel-btn'));
    expect(onCancelStream).not.toHaveBeenCalled();

    rerender(
      <GrpcCallPanel
        tab={{ ...tab, method: 'Echo', lifecycle: 'idle' }}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        executeBlocked
        onPatch={vi.fn()}
        onSendUnary={vi.fn()}
      />,
    );
    expect((screen.getByTestId('grpc-send-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables send when target address is invalid', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid={false}
        onPatch={vi.fn()}
        onSendUnary={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-send-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('blocks send for incomplete auth, metadata, form, and json validation', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: { 'payload-bin': '%%%' },
      auth: { type: 'bearer', bearerToken: '' },
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

    expect(screen.getByTestId('grpc-call-send-block-hint').textContent).toMatch(/Bearer token/i);
  });

  it('pretty-prints request JSON from the json composer tab', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      requestMode: 'json',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-json-pretty-btn'));
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({
      body: { message: 'hello' },
      requestMode: 'json',
    }));
  });

  it('exports stream logs and offers express retry for eligible stream failures', () => {
    const downloadSpy = vi.spyOn(grpcStreamLogExport, 'downloadGrpcStreamLogExport')
      .mockImplementation(() => undefined);
    const onRetryStreamWithExpress = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hi' },
      streamLifecycle: 'error',
      streamMessages: [{ direction: 'inbound', sequence: 1, timestamp: 't', data: { message: 'ok' } }],
      streamError: {
        code: 'GRPC_BROWSER_TRANSPORT_FAILED',
        category: 'transport_failed',
        message: 'Failed to fetch',
        details: { expressFallbackOffered: true, transportAttempted: 'grpc-web' },
      },
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={SERVER_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onRetryStreamWithExpress={onRetryStreamWithExpress}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-stream-export-log-btn'));
    expect(downloadSpy).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('grpc-stream-retry-express-btn'));
    expect(onRetryStreamWithExpress).toHaveBeenCalled();
    downloadSpy.mockRestore();
  });

  it('removes pending client-stream messages and sends bidi stream messages', async () => {
    const onRemovePendingStreamMessage = vi.fn();
    const onSendStreamMessage = vi.fn();
    const clientTab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'ClientStream',
      body: { message: 'hi' },
      streamLifecycle: 'streaming',
      streamPendingBodies: [{ message: 'queued' }],
    });

    const { rerender } = render(
      <GrpcCallPanel
        tab={clientTab}
        method={CLIENT_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onRemovePendingStreamMessage={onRemovePendingStreamMessage}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-stream-pending-remove-0'));
    expect(onRemovePendingStreamMessage).toHaveBeenCalledWith(0);

    const bidiTab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'BidiStream',
      body: { message: 'chunk' },
      streamLifecycle: 'streaming',
    });

    rerender(
      <GrpcCallPanel
        tab={bidiTab}
        method={BIDI_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onSendStreamMessage={onSendStreamMessage}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-stream-send-message-btn'));
    expect(onSendStreamMessage).toHaveBeenCalled();
  });

  it('returns to request stage from metadata via mobile stage tabs', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
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

    fireEvent.click(screen.getByTestId('grpc-mobile-stage-metadata'));
    fireEvent.click(screen.getByTestId('grpc-mobile-stage-request'));
    expect(document.querySelector('.grpc-call-split')?.className).toContain('grpc-call-split--stage-request');
  });

  it('ignores invalid timeout values when no method is selected', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({ body: {}, metadata: {} });

    render(
      <GrpcCallPanel
        tab={tab}
        targetValid
        onPatch={onPatch}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-call-timeout-input'), { target: { value: 'abc' } });
    expect(onPatch).not.toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: expect.anything() }));
  });
});
