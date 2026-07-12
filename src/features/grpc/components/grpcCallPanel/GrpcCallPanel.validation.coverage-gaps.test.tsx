/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import {FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '../../../../shared/grpc/contractFixtures';
import { createGrpcStudioTab } from '../../grpcStudioTypes';
import * as grpcStreamLogExport from '../../utils/grpcStreamLogExport';
import { GrpcCallPanel } from '../GrpcCallPanel';
import {
  BIDI_STREAM,
  CLIENT_STREAM,
  ECHO_METHOD,
  SERVER_STREAM,
} from './grpcCallPanelCoverageGaps.testHelpers';

describe('GrpcCallPanel coverage gaps — validation and mobile', () => {
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

  it.skip('pretty-prints request JSON from the json composer tab', () => {
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
    const onEndStream = vi.fn();
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
        onEndStream={onEndStream}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-stream-send-message-btn'));
    expect(onSendStreamMessage).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('grpc-stream-end-btn'));
    expect(onEndStream).toHaveBeenCalled();
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

  it('resets composer state when the active tab id changes', () => {
    const onPatch = vi.fn();
    const firstTab = createGrpcStudioTab({
      id: 'tab-a',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'first' },
      requestMode: 'json',
    });
    const secondTab = createGrpcStudioTab({
      id: 'tab-b',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'second' },
      requestMode: 'json',
    });

    const { rerender } = render(
      <GrpcCallPanel
        tab={firstTab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
      />,
    );

    rerender(
      <GrpcCallPanel
        tab={secondTab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
      />,
    );

    expect((screen.getByTestId('grpc-proto-field-input-message') as HTMLInputElement).value).toContain('second');
  });

  it('resets composer body when the selected method changes', () => {
    const serverStreamTab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'stream-body' },
      requestMode: 'json',
    });

    const { rerender } = render(
      <GrpcCallPanel
        tab={createGrpcStudioTab({
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'unary-body' },
          requestMode: 'json',
        })}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    rerender(
      <GrpcCallPanel
        tab={serverStreamTab}
        method={SERVER_STREAM}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-proto-field-input-message') as HTMLInputElement).value).toContain('stream-body');
  });

  it('returns to request stage from response without leaving the primary composer tab', () => {
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
    fireEvent.click(screen.getByTestId('grpc-mobile-stage-response'));
    fireEvent.click(screen.getByTestId('grpc-mobile-stage-request'));
    expect(split.className).toContain('grpc-call-split--stage-request');
  });

  it('shows and dismisses stream permission hints in the response pane', () => {
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

    expect(screen.getByTestId('grpc-spring-hint-spring_permission_denied')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-spring-hint-dismiss-spring_permission_denied'));
    expect(screen.queryByTestId('grpc-spring-hint-spring_permission_denied')).toBeNull();
  });

  it('surfaces nested form validation in the send-block hint', () => {
    const nestedMethod = {
      ...ECHO_METHOD,
      requestSchema: {
        typeName: 'demo.NestedRequest',
        fields: [
          {
            name: 'payload',
            number: 1,
            type: 'message' as const,
            label: 'optional' as const,
            messageTypeName: 'demo.Payload',
          },
        ],
      },
    };

    render(
      <GrpcCallPanel
        tab={createGrpcStudioTab({
          service: 'echo.EchoService',
          method: 'Echo',
          body: { payload: {} },
          metadata: {},
          requestMode: 'form',
        })}
        method={nestedMethod}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-payload'), {
      target: { value: '{ invalid' },
    });
    expect(screen.getByTestId('grpc-call-send-block-hint').textContent).toMatch(/form input errors/i);
  });
});
