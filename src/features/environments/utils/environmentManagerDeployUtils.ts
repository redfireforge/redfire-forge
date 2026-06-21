import type { Microservice } from '../../../shared/types';
import { stripEnvFromProtocolEndpoints } from './protocolEndpointUtils';

export function applyToggleDeploy(
  microservices: Microservice[],
  svcId: string,
  envId: string,
): Microservice[] {
  return microservices.map((s) => {
    if (s.id !== svcId) return s;
    const next = { ...s.baseUrls };
    if (envId in next) delete next[envId];
    else next[envId] = '';
    return { ...s, baseUrls: next };
  });
}

export function isDuplicateAdditionalEnvName(
  name: string,
  environments: Array<{ name: string }>,
  svc: Microservice,
): boolean {
  const normalized = name.toLowerCase();
  const allEnvNames = [
    ...environments.map((e) => e.name.toLowerCase()),
    ...(svc.customEnvs ?? []).map((e) => e.name.toLowerCase()),
  ];
  return allEnvNames.includes(normalized);
}

export function applyAddAdditionalEnv(
  microservices: Microservice[],
  svcId: string,
  envId: string,
  name: string,
): Microservice[] {
  return microservices.map((s) => {
    if (s.id !== svcId) return s;
    return {
      ...s,
      customEnvs: [...(s.customEnvs ?? []), { id: envId, name }],
      baseUrls: { ...s.baseUrls, [envId]: '' },
    };
  });
}

export function applyDeleteAdditionalEnv(
  microservices: Microservice[],
  svcId: string,
  envId: string,
): Microservice[] {
  return microservices.map((s) => {
    if (s.id !== svcId) return s;
    const nextUrls = { ...s.baseUrls };
    delete nextUrls[envId];
    const nextAuth = { ...(s.authProfileIds ?? {}) };
    delete nextAuth[envId];
    return {
      ...s,
      baseUrls: nextUrls,
      authProfileIds: nextAuth,
      customEnvs: (s.customEnvs ?? []).filter((ce) => ce.id !== envId),
      protocolEndpoints: stripEnvFromProtocolEndpoints(s, envId),
    };
  });
}
