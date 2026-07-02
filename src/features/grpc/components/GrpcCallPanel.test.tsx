/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { FIXTURE_DESCRIPTOR, FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { GRPC_ERROR_CODES } from '../../../shared/grpc/contracts';
import { createGrpcStudioTab } from '../grpcStudioTypes';
import { GrpcCallPanel } from './GrpcCallPanel';
import { ECHO_METHOD, StatefulGrpcCallPanel } from './GrpcCallPanel.testHelpers';

describe('GrpcCallPanel (Phase 1F)', () => {
  const method = ECHO_METHOD;

  it('renders form tab and enables send when target is valid', async () => {
    const onPatch = vi.fn();
    const onSendUnary = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
      descriptorKey: FIXTURE_DESCRIPTOR.key,
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        descriptorSource="reflection"
        targetValid
        onPatch={onPatch}
        onSendUnary={onSendUnary}
      />,
    );

    expect(screen.getByTestId('grpc-call-panel')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-form')).toBeTruthy();
    expect(screen.getByTestId('grpc-response-panel')).toBeTruthy();
    const sendBtn = screen.getByTestId('grpc-send-btn') as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(sendBtn);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(onSendUnary).toHaveBeenCalled();
  });

  it('keeps send disabled when target is invalid', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid={false}
        onPatch={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-send-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps send disabled while descriptor reload is in flight', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
      descriptorKey: FIXTURE_DESCRIPTOR.key,
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        descriptorLoading
        onPatch={vi.fn()}
        onSendUnary={vi.fn()}
      />,
    );

    expect((screen.getByTestId('grpc-send-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('syncs form edits to JSON tab', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'seed' },
      metadata: {},
      requestMode: 'form',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));

    const json = screen.getByTestId('grpc-request-json') as HTMLTextAreaElement;
    expect(json.value).toContain('"message": "seed"');
  });

  it('updates body from valid JSON edits', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
      requestMode: 'json',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));
    const json = screen.getByTestId('grpc-request-json') as HTMLTextAreaElement;
    fireEvent.change(json, { target: { value: '{ "message": "from-json" }' } });

    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({
      body: { message: 'from-json' },
      requestMode: 'json',
    }));
  });

  it('restores JSON composer tab from persisted requestMode on remount', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'persisted' },
      metadata: {},
      requestMode: 'json',
    });

    const { unmount } = render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    expect(screen.getByTestId('grpc-request-json')).toBeTruthy();
    expect((screen.getByTestId('grpc-request-json') as HTMLTextAreaElement).value).toContain('persisted');

    unmount();

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    expect(screen.getByTestId('grpc-request-json')).toBeTruthy();
    expect(screen.queryByTestId('grpc-proto-form')).toBeNull();
  });

  it('round-trips JSON edits into form fields', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
      requestMode: 'json',
    });

    render(
      <StatefulGrpcCallPanel
        initialTab={tab}
        method={method}
        serviceFullName="echo.EchoService"
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-request-json'), {
      target: { value: '{ "message": "from-json" }' },
    });

    fireEvent.click(screen.getByTestId('grpc-request-tab-form'));

    expect((screen.getByTestId('grpc-proto-field-input-message') as HTMLInputElement).value).toBe('from-json');
  });

  it('passes JSON draft body overrides when sending from JSON tab', async () => {
    const onSendUnary = vi.fn();
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'stale' },
      metadata: {},
      requestMode: 'json',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={onPatch}
        onSendUnary={onSendUnary}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));
    fireEvent.change(screen.getByTestId('grpc-request-json'), {
      target: { value: '{ "message": "fresh-json" }' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('grpc-send-btn'));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(onSendUnary).toHaveBeenCalledWith({ body: { message: 'fresh-json' } });
    expect(onPatch).toHaveBeenCalledWith({ body: { message: 'fresh-json' }, requestMode: 'json' });
  });

  it('blocks send from JSON tab when draft JSON is invalid', () => {
    const onSendUnary = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
      requestMode: 'json',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onSendUnary={onSendUnary}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));
    fireEvent.change(screen.getByTestId('grpc-request-json'), {
      target: { value: '{ invalid' },
    });
    fireEvent.click(screen.getByTestId('grpc-send-btn'));

    expect(screen.getByTestId('grpc-request-json-error')).toBeTruthy();
    expect(onSendUnary).not.toHaveBeenCalled();
  });

  it('blocks switching away from JSON tab when JSON is invalid', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
      requestMode: 'json',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));
    const json = screen.getByTestId('grpc-request-json') as HTMLTextAreaElement;
    fireEvent.change(json, { target: { value: '{ invalid' } });

    fireEvent.click(screen.getByTestId('grpc-request-tab-form'));

    expect(screen.getByTestId('grpc-request-json-error')).toBeTruthy();
    expect(screen.getByTestId('grpc-request-json')).toBeTruthy();
    expect(screen.queryByTestId('grpc-proto-form')).toBeNull();
    expect(onPatch).not.toHaveBeenCalledWith(expect.objectContaining({ requestMode: 'form' }));
  });

  it('shows cancel button while call is in flight', () => {
    const onCancelUnary = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
      lifecycle: 'calling',
      activeRequestId: 'req-1',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
        onCancelUnary={onCancelUnary}
      />,
    );

    expect(screen.getByTestId('grpc-cancel-btn')).toBeTruthy();
    expect((screen.getByTestId('grpc-send-btn') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('grpc-cancel-btn'));
    expect(onCancelUnary).toHaveBeenCalled();
  });

  it('disables send when metadata validation fails', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: { 'payload-bin': '%%%' },
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
  });

  it('disables send when metadata editor has an incomplete row', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
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

    expect((screen.getByTestId('grpc-send-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('blocks switching away from metadata tab when validation fails', () => {
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        onPatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-metadata'));
    fireEvent.click(screen.getByText('+ Add'));
    fireEvent.change(screen.getAllByPlaceholderText('Value')[0]!, {
      target: { value: 'orphan-value' },
    });
    fireEvent.click(screen.getByTestId('grpc-request-tab-form'));

    expect(screen.getByTestId('grpc-request-metadata-error')).toBeTruthy();
    expect(screen.getByTestId('grpc-metadata-editor')).toBeTruthy();
    expect(screen.queryByTestId('grpc-proto-form')).toBeNull();
  });

  it('shows metadata validation error for invalid -bin value', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: { 'payload-bin': '%%%' },
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-metadata'));
    expect(screen.getByTestId('grpc-metadata-validation-error')).toBeTruthy();
  });

  it('blocks switching away from form tab when nested JSON is invalid', () => {
    const onPatch = vi.fn();
    const nestedMethod = {
      ...method,
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
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { payload: {} },
      metadata: {},
      requestMode: 'form',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={nestedMethod}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-payload'), {
      target: { value: '{ invalid' },
    });
    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));

    expect(screen.getByTestId('grpc-proto-form')).toBeTruthy();
    expect(screen.getByTestId('grpc-request-form-error')).toBeTruthy();
    expect(screen.queryByTestId('grpc-request-json')).toBeNull();
  });

  it('blocks switching away from form tab to metadata when nested JSON is invalid', () => {
    const onPatch = vi.fn();
    const nestedMethod = {
      ...method,
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
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { payload: {} },
      metadata: {},
      requestMode: 'form',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={nestedMethod}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-payload'), {
      target: { value: '{ invalid' },
    });
    fireEvent.click(screen.getByTestId('grpc-request-tab-metadata'));

    expect(screen.getByTestId('grpc-proto-form')).toBeTruthy();
    expect(screen.getByTestId('grpc-request-form-error')).toBeTruthy();
    expect(screen.queryByTestId('grpc-metadata-editor')).toBeNull();
  });

  it('clears stale nested form validation after bound method changes', () => {
    const onPatch = vi.fn();
    const nestedMethod = {
      ...method,
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
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { payload: {} },
      metadata: {},
      requestMode: 'form',
    });
    const healthMethod = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services[1]!.methods[0]!;

    const { rerender } = render(
      <GrpcCallPanel
        tab={tab}
        method={nestedMethod}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-proto-field-input-payload'), {
      target: { value: '{ invalid' },
    });
    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));
    expect(screen.getByTestId('grpc-request-form-error')).toBeTruthy();

    rerender(
      <GrpcCallPanel
        tab={{ ...tab, service: 'health.v1.Health', method: 'Check', body: { service: '' }, requestMode: 'form' }}
        method={healthMethod}
        serviceFullName="health.v1.Health"
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));
    expect(screen.getByTestId('grpc-request-json')).toBeTruthy();
    expect(screen.queryByTestId('grpc-request-form-error')).toBeNull();
  });

  it('patches timeoutMs from the timeout input', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-call-timeout-input'), {
      target: { value: '45000' },
    });

    expect(onPatch).toHaveBeenCalledWith({ timeoutMs: 45000 });
  });

  it('blocks switching away from JSON tab to metadata when JSON is invalid', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '' },
      metadata: {},
      requestMode: 'json',
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));
    fireEvent.change(screen.getByTestId('grpc-request-json'), {
      target: { value: '{ invalid' },
    });
    fireEvent.click(screen.getByTestId('grpc-request-tab-metadata'));

    expect(screen.getByTestId('grpc-request-json-error')).toBeTruthy();
    expect(screen.queryByTestId('grpc-metadata-editor')).toBeNull();
  });

  it('resets composer to form when bound method changes', () => {
    const onPatch = vi.fn();
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
      requestMode: 'json',
    });

    const healthMethod = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services[1]!.methods[0]!;

    const { rerender } = render(
      <GrpcCallPanel
        tab={tab}
        method={method}
        serviceFullName="echo.EchoService"
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-request-tab-json'));

    rerender(
      <GrpcCallPanel
        tab={{ ...tab, service: 'health.v1.Health', method: 'Check', body: { service: '' }, requestMode: 'form' }}
        method={healthMethod}
        serviceFullName="health.v1.Health"
        onPatch={onPatch}
      />,
    );

    expect(screen.getByTestId('grpc-proto-form')).toBeTruthy();
    expect(screen.queryByTestId('grpc-request-json')).toBeNull();
  });

  it('shows browser transport hint on stream errors (Phase 10E)', () => {
    const serverStreamMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'ServerStream')!;
    const tab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: {},
      metadata: {},
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      transportMode: 'grpc-web',
      streamLifecycle: 'error',
      streamError: {
        code: GRPC_ERROR_CODES.UNREACHABLE,
        category: 'unreachable',
        message: 'Browser blocked the cross-origin request (CORS).',
        details: {
          browserTransportFailure: 'cors',
          transportMode: 'grpc-web',
        },
      },
    });

    render(
      <GrpcCallPanel
        tab={tab}
        method={serverStreamMethod}
        serviceFullName="echo.EchoService"
        targetValid
        onPatch={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-stream-browser-transport-hint').textContent).toMatch(/CORS/i);
  });
});
