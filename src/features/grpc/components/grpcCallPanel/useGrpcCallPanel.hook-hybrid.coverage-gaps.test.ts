/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../config/features', () => ({
  DEMO_HUB_ENABLED: true,
  GRPC_PROTO_HYBRID_EDITOR_ENABLED: true,
}));

import { FIXTURE_DESCRIPTOR } from '../../../../shared/grpc/contractFixtures';
import { createGrpcStudioTab } from '../../grpcStudioTypes';
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
    metadata: {},
    requestMode: 'json',
    ...((tabOverride as object) ?? {}),
  });
  return {
    tab,
    method: (methodOverride as typeof ECHO_METHOD | undefined) ?? ECHO_METHOD,
    messageTypes: FIXTURE_DESCRIPTOR.messageTypes,
    serviceFullName: 'echo.EchoService',
    targetValid: true,
    tlsValid: true,
    onPatch: vi.fn(),
    onSendUnary: vi.fn(),
    ...restOverrides,
  };
}

describe('useGrpcCallPanel hybrid hook coverage gaps', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('opens hybrid workspace and applies events, and closes with discard', () => {
    const props = makeProps();
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleOpenHybridWorkspace();
    });
    expect(result.current.hybridState.modal.isOpen).toBe(true);
    expect(props.onPatch).toHaveBeenCalledWith(expect.objectContaining({
      requestMode: 'json',
      body: { message: 'hello' },
    }));

    act(() => {
      result.current.applyHybridEventWithHooks({
        type: 'FULL_FORM_APPLY',
      });
    });

    act(() => {
      result.current.applyHybridEventWithHooks({
        type: 'FULL_FORM_DISCARD',
      });
    });
    expect(result.current.hybridState.modal.isOpen).toBe(false);
  });

  it('prompts before closing a dirty hybrid modal', () => {
    const props = makeProps();
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleOpenHybridWorkspace();
      result.current.applyHybridEventWithHooks({
        type: 'FULL_FORM_PATCH',
        nextDraft: { message: 'dirty-change' },
      });
    });

    act(() => {
      result.current.requestHybridClose();
    });
    expect(result.current.hybridCloseConfirmVisible).toBe(true);

    act(() => {
      result.current.handleHybridCloseKeepEditing();
      result.current.handleHybridCloseDiscard();
    });
    expect(result.current.hybridState.modal.isOpen).toBe(false);
  });

  it('selects navigator paths and closes a clean hybrid modal', () => {
    const props = makeProps();
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleOpenHybridWorkspace();
      result.current.handleHybridNavigatorSelectPath('field:message');
      result.current.applyHybridEventWithHooks({ type: 'FULL_FORM_CLOSE' });
    });

    expect(result.current.hybridState.modal.isOpen).toBe(false);
    expect(result.current.hybridState.navigator.selectedPath).toBe('field:message');
  });

  it('records json errors when opening hybrid workspace with invalid draft', () => {
    const props = makeProps();
    const { result } = renderHook(() => useGrpcCallPanel(props as never));

    act(() => {
      result.current.handleJsonChange('{');
    });
    act(() => {
      result.current.handleOpenHybridWorkspace();
    });

    expect(result.current.jsonError).toBeTruthy();
    expect(result.current.hybridState.modal.isOpen).toBe(true);
  });

  it('emits hybrid telemetry for send block hints and validation warnings', () => {
    const telemetryEvents: string[] = [];
    const onTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string }>).detail;
      if (detail?.name) telemetryEvents.push(detail.name);
    };
    window.addEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);

    const props = makeProps({
      tab: { body: { message: '' }, metadata: { 'payload-bin': '%%%' } },
      targetValid: false,
    });
    renderHook(() => useGrpcCallPanel(props as never));

    expect(telemetryEvents).toContain('grpc_editor_send_blocked_error');

    window.removeEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);
  });

  it('records schema complexity telemetry for medium and large methods', () => {
    const telemetryPayloads: Array<{ schemaComplexity?: string }> = [];
    const onTelemetry = (event: Event) => {
      telemetryPayloads.push((event as CustomEvent).detail ?? {});
    };
    window.addEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);

    const makeWideMethod = (fieldCount: number) => ({
      ...ECHO_METHOD,
      requestSchema: {
        ...ECHO_METHOD.requestSchema,
        fields: Array.from({ length: fieldCount }, (_, index) => ({
          ...ECHO_METHOD.requestSchema.fields[0]!,
          number: index + 1,
          name: `field_${index}`,
        })),
      },
    });

    for (const fieldCount of [25, 85]) {
      const props = makeProps({ method: makeWideMethod(fieldCount) });
      const { result, unmount } = renderHook(() => useGrpcCallPanel(props as never));
      act(() => {
        result.current.handleOpenHybridWorkspace();
      });
      unmount();
    }

    expect(telemetryPayloads.map((entry) => entry.schemaComplexity)).toEqual(
      expect.arrayContaining(['medium', 'large']),
    );
    window.removeEventListener('grpc-hybrid-editor-telemetry', onTelemetry as EventListener);
  });
});
