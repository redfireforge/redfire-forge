/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../config/features', () => ({
  DEMO_HUB_ENABLED: true,
  GRPC_PROTO_HYBRID_EDITOR_ENABLED: false,
}));

import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import { createGrpcStudioTab } from '../../grpcStudioTypes';
import * as streamLogExport from '../../utils/grpcStreamLogExport';
import { useGrpcCallPanel } from './useGrpcCallPanel';

const ECHO_METHOD = FIXTURE_DESCRIPTOR.services[0]!.methods.find((method) => method.name === 'Echo')!;

function makeProps(overrides: Record<string, unknown> = {}) {
  const {
    tab: tabOverride,
    method: methodOverride,
    ...restOverrides
  } = overrides;
  const tab = createGrpcStudioTab({
    service: 'echo.EchoService',
    method: 'Echo',
    body: { message: 'hello' },
    metadata: { 'x-trace': '1' },
    requestMode: 'json',
    lifecycle: 'idle',
    ...((tabOverride as object) ?? {}),
  });
  const method = (methodOverride as typeof ECHO_METHOD | undefined) ?? ECHO_METHOD;
  const onPatch = vi.fn();
  const onSendUnary = vi.fn();
  const onStartStream = vi.fn();
  const onCancelStream = vi.fn();
  const onSendStreamMessage = vi.fn();
  const onEnqueueStreamMessage = vi.fn();
  const onSendAllPendingStreamMessages = vi.fn(async () => {});
  const onClearStreamLog = vi.fn();

  return {
    tab,
    method,
    messageTypes: FIXTURE_DESCRIPTOR.messageTypes,
    serviceFullName: 'echo.EchoService',
    targetValid: true,
    tlsValid: true,
    onPatch,
    onSendUnary,
    onStartStream,
    onCancelStream,
    onSendStreamMessage,
    onEnqueueStreamMessage,
    onSendAllPendingStreamMessages,
    onClearStreamLog,
    ...restOverrides,
  };
}

