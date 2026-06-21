import type { Microservice, ProtocolKey } from '../../../shared/types';
import { patchProtocolEndpoints } from './protocolEndpointUtils';

export function updateMicroserviceById(
  microservices: Microservice[],
  svcId: string,
  updater: (svc: Microservice) => Microservice,
): Microservice[] {
  return microservices.map((s) => (s.id === svcId ? updater(s) : s));
}

export function applySaveProtocolEndpoint(
  microservices: Microservice[],
  svc: Microservice,
  protocol: ProtocolKey,
  envId: string,
  baseUrl: string,
): { microservices: Microservice[]; changed: boolean; newUrl: string; oldUrl: string } {
  const oldUrl = svc.protocolEndpoints?.[protocol]?.[envId]?.baseUrl ?? '';
  const newUrl = baseUrl.trim();
  const nextEndpoints = patchProtocolEndpoints(svc, protocol, envId, { baseUrl: newUrl });
  return {
    microservices: updateMicroserviceById(microservices, svc.id, (s) => ({
      ...s,
      protocolEndpoints: nextEndpoints,
    })),
    changed: oldUrl !== newUrl,
    newUrl,
    oldUrl,
  };
}

export function applySaveGraphqlPath(
  microservices: Microservice[],
  svc: Microservice,
  envId: string,
  path: string,
): { microservices: Microservice[]; changed: boolean; normalized: string; oldPath: string } {
  const oldPath = svc.protocolEndpoints?.graphql?.[envId]?.path ?? '/graphql';
  const normalized = path.trim() || '/graphql';
  const existingBase = svc.protocolEndpoints?.graphql?.[envId]?.baseUrl?.trim();
  const nextEndpoints = patchProtocolEndpoints(svc, 'graphql', envId, {
    ...(existingBase ? { baseUrl: existingBase } : {}),
    path: normalized,
  });
  return {
    microservices: updateMicroserviceById(microservices, svc.id, (s) => ({
      ...s,
      protocolEndpoints: nextEndpoints,
    })),
    changed: oldPath !== normalized,
    normalized,
    oldPath,
  };
}

export function applyToggleGrpcTls(
  microservices: Microservice[],
  svc: Microservice,
  envId: string,
  tls: boolean,
): { microservices: Microservice[]; changed: boolean; oldTls: boolean } {
  const oldTls = svc.protocolEndpoints?.grpc?.[envId]?.tls ?? false;
  const existingBase = svc.protocolEndpoints?.grpc?.[envId]?.baseUrl?.trim();
  const nextEndpoints = patchProtocolEndpoints(svc, 'grpc', envId, {
    ...(existingBase ? { baseUrl: existingBase } : {}),
    tls,
  });
  return {
    microservices: updateMicroserviceById(microservices, svc.id, (s) => ({
      ...s,
      protocolEndpoints: nextEndpoints,
    })),
    changed: oldTls !== tls,
    oldTls,
  };
}

export function applyAuthProfile(
  microservices: Microservice[],
  svc: Microservice,
  envId: string,
  profileId: string | undefined,
): { microservices: Microservice[]; changed: boolean; oldProfileId: string } {
  const oldProfileId = svc.authProfileIds?.[envId] ?? '';
  const next = microservices.map((s) => {
    if (s.id !== svc.id) return s;
    const authNext = { ...(s.authProfileIds ?? {}) };
    if (profileId) authNext[envId] = profileId;
    else delete authNext[envId];
    return { ...s, authProfileIds: authNext };
  });
  return {
    microservices: next,
    changed: oldProfileId !== (profileId ?? ''),
    oldProfileId,
  };
}
