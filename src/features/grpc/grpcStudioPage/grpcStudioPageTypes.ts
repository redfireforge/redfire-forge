import type { GlobalAuthProfile, Microservice } from '../../../shared/types';

export interface GrpcStudioPageProps {
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
  selectedSvc?: Microservice;
  selectedEnvId?: string;
  workspaceDefaultsOverride?: Record<string, string>;
  globalAuthProfiles?: GlobalAuthProfile[];
}

export type GrpcStudioDensityMode = 'compact' | 'comfortable';

export const GRPC_STUDIO_DENSITY_STORAGE_KEY = 'grpc-studio-density-mode';
