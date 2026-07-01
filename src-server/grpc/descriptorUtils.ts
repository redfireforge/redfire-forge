import type { GrpcDescriptor, GrpcMethodInfo, GrpcServiceInfo } from '../../src/shared/grpc/contracts.js';

export function findGrpcService(
  descriptor: GrpcDescriptor,
  serviceName: string,
): GrpcServiceInfo | undefined {
  return descriptor.services.find((service) => service.fullName === serviceName);
}

export function findGrpcMethod(
  descriptor: GrpcDescriptor,
  serviceName: string,
  methodName: string,
): GrpcMethodInfo | undefined {
  return findGrpcService(descriptor, serviceName)?.methods.find(
    (method) => method.name === methodName,
  );
}

export function collectMessageSchemas(descriptor: GrpcDescriptor): Map<string, GrpcMethodInfo['requestSchema']> {
  const schemas = new Map<string, GrpcMethodInfo['requestSchema']>();
  for (const service of descriptor.services) {
    for (const method of service.methods) {
      schemas.set(method.requestTypeName, method.requestSchema);
      schemas.set(method.responseTypeName, method.responseSchema);
    }
  }
  return schemas;
}
