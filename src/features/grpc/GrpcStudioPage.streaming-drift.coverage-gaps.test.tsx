/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { selectOption } from '@test-utils/customSelectHelper';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_CANCEL_SUCCESS_ENVELOPE,
  FIXTURE_HAPPY_CALL_ENVELOPE,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
} from '@shared/grpc/contractFixtures';
import { GRPC_ERROR_CODES } from '@shared/grpc/contracts';
import { GrpcApiClientError, setGrpcClientTransport } from '@shared/grpc/grpcApiClient';
import { createGrpcSuccessEnvelope } from '@shared/grpc/contracts';
import * as grpcStreamClient from '@shared/grpc/grpcStreamClient';
import { setGrpcStreamTransport } from '@shared/grpc/grpcStreamClient';
const downloadProtosetFileMock = vi.hoisted(() => vi.fn());
vi.mock('./utils/downloadProtoset', () => ({
  downloadProtosetFile: (...args: unknown[]) => downloadProtosetFileMock(...args),
}));
import { GrpcStudioPage } from './GrpcStudioPage';
import {
  clickByTestId,
  grpcStudioTabs,
  setupGrpcStudioPageCoverageGapsTest,
} from './grpcStudioPage/grpcStudioPageCoverageGaps.testHelpers';

setupGrpcStudioPageCoverageGapsTest(downloadProtosetFileMock);