describe('useGrpcCallPanel coverage gaps', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(streamLogExport, 'downloadGrpcStreamLogExport').mockImplementation(() => {});
  });

  it('switches composer tabs and auth/mobile stages', () => {
    const props = makeProps({ tab: { requestMode: 'form' } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.switchComposerTab('metadata');
    });
    expect(result.current.composerTab).toBe('metadata');
    expect(result.current.mobileStage).toBe('metadata');

    act(() => {
      result.current.switchComposerTab('auth');
    });
    expect(result.current.composerTab).toBe('auth');
    expect(result.current.mobileStage).toBe('auth');
  });

  it('sends unary calls and blocks invalid json bodies', async () => {
    const props = makeProps();
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleJsonChange('{');
    });
    expect(result.current.jsonError).toBeTruthy();

    act(() => {
      result.current.handleJsonChange('{"message":"hello"}');
    });

    await act(async () => {
      await result.current.handlePrimaryAction();
    });
    expect(props.onSendUnary).toHaveBeenCalled();
  });

  it('starts and cancels streams and exports stream logs', async () => {
    const serverStream = FIXTURE_DESCRIPTOR.services[0]!.methods.find((method) => method.name === 'ServerStream')!;
    const props = makeProps({
      tab: {
        method: 'ServerStream',
        streamLifecycle: 'idle',
        streamMessages: [{ direction: 'inbound', sequence: 1, timestamp: 't', data: { message: 'ok' } }],
      },
      method: serverStream,
    });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    await act(async () => {
      await result.current.handlePrimaryAction();
    });
    expect(props.onStartStream).toHaveBeenCalled();

    const activeProps = makeProps({
      tab: {
        method: 'ServerStream',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-1',
      },
      method: serverStream,
    });
    const active = renderHook(() => useGrpcCallPanel(activeProps as never));
    await act(async () => {
      await active.result.current.handlePrimaryAction();
    });
    expect(activeProps.onCancelStream).toHaveBeenCalled();

    act(() => {
      active.result.current.handleExportStreamLog();
    });
    expect(streamLogExport.downloadGrpcStreamLogExport).toHaveBeenCalled();
  });

  it('handles stream enqueue/send-all and mobile stage routing', async () => {
    const clientStream = FIXTURE_DESCRIPTOR.services[0]!.methods.find((method) => method.name === 'ClientStream')!;
    const props = makeProps({
      tab: { method: 'ClientStream', streamLifecycle: 'streaming', activeStreamId: 'stream-1' },
      method: clientStream,
    });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleSendStreamMessage();
      result.current.handleEnqueueStreamMessage();
    });
    expect(props.onSendStreamMessage).toHaveBeenCalled();
    expect(props.onEnqueueStreamMessage).toHaveBeenCalled();

    await act(async () => {
      await result.current.handleSendAllPendingStreamMessages();
    });
    expect(props.onSendAllPendingStreamMessages).toHaveBeenCalled();

    act(() => {
      result.current.switchMobileStage('response');
    });
    expect(result.current.mobileStage).toBe('response');
  });

  it('focuses auth tab from focus request and surfaces send block hints', async () => {
    const props = makeProps({
      targetValid: false,
      authTabFocusRequest: 1,
      tab: {
        auth: {
          type: 'oauth2',
          oauth2: { tokenUrl: 'https://auth/token', clientId: 'id', clientSecret: 'secret' },
        },
      },
    });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    await waitFor(() => {
      expect(result.current.composerTab).toBe('auth');
    });
    expect(result.current.sendBlockHint).toMatch(/valid target endpoint/i);
    expect(result.current.primaryDisabled).toBe(true);
  });

  it('uploads binary files into the first empty bytes field', async () => {
    const props = makeProps({
      tab: {
        body: { payload: '' },
      },
    });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));
    const file = new File([new Uint8Array([1, 2, 3])], 'payload.bin', { type: 'application/octet-stream' });

    await act(async () => {
      result.current.handleFilesPicked({
        target: { files: [file] },
      } as never);
      await result.current.handlePrimaryAction();
    });

    expect(props.onSendUnary).toHaveBeenCalled();
    act(() => {
      result.current.handleRemoveUploadedFile(result.current.uploadedFiles[0]!.id);
      result.current.handleClearUploadedFiles();
    });
    expect(result.current.uploadedFiles).toHaveLength(0);
  });

  it('blocks composer tab switches when nested form JSON is invalid', () => {
    const props = makeProps({ tab: { id: 'tab-form-validation', requestMode: 'form' } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.setFormValid(false);
    });
    act(() => {
      result.current.switchComposerTab('metadata');
    });
    expect(result.current.formError).toMatch(/nested message JSON/i);
  });

  it('resets state when tab id or method identity changes', () => {
    const props = makeProps({ tab: { id: 'tab-1', requestMode: 'json' } });
    const { result, rerender } = renderHook(
      (input) => useGrpcCallPanel(input as never),
      { initialProps: props },
    );

    act(() => {
      result.current.switchComposerTab('metadata');
    });
    expect(result.current.composerTab).toBe('metadata');

    const nextTabProps = makeProps({
      tab: { id: 'tab-2', body: { message: 'next' }, requestMode: 'json' },
    });
    rerender(nextTabProps as never);
    expect(result.current.jsonDraft).toContain('next');

    const streamMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'ServerStream')!;
    const streamProps = makeProps({
      tab: { id: 'tab-2', method: 'ServerStream', body: { message: 'stream' } },
      method: streamMethod,
    });
    rerender(streamProps as never);
    expect(result.current.composerTab).toBe('form');
  });

  it('surfaces oauth2 incomplete send hint and ignores invalid timeout values', () => {
    const props = makeProps({
      tab: {
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth/token',
            clientId: 'id',
            clientSecret: '',
          },
        },
      },
    });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));
    expect(result.current.sendBlockHint).toMatch(/OAuth2 is incomplete/i);

    act(() => {
      result.current.handleTimeoutChange('not-a-number');
      result.current.handleTimeoutChange('-5');
    });
    expect(props.onPatch).not.toHaveBeenCalledWith({ timeoutMs: expect.any(Number) });
  });

  it('returns early from stream handlers when json body is invalid', async () => {
    const clientStream = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'ClientStream')!;
    const props = makeProps({
      tab: { method: 'ClientStream', streamLifecycle: 'streaming', activeStreamId: 's1' },
      method: clientStream,
    });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleJsonChange('{');
    });
    act(() => {
      result.current.handleSendStreamMessage();
      result.current.handleEnqueueStreamMessage();
    });
    expect(props.onSendStreamMessage).not.toHaveBeenCalled();
    expect(props.onEnqueueStreamMessage).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleSendAllPendingStreamMessages();
    });
    expect(props.onSendAllPendingStreamMessages).toHaveBeenCalled();
  });

  it('returns early from handlePrimaryAction when json overrides cannot be resolved', async () => {
    const props = makeProps({ tab: { requestMode: 'form' } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleJsonChange('{');
    });

    await act(async () => {
      await result.current.handlePrimaryAction();
    });
    expect(props.onSendUnary).not.toHaveBeenCalled();
  });

  it('surfaces auth and metadata send block hints', () => {
    const authProps = makeProps({
      tab: {
        auth: { type: 'basic', username: 'user', basicPassword: '' },
      },
    });
    const { result: authResult } = renderHook(() => useGrpcCallPanel(authProps as never));
    expect(authResult.current.sendBlockHint).toMatch(/Basic auth username is required/i);

    const metadataProps = makeProps({
      tab: { metadata: { 'payload-bin': '%%%' } },
    });
    const { result: metadataResult } = renderHook(() => useGrpcCallPanel(metadataProps as never));
    expect(metadataResult.current.sendBlockHint).toMatch(/base64/i);
  });

  it('ignores non-binary uploads and duplicate pending-send requests', async () => {
    const props = makeProps({
      onSendAllPendingStreamMessages: undefined,
    });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleFilesPicked({
        target: { files: [new File(['plain'], 'notes.txt', { type: 'text/plain' })] },
      } as never);
    });

    await act(async () => {
      await result.current.handlePrimaryAction();
    });
    expect(props.onSendUnary).toHaveBeenCalled();

    await act(async () => {
      void result.current.handleSendAllPendingStreamMessages();
      await result.current.handleSendAllPendingStreamMessages();
    });
  });

  it('handles composer tab no-ops and metadata switch validation', () => {
    const props = makeProps({ tab: { requestMode: 'form', metadata: { 'payload-bin': '%%%' } } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.switchComposerTab('metadata');
      result.current.setMetadataEditorValid(false);
      result.current.switchComposerTab('form');
    });
    expect(props.onPatch).toHaveBeenCalledWith(expect.objectContaining({ requestMode: 'json' }));
  });

  it('blocks send when disabled, executeBlocked, or descriptorLoading', () => {
    const disabledProps = makeProps({ disabled: true });
    expect(renderHook(() => useGrpcCallPanel(disabledProps as never)).result.current.primaryDisabled).toBe(true);

    const blockedProps = makeProps({ executeBlocked: true });
    expect(renderHook(() => useGrpcCallPanel(blockedProps as never)).result.current.primaryDisabled).toBe(true);

    const loadingProps = makeProps({ descriptorLoading: true });
    expect(renderHook(() => useGrpcCallPanel(loadingProps as never)).result.current.primaryDisabled).toBe(true);
  });

  it('clears uploaded files and handles json changes without a method', () => {
    const props = makeProps({ method: undefined, tab: { service: '', method: '' } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleJsonChange('{"message":"orphan"}');
      result.current.handleClearUploadedFiles();
    });
    expect(result.current.uploadedFiles).toHaveLength(0);
  });

  it('surfaces form validation send block hints', () => {
    const formProps = makeProps({ tab: { requestMode: 'form' } });
    const { result: formResult } = renderHook(() => useGrpcCallPanel(formProps as never));
    act(() => {
      formResult.current.setFormValid(false);
    });
    expect(formResult.current.sendBlockHint).toMatch(/form input errors/i);
  });

  it('routes mobile response stage and unary express retry callbacks', async () => {
    const onRetryUnaryWithExpress = vi.fn();
    const props = makeProps({ onRetryUnaryWithExpress });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.switchMobileStage('response');
      result.current.switchMobileStage('request');
    });
    expect(result.current.mobileStage).toBe('request');
    expect(result.current.onRetryUnaryWithExpress).toBe(onRetryUnaryWithExpress);
  });

  it('keeps invalid json errors when leaving the form composer tab', () => {
    const props = makeProps({ tab: { requestMode: 'json' } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleJsonChange('{"message":');
    });
    act(() => {
      result.current.switchComposerTab('metadata');
    });
    expect(result.current.composerTab).toBe('metadata');
  });

  it('clears metadata switch errors when opening the metadata tab', () => {
    const props = makeProps({ tab: { requestMode: 'form' } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.switchComposerTab('auth');
      result.current.switchComposerTab('metadata');
    });
    expect(result.current.composerTab).toBe('metadata');
  });

  it('blocks metadata tab switches when the metadata editor is invalid', () => {
    const props = makeProps({ tab: { requestMode: 'form', metadata: { 'payload-bin': '%%%' } } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.switchComposerTab('metadata');
    });
    act(() => {
      result.current.setMetadataEditorValid(false);
      result.current.switchComposerTab('form');
    });
    expect(props.onPatch).toHaveBeenCalled();
  });

  it('focuses auth tab when authTabFocusRequest increments', () => {
    const initialProps = makeProps({ authTabFocusRequest: 1 });
    const { result, rerender } = renderHook(
      (props) => useGrpcCallPanel(props as never),
      { initialProps: initialProps as never },
    );
    expect(result.current.composerTab).toBe('auth');

    rerender({ ...initialProps, authTabFocusRequest: 2 } as never);
    expect(result.current.composerTab).toBe('auth');
  });

  it('covers default descriptorSource and metadata tab entry from files', () => {
    const { tab, method, messageTypes, serviceFullName, targetValid, tlsValid, onPatch } = makeProps();
    const { result } = renderHook(() => useGrpcCallPanel({
      tab,
      method,
      messageTypes,
      serviceFullName,
      targetValid,
      tlsValid,
      onPatch,
    } as never));

    act(() => {
      result.current.switchComposerTab('files');
      result.current.switchComposerTab('metadata');
    });
    expect(result.current.composerTab).toBe('metadata');
  });

  it('surfaces oauth2 incomplete allow-send hint', () => {
    const props = makeProps({
      tab: {
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth/token',
            clientId: '',
            clientSecret: '',
          },
        },
      },
    });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));
    expect(result.current.sendBlockHint).toMatch(/OAuth2 is incomplete/i);
  });

  it('routes invalid form json through files tab switches', () => {
    const props = makeProps({ tab: { requestMode: 'json' } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleJsonChange('{"message":');
    });
    act(() => {
      result.current.switchComposerTab('files');
    });
    expect(result.current.composerTab).toBe('files');
  });

  it('blocks leaving metadata when the editor is invalid', () => {
    const props = makeProps({ tab: { requestMode: 'form', metadata: { 'payload-bin': '%%%' } } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.switchComposerTab('metadata');
    });
    act(() => {
      result.current.setMetadataEditorValid(false);
      result.current.switchComposerTab('files');
    });
    expect(result.current.composerTab).toBe('files');
  });

  it('updates primary labels for in-flight unary and active stream calls', () => {
    const unaryProps = makeProps({ tab: { lifecycle: 'calling' } });
    expect(renderHook(() => useGrpcCallPanel(unaryProps as never)).result.current.primaryLabel)
      .toBe('Sending…');

    const serverStream = FIXTURE_DESCRIPTOR.services[0]!.methods.find((method) => method.name === 'ServerStream')!;
    const streamProps = makeProps({
      tab: { method: 'ServerStream', streamLifecycle: 'streaming', activeStreamId: 'stream-1' },
      method: serverStream,
    });
    expect(renderHook(() => useGrpcCallPanel(streamProps as never)).result.current.primaryLabel)
      .toBe('Cancel stream');
  });

  it('no-ops composer tab switches and surfaces nested form errors', () => {
    const props = makeProps({ tab: { requestMode: 'form' } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.switchComposerTab('form');
      result.current.setFormValid(false);
    });
    act(() => {
      result.current.switchComposerTab('metadata');
    });
    expect(result.current.composerTab).toBe('metadata');
  });

  it('returns null send hints when no method is selected', () => {
    const props = makeProps({ method: undefined, tab: { service: '', method: '' } });
    const { result } = renderHook(() => useGrpcCallPanel(props as never));
    expect(result.current.sendBlockHint).toBeNull();
  });
});
