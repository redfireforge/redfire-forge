import { grpc } from './grpcJsLoader.js';
import { GrpcReflection } from 'grpc-js-reflection-client';
import protobuf from 'protobufjs';
import type { GrpcTlsConfig, GrpcTlsMode } from '../../src/shared/grpc/contracts.js';
import {
  preferIpv4LoopbackDialAddress,
  validateResolvedGrpcTargetAddress,
} from '../../src/shared/grpc/targetValidation.js';
import { buildGrpcChannelCredentials } from './grpcChannelCredentials.js';
import { mergeProtobufRoots } from './descriptorNormalizer.js';
import { ensureLocalGrpcBypassesProxyEnv } from './grpcClient.js';
import {
  formatReflectionFailureMessage,
  ReflectionFetchError,
  type ReflectionFailureDiagnostics,
} from './reflectionDiagnostics.js';

// Reflection dials grpc-js directly (no shared GrpcJsClient), so loopback
// targets need the same NO_PROXY guarantee grpcClient.ts sets up on import.
ensureLocalGrpcBypassesProxyEnv();

export type ReflectionApiVersion = 'v1' | 'v1alpha';

export interface ReflectionFetchParams {
  address: string;
  timeoutMs: number;
  serviceNames?: string[];
  tlsMode?: GrpcTlsMode;
  tlsConfig?: GrpcTlsConfig;
}

export interface ReflectionFetchResult {
  root: protobuf.Root;
  reflectionVersion: ReflectionApiVersion;
  serviceNames: string[];
}

export interface ReflectionClientPort {
  fetchReflectionRoot(params: ReflectionFetchParams): Promise<ReflectionFetchResult>;
}

function grpcCallOptions(deadlineMs: number): grpc.CallOptions {
  return { deadline: deadlineMs };
}

const REFLECTION_INFRA_SERVICE_PREFIXES = ['grpc.reflection.', 'grpc.health.'];

function isUserFacingService(serviceName: string): boolean {
  return !REFLECTION_INFRA_SERVICE_PREFIXES.some((prefix) => serviceName.startsWith(prefix));
}

function filterServiceNames(
  discovered: string[],
  requested?: string[],
): string[] {
  const visible = discovered.filter(isUserFacingService);
  if (!requested?.length) {
    return visible.sort((a, b) => a.localeCompare(b));
  }
  const requestedSet = new Set(requested);
  return visible.filter((name) => requestedSet.has(name)).sort((a, b) => a.localeCompare(b));
}

async function listServicesWithVersion(
  address: string,
  deadlineMs: number,
  version: ReflectionApiVersion,
  credentials: grpc.ChannelCredentials,
): Promise<string[]> {
  const client = new GrpcReflection(
    address,
    credentials,
    {},
    version,
  );
  return client.listServices('*', grpcCallOptions(deadlineMs));
}

async function fetchRootWithVersion(
  address: string,
  deadlineMs: number,
  version: ReflectionApiVersion,
  serviceNames: string[],
  credentials: grpc.ChannelCredentials,
): Promise<protobuf.Root> {
  const client = new GrpcReflection(
    address,
    credentials,
    {},
    version,
  );
  const options = grpcCallOptions(deadlineMs);
  const roots: protobuf.Root[] = [];
  for (const serviceName of serviceNames) {
    const descriptor = await client.getDescriptorBySymbol(serviceName, options);
    roots.push(descriptor.getProtobufJsRoot());
  }
  return roots.length === 1 ? roots[0]! : mergeProtobufRoots(roots);
}

async function tryFetchWithVersion(
  address: string,
  deadlineMs: number,
  version: ReflectionApiVersion,
  credentials: grpc.ChannelCredentials,
  serviceNames?: string[],
): Promise<ReflectionFetchResult> {
  if (Date.now() >= deadlineMs) {
    throw new Error('DEADLINE_EXCEEDED: reflection timed out');
  }
  const discovered = await listServicesWithVersion(address, deadlineMs, version, credentials);
  const selected = filterServiceNames(discovered, serviceNames);
  if (selected.length === 0) {
    if (serviceNames?.length) {
      throw new Error(`No matching services found via reflection (requested: ${serviceNames.join(', ')})`);
    }
    throw new Error('No user-facing gRPC services found via reflection');
  }
  const root = await fetchRootWithVersion(address, deadlineMs, version, selected, credentials);
  return {
    root,
    reflectionVersion: version,
    serviceNames: selected,
  };
}

function isNoMatchingServicesError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /No matching services found via reflection|No user-facing gRPC services found via reflection/i.test(message);
}

function isReflectionUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIMPLEMENTED|not found|Unknown proto version|Method not found|No such/i.test(message);
}

function isUnreachableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|Unavailable/i.test(message);
}

export class GrpcReflectionClient implements ReflectionClientPort {
  async fetchReflectionRoot(params: ReflectionFetchParams): Promise<ReflectionFetchResult> {
    const check = validateResolvedGrpcTargetAddress(params.address);
    if (!check.valid) {
      throw new Error(check.reason);
    }
    if (check.kind === 'in_process') {
      throw new Error('in-process targets are not dialable from the Node server (Phase 1C)');
    }

    const dialAddress = preferIpv4LoopbackDialAddress(check.normalized);
    const deadlineMs = Date.now() + params.timeoutMs;
    const credentials = buildGrpcChannelCredentials({
      tlsMode: params.tlsMode,
      tlsConfig: params.tlsConfig,
    });
    let v1Error: unknown;
    try {
      return await tryFetchWithVersion(
        dialAddress,
        deadlineMs,
        'v1',
        credentials,
        params.serviceNames,
      );
    } catch (error) {
      v1Error = error;
      if (isUnreachableError(error) || isNoMatchingServicesError(error)) {
        throw error;
      }
    }

    if (Date.now() >= deadlineMs) {
      throw new Error('DEADLINE_EXCEEDED: reflection timed out');
    }

    try {
      return await tryFetchWithVersion(
        dialAddress,
        deadlineMs,
        'v1alpha',
        credentials,
        params.serviceNames,
      );
    } catch (v1alphaError) {
      if (isUnreachableError(v1alphaError) || isNoMatchingServicesError(v1alphaError)) {
        throw v1alphaError;
      }
      const diagnostics: ReflectionFailureDiagnostics = {
        v1Error: v1Error instanceof Error ? v1Error.message : String(v1Error),
        v1alphaError: v1alphaError instanceof Error ? v1alphaError.message : String(v1alphaError),
        fallbackAttempted: true,
      };
      throw new ReflectionFetchError(
        formatReflectionFailureMessage(diagnostics),
        diagnostics,
      );
    }
  }
}

export const grpcReflectionClient = new GrpcReflectionClient();

export { isNoMatchingServicesError, isReflectionUnavailableError, isUnreachableError };
export { ReflectionFetchError } from './reflectionDiagnostics.js';
