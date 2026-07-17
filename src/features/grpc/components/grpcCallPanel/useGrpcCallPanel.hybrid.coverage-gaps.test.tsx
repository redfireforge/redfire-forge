/**
 * Hybrid-editor coverage for useGrpcCallPanel via GrpcCallPanel rendering.
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../config/features', () => ({
  DEMO_HUB_ENABLED: true,
  GRPC_PROTO_HYBRID_EDITOR_ENABLED: true,
}));

import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
} from '../../../../shared/grpc/contractFixtures';
import { createGrpcStudioTab } from '../../grpcStudioTypes';
import * as grpcStreamLogExport from '../../utils/grpcStreamLogExport';
import { GrpcCallPanel } from '../GrpcCallPanel';

const ECHO_METHOD = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;
const ECHO_MULTI_FIELD_METHOD = {
  ...ECHO_METHOD,
  name: 'EchoMultiField',
  requestSchema: {
    ...ECHO_METHOD.requestSchema,
    fields: [
      {
        ...ECHO_METHOD.requestSchema.fields[0]!,
        number: 1,
        name: 'message',
        type: 'string',
      },
      {
        ...ECHO_METHOD.requestSchema.fields[0]!,
        number: 2,
        name: 'note',
        type: 'string',
      },
    ],
  },
} as typeof ECHO_METHOD;
const SERVER_STREAM = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'ServerStream')!;
const WATCH_METHOD = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services
  .find((service) => service.fullName === 'health.v1.Health')!
  .methods.find((entry) => entry.name === 'Watch')!;

describe('useGrpcCallPanel hybrid coverage gaps', () => {
  it('opens hybrid workspace and applies JSON from option C', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
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

    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-c'));
    fireEvent.change(screen.getByTestId('grpc-hybrid-json-editor'), {
      target: { value: '{"message":"from hybrid"}' },
    });
    fireEvent.click(screen.getByTestId('grpc-hybrid-apply-btn'));
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({
      body: { message: 'from hybrid' },
    }));
  });

  it('blocks send with hybrid telemetry for validation and auth issues', () => {
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
        tlsValid={false}
        onPatch={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-call-send-block-hint').textContent).toMatch(/Bearer token|TLS configuration/i);
  });

  it('resets composer state when tab id changes', () => {
    const onPatch = vi.fn();
    const tabA = createGrpcStudioTab({
      id: 'tab-a',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'a' },
      requestMode: 'json',
    });
    const { rerender } = render(
      <GrpcCallPanel
        tab={tabA}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-metadata'));
    const tabB = createGrpcStudioTab({
      id: 'tab-b',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'b' },
      requestMode: 'json',
    });
    rerender(
      <GrpcCallPanel
        tab={tabB}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
      />,
    );
    expect(screen.getByTestId('grpc-request-tab-form')).toBeTruthy();
  });

  it('covers stream export, express retry, and permission hints', () => {
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

  it('shows and dismisses stream permission hints', () => {
    const tab = createGrpcStudioTab({
      service: 'health.v1.Health',
      method: 'Watch',
      body: { service: '' },
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
        method={WATCH_METHOD}
        serviceFullName="health.v1.Health"
        targetValid
        onPatch={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-spring-hint-spring_permission_denied')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-spring-hint-dismiss-spring_permission_denied'));
    expect(screen.queryByTestId('grpc-spring-hint-spring_permission_denied')).toBeNull();
  });

  it('emits hybrid telemetry for blocked send', () => {
    const telemetryEvents: string[] = [];
    const onTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string }>).detail;
      if (detail?.name) telemetryEvents.push(detail.name);
    };
    window.addEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);

    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
    });
    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid={false}
        onPatch={vi.fn()}
      />,
    );
    expect(telemetryEvents).toContain('grpc_editor_send_blocked_error');
    window.removeEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);
  });

  it('applies Option B navigator edits through hybrid workspace', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello', note: 'before' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_MULTI_FIELD_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-b'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-nav-item-field-note'));
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-note'), {
      target: { value: 'updated note' },
    });
    fireEvent.click(screen.getByTestId('grpc-hybrid-apply-btn'));

    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({
      requestMode: 'json',
      body: { message: 'hello', note: 'updated note' },
    }));
  });

  it('closes a clean hybrid modal without a dirty-close prompt', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
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
    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByTestId('grpc-hybrid-close-confirm')).toBeNull();
  });

  it('restores selected Option B path across modal discard and reopen', async () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello', note: 'before' },
    });
    render(
      <GrpcCallPanel
        tab={tab}
        method={ECHO_MULTI_FIELD_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-b'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-nav-item-field-message'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-discard-btn'));
    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    fireEvent.click(screen.getByTestId('grpc-hybrid-tab-option-b'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-hybrid-nav-item-field-message').getAttribute('aria-selected')).toBe('true');
    });
  });

  it('surfaces compact JSON errors when opening hybrid workspace from invalid drafts', () => {
    render(
      <GrpcCallPanel
        tab={createGrpcStudioTab({
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'hello' },
        })}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-request-json'), { target: { value: '[]' } });
    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn-inline'));
    expect(screen.getByTestId('grpc-request-json-error').textContent).toMatch(/JSON object/i);
  });

  it('pretty-prints valid JSON and keeps malformed drafts unchanged', () => {
    const onPatch = vi.fn();
    render(
      <GrpcCallPanel
        tab={createGrpcStudioTab({
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'hello' },
        })}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-request-json-hybrid-pretty-btn'));
    expect((screen.getByTestId('grpc-request-json') as HTMLTextAreaElement).value).toContain('\n');
    fireEvent.change(screen.getByTestId('grpc-request-json'), { target: { value: '{not-json' } });
    fireEvent.click(screen.getByTestId('grpc-request-json-hybrid-pretty-btn'));
    expect((screen.getByTestId('grpc-request-json') as HTMLTextAreaElement).value).toBe('{not-json');
  });

  it('keeps hybrid modal state when the tab body changes while open', () => {
    const initialTab = createGrpcStudioTab({
      id: 'tab-open-modal',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
    });
    const { rerender } = render(
      <GrpcCallPanel
        tab={initialTab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-open-full-form-editor-btn'));
    expect(screen.getByTestId('grpc-hybrid-tab-option-c')).toBeTruthy();
    rerender(
      <GrpcCallPanel
        tab={{ ...initialTab, body: { message: 'patched-externally' } }}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-hybrid-tab-option-c')).toBeTruthy();
  });
});
