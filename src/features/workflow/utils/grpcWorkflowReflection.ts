import type { GrpcCallType, GrpcDescriptor, GrpcMethodInfo, GrpcTlsMode } from '../../../shared/grpc/contracts';
import { postGrpcReflect } from '../../../shared/grpc/grpcApiClient';
import { validateResolvedGrpcTargetAddress } from '../../../shared/grpc/targetValidation';

export function listGrpcWorkflowMethods(
  descriptor: GrpcDescriptor | null,
  serviceFullName: string,
  callType: GrpcCallType,
): GrpcMethodInfo[] {
  if (!descriptor || !serviceFullName.trim()) return [];
  const service = descriptor.services.find((entry) => entry.fullName === serviceFullName);
  return (service?.methods ?? []).filter((method) => method.callType === callType);
}

export async function reflectGrpcWorkflowTarget(
  target: string,
  tlsMode: GrpcTlsMode = 'disabled',
): Promise<GrpcDescriptor> {
  const validation = validateResolvedGrpcTargetAddress(target);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const envelope = await postGrpcReflect({
    requestId: `wf-reflect-${Date.now()}`,
    target: {
      address: validation.normalized,
      tlsMode,
    },
    timeoutMs: 15_000,
  });

  return envelope.data;
}

export function buildGrpcWorkflowReflectionPatch<T extends {
  descriptorKey: string;
  service: string;
  method: string;
}>(
  data: T,
  descriptor: GrpcDescriptor,
  callType: GrpcCallType,
): Partial<T> {
  const patch: Partial<T> = {};
  if (data.descriptorKey !== descriptor.key) {
    patch.descriptorKey = descriptor.key;
  }

  const serviceNames = descriptor.services.map((service) => service.fullName);
  if (data.service && !serviceNames.includes(data.service)) {
    patch.service = '' as T['service'];
    patch.method = '' as T['method'];
    return patch;
  }

  if (data.service && data.method) {
    const methodNames = listGrpcWorkflowMethods(descriptor, data.service, callType).map((method) => method.name);
    if (!methodNames.includes(data.method)) {
      patch.method = '' as T['method'];
    }
  }

  return patch;
}
