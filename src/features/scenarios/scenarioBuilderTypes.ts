import type { FeatureGroup, Microservice, GlobalAuthProfile, SharedDataSource } from '../../shared/types';

export interface ScenarioBuilderProps {
  featureGroups: FeatureGroup[];
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  sharedDataSources?: SharedDataSource[];
  setSharedDataSources?: React.Dispatch<React.SetStateAction<SharedDataSource[]>>;
  resolvedBaseUrl?: string;
  selectedSvcId?: string;
  selectedSvcName?: string;
  selectedEnvId?: string;
  selectedEnvName?: string;
  isAdditionalEnv?: boolean;
  unassociatedFeatureGroups?: FeatureGroup[];
  microservices?: Microservice[];
  environments?: { id: string; name: string }[];
  globalAuthProfiles?: GlobalAuthProfile[];
  onMoveScenario?: (scenarioId: string, sourceFgId: string, targetFgId: string) => void;
  onMoveTest?: (testId: string, sourceScenarioId: string, sourceFgId: string, targetScenarioId: string, targetFgId: string) => void;
  pendingEditTest?: { featureId: string; scenarioId: string; testId: string };
  onPendingEditConsumed?: () => void;
  onLocateRequest?: (requestId: string) => void;
}
