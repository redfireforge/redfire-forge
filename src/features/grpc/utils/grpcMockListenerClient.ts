/**
 * Phase 11M — web companion server mock listener API client.
 */
import { httpFetch } from '../../../shared/utils/httpClient';
import { isTauri } from '../../../shared/utils/platform';
import type {
  GrpcMockListenerCommitRequest,
  GrpcMockListenerCommitResult,
  GrpcMockListenerLogsResult,
  GrpcMockListenerStartRequest,
  GrpcMockListenerStatus,
} from '../../../shared/grpc/grpcMockListenerContracts';
import type { GrpcExportProtosetResult, GrpcRouteEnvelope } from '../../../shared/grpc/contracts';
import {
  invokeGrpcMockListenerCommitNative,
  invokeGrpcMockListenerLogNative,
  invokeGrpcMockListenerStartNative,
  invokeGrpcMockListenerStatusNative,
  invokeGrpcMockListenerStopNative,
} from '../../../shared/grpc/grpcNativeTauriMockListener';

interface MockApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

async function mockFetch<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const payload = method !== 'GET' && body !== undefined ? JSON.stringify(body) : undefined;
  if (payload != null) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await httpFetch(path, method, headers, payload);
  let parsed: MockApiEnvelope<T>;
  try {
    parsed = JSON.parse(response.body) as MockApiEnvelope<T>;
  } catch {
    throw new Error(`Mock listener API returned ${response.status} (non-JSON response)`);
  }
  if (!parsed.ok) {
    throw new Error(parsed.error?.message ?? 'Mock listener API request failed');
  }
  return parsed.data as T;
}

export function supportsGrpcMockNetworkListener(): boolean {
  return true;
}

export async function startGrpcMockNetworkListener(
  request: GrpcMockListenerStartRequest,
): Promise<GrpcMockListenerStatus> {
  if (isTauri()) {
    return invokeGrpcMockListenerStartNative(request);
  }
  const data = await mockFetch<{ status: GrpcMockListenerStatus }>(
    'POST',
    '/api/grpc/mock/start',
    request,
  );
  return data.status;
}

export async function stopGrpcMockNetworkListener(tabId: string): Promise<GrpcMockListenerStatus> {
  if (isTauri()) {
    return invokeGrpcMockListenerStopNative(tabId);
  }
  const data = await mockFetch<{ status: GrpcMockListenerStatus }>(
    'POST',
    '/api/grpc/mock/stop',
    { tabId },
  );
  return data.status;
}

export async function commitGrpcMockNetworkListener(
  request: GrpcMockListenerCommitRequest,
): Promise<GrpcMockListenerCommitResult> {
  if (isTauri()) {
    return invokeGrpcMockListenerCommitNative(request);
  }
  return mockFetch<GrpcMockListenerCommitResult>('POST', '/api/grpc/mock/commit', request);
}

export async function fetchGrpcMockNetworkListenerStatus(tabId: string): Promise<GrpcMockListenerStatus> {
  if (isTauri()) {
    return invokeGrpcMockListenerStatusNative(tabId);
  }
  const data = await mockFetch<{ status: GrpcMockListenerStatus }>(
    'GET',
    `/api/grpc/mock/status?tabId=${encodeURIComponent(tabId)}`,
  );
  return data.status;
}

export async function fetchGrpcMockNetworkListenerLogs(
  tabId: string,
  since = -1,
): Promise<GrpcMockListenerLogsResult> {
  if (isTauri()) {
    return invokeGrpcMockListenerLogNative(tabId, since);
  }
  return mockFetch<GrpcMockListenerLogsResult>(
    'GET',
    `/api/grpc/mock/log?tabId=${encodeURIComponent(tabId)}&since=${since}`,
  );
}

export async function exportGrpcDescriptorProtoset(descriptorKey: string): Promise<{
  protosetBase64: string;
}> {
  const response = await httpFetch(
    '/api/grpc/export-protoset',
    'POST',
    { Accept: 'application/json', 'Content-Type': 'application/json' },
    JSON.stringify({ descriptorKey }),
  );
  const envelope = JSON.parse(response.body) as GrpcRouteEnvelope<GrpcExportProtosetResult>;
  if (!envelope.ok) {
    throw new Error(envelope.error.message);
  }
  return { protosetBase64: envelope.data.protosetBase64 };
}
