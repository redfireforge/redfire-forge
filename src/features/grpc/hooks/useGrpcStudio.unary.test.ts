/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_HAPPY_CALL_ENVELOPE,
  FIXTURE_CALL_FAILED_ENVELOPE,
  FIXTURE_CANCELLED_ENVELOPE,
  FIXTURE_CANCEL_SUCCESS_ENVELOPE,
} from '@shared/grpc/contractFixtures';
import { setGrpcClientTransport } from '@shared/grpc/grpcApiClient';
const downloadProtosetFileMock = vi.hoisted(() => vi.fn());
vi.mock('../utils/downloadProtoset', () => ({
  downloadProtosetFile: (...args: unknown[]) => downloadProtosetFileMock(...args),
}));

import {useGrpcStudio } from './useGrpcStudio';
import { PAGE_DEFAULTS, seedUnaryReadyTab, setupUseGrpcStudioHookTest } from './useGrpcStudio.testHelpers';

describe('useGrpcStudio executeUnaryCall (Phase 1G)', () => {
  beforeEach(() => setupUseGrpcStudioHookTest({ restoreMocks: true }));

  it('executeUnaryCall sets calling lifecycle before HTTP await', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      void result.current.executeUnaryCall(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.lifecycle).toBe('calling');

    resolveCall!();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('executeUnaryCall stores success result on happy path', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'call') return FIXTURE_HAPPY_CALL_ENVELOPE;
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('success');
    expect(tab.lastResult?.body).toEqual({ message: 'hello grpc' });
    expect(tab.activeRequestId).toBeUndefined();
  });

  it('executeUnaryCall sets error lifecycle on failure envelope', async () => {
    setGrpcClientTransport(async () => FIXTURE_CALL_FAILED_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('error');
    expect(tab.lastError?.message).toContain('NOT_FOUND');
  });

  it('cancelUnaryCall marks tab cancelled and ignores late success', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    let executePromise: Promise<void>;
    act(() => {
      executePromise = result.current.executeUnaryCall(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.lifecycle).toBe('calling');

    await act(async () => {
      await result.current.cancelUnaryCall(tabId);
    });

    resolveCall!();
    await act(async () => {
      await executePromise!;
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('cancelled');
    expect(tab.lastResult).toBeUndefined();
  });

  it('executeUnaryCall applies response after connection change while call is in flight (Phase 9C)', async () => {
    let resolveSlow: (() => void) | undefined;
    const slowGate = new Promise<void>((resolve) => {
      resolveSlow = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await slowGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    let firstCall: Promise<void>;
    act(() => {
      firstCall = result.current.executeUnaryCall(tabId);
    });

    act(() => {
      result.current.updateTab(tabId, { target: 'localhost:50052' });
    });

    resolveSlow!();
    await act(async () => {
      await firstCall!;
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('success');
    expect(tab.lastResult).toBeDefined();
    expect(tab.target).toBe('localhost:50052');
  });

  it('executeUnaryCall sets validation error when snapshot cannot be captured', async () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(tabId, {
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
      });
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('error');
    expect(tab.lastError?.message).toMatch(/descriptorKey|target/i);
  });

  it('cancelUnaryCall invokes onCancelInFlight callback', async () => {
    const onCancelInFlight = vi.fn();
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      onCancelInFlight,
    }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      void result.current.executeUnaryCall(tabId);
    });

    await act(async () => {
      await result.current.cancelUnaryCall(tabId);
    });

    expect(onCancelInFlight).toHaveBeenCalledWith(tabId, expect.any(String));
    resolveCall!();
  });

  it('executeUnaryCall applies body overrides without waiting for tab state flush', async () => {
    let capturedBody: Record<string, unknown> | undefined;
    setGrpcClientTransport(async (op, _path, init) => {
      if (op === 'call') {
        const payload = JSON.parse(String(init.body)) as { body: Record<string, unknown> };
        capturedBody = payload.body;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      result.current.updateTab(tabId, { body: { message: 'stale-tab-body' } });
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabId, { body: { message: 'override-body' } });
    });

    expect(capturedBody).toEqual({ message: 'override-body' });
    expect(result.current.tabs.find((entry) => entry.id === tabId)!.lifecycle).toBe('success');
  });

  it('executeUnaryCall posts oauth2 auth without client-side metadata merge (Phase 4D)', async () => {
    let capturedPayload: { auth?: { type?: string }; metadata?: Record<string, string> } | undefined;
    setGrpcClientTransport(async (op, _path, init) => {
      if (op === 'call') {
        capturedPayload = JSON.parse(String(init.body)) as {
          auth?: { type?: string };
          metadata?: Record<string, string>;
        };
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = result.current.activeTab.id;
    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
        metadata: { 'x-trace': 'abc' },
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'client',
            clientSecret: 'secret',
          },
        },
      });
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    expect(capturedPayload?.auth?.type).toBe('oauth2');
    expect(capturedPayload?.metadata).toEqual({ 'x-trace': 'abc' });
    expect(capturedPayload?.metadata?.authorization).toBeUndefined();
    expect(result.current.tabs.find((entry) => entry.id === tabId)!.lifecycle).toBe('success');
  });

  it('cancelUnaryCall does not overwrite a tab that already completed successfully', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'call') return FIXTURE_HAPPY_CALL_ENVELOPE;
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    expect(result.current.tabs.find((entry) => entry.id === tabId)!.lifecycle).toBe('success');

    await act(async () => {
      await result.current.cancelUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('success');
    expect(tab.lastResult?.body).toEqual({ message: 'hello grpc' });
  });

  it('reflectTab aborts in-flight unary and ignores late response', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    let executePromise: Promise<void>;
    act(() => {
      executePromise = result.current.executeUnaryCall(tabId);
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    resolveCall!();
    await act(async () => {
      await executePromise!;
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('idle');
    expect(tab.lastResult).toBeUndefined();
    expect(result.current.getTabDescriptor(tabId).loadState).toBe('loaded');
  });

  it('executeUnaryCall success does not leak to sibling tabs', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'call') return FIXTURE_HAPPY_CALL_ENVELOPE;
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));

    act(() => {
      result.current.addTab();
    });

    const tabA = result.current.tabs[0]!.id;
    const tabB = result.current.tabs[1]!.id;

    act(() => {
      result.current.updateTab(tabA, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'tab-a' },
      });
      result.current.updateTab(tabB, {
        target: 'localhost:50052',
        body: { message: 'tab-b' },
      });
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabA);
    });

    const updatedA = result.current.tabs.find((entry) => entry.id === tabA)!;
    const updatedB = result.current.tabs.find((entry) => entry.id === tabB)!;
    expect(updatedA.lifecycle).toBe('success');
    expect(updatedB.lifecycle).toBe('idle');
    expect(updatedB.lastResult).toBeUndefined();
  });

  it('maps GRPC_CANCELLED client error to cancelled lifecycle', async () => {
    setGrpcClientTransport(async () => FIXTURE_CANCELLED_ENVELOPE);

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('cancelled');
  });

  it('executeUnaryCall rejects invalid metadata at snapshot time', async () => {
    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      result.current.updateTab(tabId, {
        metadata: { 'payload-bin': '%%%' },
      });
    });

    await act(async () => {
      await result.current.executeUnaryCall(tabId);
    });

    const tab = result.current.tabs.find((entry) => entry.id === tabId)!;
    expect(tab.lifecycle).toBe('error');
    expect(tab.lastError?.message).toMatch(/base64/i);
  });

  it('executeUnaryCall ignores duplicate invoke while claim is active', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });
    let callCount = 0;

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        callCount += 1;
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      void result.current.executeUnaryCall(tabId);
      void result.current.executeUnaryCall(tabId);
    });

    resolveCall!();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(callCount).toBe(1);
  });

  it('closeTab aborts in-flight call via inFlightCallRef before activeRequestId commits', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });
    const cancelPaths: string[] = [];

    setGrpcClientTransport(async (op, path) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      if (op === 'cancel') {
        cancelPaths.push(path);
        return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const onCancelInFlight = vi.fn();
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      onCancelInFlight,
    }));

    act(() => {
      result.current.addTab();
    });
    const tabId = result.current.tabs[1]!.id;

    act(() => {
      result.current.updateTab(tabId, {
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR.key,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
      });
    });

    act(() => {
      void result.current.executeUnaryCall(tabId);
      result.current.closeTab(tabId);
    });

    expect(onCancelInFlight).toHaveBeenCalledWith(tabId, expect.any(String));
    expect(cancelPaths.length).toBe(1);
    expect(result.current.tabs).toHaveLength(1);

    resolveCall!();
  });

  it('reflectTab invokes onCancelInFlight when aborting an in-flight call', async () => {
    let resolveCall: (() => void) | undefined;
    const callGate = new Promise<void>((resolve) => {
      resolveCall = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'call') {
        await callGate;
        return FIXTURE_HAPPY_CALL_ENVELOPE;
      }
      if (op === 'reflect') {
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      return FIXTURE_CANCEL_SUCCESS_ENVELOPE;
    });

    const onCancelInFlight = vi.fn();
    const { result } = renderHook(() => useGrpcStudio({
      pageDefaults: PAGE_DEFAULTS,
      onCancelInFlight,
    }));
    const tabId = seedUnaryReadyTab(result);

    act(() => {
      void result.current.executeUnaryCall(tabId);
    });

    await act(async () => {
      await result.current.reflectTab(tabId);
    });

    expect(onCancelInFlight).toHaveBeenCalledWith(tabId, expect.any(String));

    resolveCall!();
  });

  it('duplicateTab during reflect gives copy idle descriptor state', async () => {
    let resolveReflect: (() => void) | undefined;
    const reflectGate = new Promise<void>((resolve) => {
      resolveReflect = resolve;
    });

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        await reflectGate;
        return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
      }
      return FIXTURE_HAPPY_CALL_ENVELOPE;
    });

    const { result } = renderHook(() => useGrpcStudio({ pageDefaults: PAGE_DEFAULTS }));
    const sourceId = result.current.activeTab.id;

    act(() => {
      result.current.updateTab(sourceId, { target: 'localhost:50051' });
    });

    act(() => {
      void result.current.reflectTab(sourceId);
    });

    expect(result.current.getTabDescriptor(sourceId).loadState).toBe('loading');

    act(() => {
      result.current.duplicateTab(sourceId);
    });

    const copy = result.current.tabs.find((tab) => tab.id !== sourceId)!;
    expect(result.current.getTabDescriptor(copy.id).loadState).toBe('idle');

    resolveReflect!();
    await waitFor(() => {
      expect(result.current.getTabDescriptor(sourceId).loadState).toBe('loaded');
    });
  });
});
