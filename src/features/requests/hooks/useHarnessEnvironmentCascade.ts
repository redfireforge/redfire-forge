import { useMemo } from 'react';
import type { Environment, Microservice } from '../../../shared/types';

/**
 * Shared logic for building environment cascade options and filtering
 * microservices by selected environment. Used by both SendToHarnessModal
 * and BatchSendToHarnessModal.
 */
export function useHarnessEnvironmentCascade(
  environments: Environment[],
  microservices: Microservice[],
  envId: string,
) {
  const envOptions = useMemo(() => {
    const opts = environments.map(e => ({ id: e.id, name: e.name }));
    for (const svc of microservices) {
      for (const ce of (svc.customEnvs ?? [])) {
        if (!opts.some(o => o.id === ce.id)) {
          opts.push({ id: ce.id, name: `${ce.name} (${svc.name})` });
        }
      }
    }
    return opts;
  }, [environments, microservices]);

  const filteredMicroservices = useMemo(() => {
    if (!envId) return microservices;
    return microservices.filter(s =>
      envId in s.baseUrls || (s.customEnvs ?? []).some(ce => ce.id === envId)
    );
  }, [envId, microservices]);

  return { envOptions, filteredMicroservices };
}
