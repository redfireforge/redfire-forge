/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { emitGrpcHybridTelemetry } from './grpcHybridTelemetry';

describe('grpcHybridTelemetry', () => {
  it('dispatches telemetry custom event with payload and metadata', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    emitGrpcHybridTelemetry(
      'grpc_editor_modal_opened',
      {
        tabIdHash: 'tab-hash',
        methodIdentifier: 'svc.Echo/Echo',
        schemaComplexity: 'small',
      },
      {
        hasOneof: true,
        warningCount: 2,
      },
    );

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(event.type).toBe('grpc-hybrid-editor-telemetry');
    expect(event.detail).toMatchObject({
      name: 'grpc_editor_modal_opened',
      tabIdHash: 'tab-hash',
      methodIdentifier: 'svc.Echo/Echo',
      schemaComplexity: 'small',
      hasOneof: true,
      warningCount: 2,
    });
    expect(typeof event.detail.emittedAt).toBe('number');

    dispatchSpy.mockRestore();
  });

  it('dispatches telemetry event even without metadata', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    emitGrpcHybridTelemetry('grpc_editor_modal_applied', {
      tabIdHash: 'tab-hash-2',
      methodIdentifier: 'svc.Echo/Create',
      schemaComplexity: 'medium',
    });

    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail.name).toBe('grpc_editor_modal_applied');
    expect(event.detail.schemaComplexity).toBe('medium');
    expect(event.detail.emittedAt).toBeGreaterThan(0);

    dispatchSpy.mockRestore();
  });

  it('no-ops when dispatchEvent is unavailable at runtime', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error test runtime guard for non-browser context
    delete globalThis.window;

    expect(() => {
      emitGrpcHybridTelemetry('grpc_editor_modal_opened', {
        tabIdHash: 'tab-hash-3',
        methodIdentifier: 'svc.Echo/NoDispatch',
        schemaComplexity: 'large',
      });
    }).not.toThrow();

    globalThis.window = originalWindow;
  });
});
