/** Shared types for GraphqlStudioPage. */
import type { GlobalAuthProfile, Microservice } from '../../shared/types';

export type BottomPanelTab = 'variables' | 'headers' | 'files';
export type RightPaneView = 'response' | 'schema';
export type BottomPanelTabExtended = BottomPanelTab | 'runner';

export interface GraphqlStudioPageProps {
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
  selectedSvc?: Microservice;
  selectedEnvId?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
}
