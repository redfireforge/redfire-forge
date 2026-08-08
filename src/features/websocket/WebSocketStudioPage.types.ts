import type { GlobalAuthProfile, Microservice } from '../../shared/types';

export interface WebSocketStudioPageProps {
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
  selectedSvc?: Microservice;
  selectedEnvId?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
}