describe('GrpcStudioPage coverage gaps — streaming, drift, and calls', () => {
  it('runs client streaming send, end, and clear log actions from the studio page', async () => {
    let capturedOnEvent: ((event: import('../../shared/grpc/contracts').GrpcStreamEvent) => void) | undefined;
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockImplementation((_streamId, _tabId, options) => {
      capturedOnEvent = options.onEvent;
      return vi.fn();
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });
    setGrpcStreamTransport(async (path) => {
      if (path.includes('/stream/start')) {
        return createGrpcSuccessEnvelope('stream_start', {
          streamId: 'client-stream-1',
          requestId: 'req-client',
          tabId: 'grpc-tab-1',
        });
      }
      if (path.includes('/send')) {
        return createGrpcSuccessEnvelope('stream_send', {
          streamId: 'client-stream-1',
          tabId: 'grpc-tab-1',
          sequence: 1,
        });
      }
      if (path.includes('/end')) {
        return createGrpcSuccessEnvelope('stream_end', {
          streamId: 'client-stream-1',
          tabId: 'grpc-tab-1',
          status: 0,
          statusMessage: 'OK',
        });
      }
      return createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'client-stream-1',
        tabId: 'grpc-tab-1',
        cancelled: true,
      });
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-clientstream'));
    await waitFor(() => expect(screen.getByTestId('grpc-stream-start-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-stream-start-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-stream-add-queue-btn')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-stream-add-queue-btn'));
    fireEvent.click(screen.getByTestId('grpc-stream-send-all-btn'));
    await act(async () => {
      capturedOnEvent?.({
        type: 'grpc-message',
        streamId: 'client-stream-1',
        requestId: 'req-client',
        tabId: 'grpc-tab-1',
        sequence: 1,
        timestamp: '2026-06-29T00:00:00.500Z',
        direction: 'outbound',
        data: { message: 'chunk' },
      });
    });
    fireEvent.click(screen.getByTestId('grpc-stream-pending-end-btn'));
    await waitFor(() => expect(capturedOnEvent).toBeDefined());
    await act(async () => {
      capturedOnEvent?.({
        type: 'grpc-end',
        streamId: 'client-stream-1',
        requestId: 'req-client',
        tabId: 'grpc-tab-1',
        sequence: 2,
        timestamp: '2026-06-29T00:00:01.000Z',
        status: 0,
        statusMessage: 'OK',
      });
    });
    await waitFor(() => expect(screen.getByTestId('grpc-stream-start-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-stream-clear-log'));
  });

  it('shows health panel guidance before services are reflected', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    await clickByTestId('grpc-connection-settings-btn');
    await clickByTestId('grpc-settings-nav-health');
    expect(screen.getByTestId('grpc-health-unavailable').textContent).toMatch(/Reflect services first/i);
    expect((screen.getByTestId('grpc-health-check-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('rebinds schema drift from the studio page after a blocking reflect change', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      const descriptorWithoutEcho = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-no-echo',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((entry) => entry.name !== 'Echo'),
        }],
      };
      return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: descriptorWithoutEcho };
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    await waitFor(() => expect(screen.getByTestId('grpc-proto-form')).toBeTruthy());
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-message'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-schema-drift-banner')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-schema-drift-rebind-echo-EchoService-BidiStream'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-call-method-name').textContent).toMatch(/BidiStream/i);
    });
  });

  it('dismisses warning schema drift after reflect detects orphan fields', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      const descriptorWithRemovedField = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-empty-echo-request',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
            entry.name === 'Echo'
              ? {
                ...entry,
                requestSchema: {
                  ...entry.requestSchema,
                  fields: [],
                },
              }
              : entry
          )),
        }],
      };
      return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: descriptorWithRemovedField };
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    await waitFor(() => expect(screen.getByTestId('grpc-proto-form')).toBeTruthy());
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-message'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-schema-drift-dismiss-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-schema-drift-dismiss-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-schema-drift-banner')).toBeNull();
    });
  });

  it('prunes warning schema drift body from the studio page', async () => {
    let reflectCount = 0;
    setGrpcClientTransport(async () => {
      reflectCount += 1;
      if (reflectCount === 1) {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      const descriptorWithRemovedField = {
        ...FIXTURE_DESCRIPTOR,
        key: 'descriptor-empty-echo-request-prune',
        services: [{
          ...FIXTURE_DESCRIPTOR.services[0]!,
          methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
            entry.name === 'Echo'
              ? {
                ...entry,
                requestSchema: {
                  ...entry.requestSchema,
                  fields: [],
                },
              }
              : entry
          )),
        }],
      };
      return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: descriptorWithRemovedField };
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    await waitFor(() => expect(screen.getByTestId('grpc-proto-form')).toBeTruthy());
    fireEvent.change(screen.getByTestId('grpc-proto-field-input-message'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-schema-drift-prune-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-schema-drift-prune-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-schema-drift-banner')).toBeNull();
    });
  });

  it('focuses bottom auth tab when auth badge is clicked', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-auth-badge'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-connection-settings-drawer')).toBeNull();
      expect(screen.getByTestId('grpc-request-tab-auth').className).toMatch(/active/);
      expect(screen.getByTestId('grpc-auth-panel')).toBeTruthy();
    });
  });

  it('restores persisted studio session from localStorage on mount', async () => {
    localStorage.setItem('grpc-studio-session-v1', JSON.stringify({
      version: 1,
      activeTabId: 'persisted-tab',
      tabs: [{
        id: 'persisted-tab',
        title: 'Persisted Target',
        target: 'localhost:50051',
        tlsMode: 'disabled',
        metadata: {},
        timeoutMs: 30_000,
        requestMode: 'form',
        body: {},
        servicesCollapsed: false,
      }],
      tabDescriptors: {},
      timestamp: Date.now(),
    }));

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    await waitFor(() => {
      expect((screen.getByTestId('grpc-target-input') as HTMLInputElement).value).toBe('localhost:50051');
    });
  });

  it('reflects services, toggles service expansion, and binds method', async () => {
    setGrpcClientTransport(async () => ({
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: FIXTURE_DESCRIPTOR,
    }));
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });
    // Click once to collapse, click again to restore expanded state, then bind method
    fireEvent.click(screen.getByTestId('grpc-service-echo-echoservice'));
    fireEvent.click(screen.getByTestId('grpc-service-echo-echoservice'));
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-call-method-name').textContent).toMatch(/Echo/i);
    });
  });

  it('executes unary call after reflect and method selection', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      if (op === 'call') {
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    await waitFor(() => expect(screen.getByTestId('grpc-proto-form')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-send-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-response-status')).toBeTruthy();
    });
  });

  it('updates auth from the bottom tab and timeout from the settings drawer', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-auth-badge'));
    selectOption(screen.getByTestId('grpc-auth-type-select'), 'Bearer Token');
    fireEvent.change(screen.getByTestId('grpc-auth-bearer-token'), { target: { value: 'studio-token' } });
    fireEvent.click(screen.getByTestId('grpc-deadline-badge'));
    fireEvent.change(screen.getByTestId('grpc-call-settings-timeout'), { target: { value: '15000' } });
    await waitFor(() => {
      expect(screen.getByTestId('grpc-auth-badge').textContent).toMatch(/Bearer/);
      expect((screen.getByTestId('grpc-deadline-badge') as HTMLElement).textContent).toMatch(/15/);
    });
  });

  it('closes active tab from tab bar', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-add-tab'));
    await waitFor(() => expect(grpcStudioTabs().getAllByRole('tab')).toHaveLength(2));
    const closeButtons = grpcStudioTabs().getAllByTestId(/grpc-tab-close-/);
    fireEvent.click(closeButtons[0]!);
    await waitFor(() => {
      expect(grpcStudioTabs().getAllByRole('tab')).toHaveLength(1);
    });
  });

  it('cancels an in-flight unary call from the call panel', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      if (op === 'cancel') {
        return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
    await waitFor(() => expect(screen.getByTestId('grpc-proto-form')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-send-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-cancel-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('grpc-cancel-btn'));
    resolveCall!();

    await waitFor(() => {
      expect(screen.getByTestId('grpc-response-cancelled')).toBeTruthy();
    });
  });

  it('starts and cancels a server streaming call from the studio page', async () => {
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockImplementation(() => vi.fn());

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });
    setGrpcStreamTransport(async (path) => {
      if (path.includes('/stream/start')) {
        return createGrpcSuccessEnvelope('stream_start', {
          streamId: 'stream-test-1',
          requestId: 'req-stream-test',
          tabId: 'grpc-tab-1',
        });
      }
      return createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'stream-test-1',
        requestId: 'req-stream-test',
        tabId: 'grpc-tab-1',
        cancelled: true,
      });
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-serverstream'));
    await waitFor(() => expect(screen.getByTestId('grpc-stream-start-btn')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-stream-start-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-stream-cancel-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-stream-cancel-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-stream-start-btn')).toBeTruthy();
    });
  });

  it('keeps proto manage modal open when describe from ingest fails', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'describe' || op === 'reflect') {
        throw new GrpcApiClientError(op, 'bad proto', {
          code: op === 'describe'
            ? GRPC_ERROR_CODES.INVALID_DESCRIPTOR
            : GRPC_ERROR_CODES.REFLECTION_FAILED,
        });
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-manage-schemas-btn'));
    fireEvent.click(screen.getByTestId('grpc-proto-tab-proto-files'));
    const protoFile = new File(['syntax = "proto3";'], 'echo.proto', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"][accept=".proto"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [protoFile] });
    fireEvent.change(input);
    await waitFor(() => {
      expect((screen.getByTestId('grpc-proto-load-btn') as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(screen.getByTestId('grpc-proto-load-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-proto-manage-modal')).toBeTruthy();
      expect(screen.getByTestId('grpc-proto-load-error').textContent).toMatch(/bad proto/i);
    });
  });

  it('uses save snapshot fallback request id when crypto.randomUUID is unavailable', async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    try {
      render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
      fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
      await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());
      fireEvent.click(screen.getByTestId('grpc-method-echo-echoservice-echo'));
      await waitFor(() => expect(screen.getByTestId('grpc-proto-form')).toBeTruthy());
      fireEvent.click(screen.getByTestId('grpc-save-request-btn'));
      expect(screen.getByTestId('grpc-save-request-modal')).toBeTruthy();
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it('opens manage schemas and seeds proto ingest when none exists yet', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-manage-schemas-btn'));
    expect(screen.getByTestId('grpc-proto-upload-zone')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-proto-cancel-btn'));
    expect(screen.queryByTestId('grpc-proto-manage-modal')).toBeNull();
  });
});
