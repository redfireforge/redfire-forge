import { useRef, useEffect } from 'react';
import type { Environment, Microservice } from '../../shared/types';

interface Options {
  loading: boolean;
  environments: Environment[];
  microservices: Microservice[];
  setMicroservices: (updater: (prev: Microservice[]) => Microservice[]) => void;
}

/**
 * One-time migration (runs once after initial load): ensures the "Gallery Samples"
 * microservice has a baseUrl entry for the "Gallery Samples" environment.
 * This fixes pre-0.9.1 data where the entry was missing.
 */
export function useGalleryMigration({ loading, environments, microservices, setMicroservices }: Options): void {
  const applied = useRef(false);

  useEffect(() => {
    if (loading || applied.current) return;
    applied.current = true;
    const galEnv = environments.find(e => e.name === 'Gallery Samples');
    const galSvc = microservices.find(s => s.name === 'Gallery Samples');
    if (galEnv && galSvc && !(galEnv.id in galSvc.baseUrls)) {
      setMicroservices(prev => prev.map(s =>
        s.id === galSvc.id ? { ...s, baseUrls: { ...s.baseUrls, [galEnv.id]: '' } } : s
      ));
    }
  }, [loading, environments, microservices, setMicroservices]);
}
