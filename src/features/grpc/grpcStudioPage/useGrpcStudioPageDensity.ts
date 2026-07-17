import { useEffect, useState } from 'react';
import {
  GRPC_STUDIO_DENSITY_STORAGE_KEY,
  type GrpcStudioDensityMode,
} from './grpcStudioPageTypes';

export function useGrpcStudioPageDensity() {
  const [densityMode, setDensityMode] = useState<GrpcStudioDensityMode>(() => {
    try {
      const stored = window.localStorage.getItem(GRPC_STUDIO_DENSITY_STORAGE_KEY);
      return stored === 'comfortable' ? 'comfortable' : 'compact';
    } catch {
      return 'compact';
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(GRPC_STUDIO_DENSITY_STORAGE_KEY, densityMode);
    } catch {
      /* persistence best-effort */
    }
  }, [densityMode]);

  return { densityMode, setDensityMode };
}
