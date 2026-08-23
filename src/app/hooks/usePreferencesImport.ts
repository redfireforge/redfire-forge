import { useCallback } from 'react';
import type { Environment, Microservice, FeatureGroup, GlobalAuthProfile } from '@shared/types';
import type { Tab } from '../utils/appTabUtils';
import { mergeById } from '@shared/utils/helpers';
import { normalizeGroupActionTypes } from '@shared/utils/scenarioMigration';

export interface UsePreferencesImportParams {
  setEnvironments: React.Dispatch<React.SetStateAction<Environment[]>>;
  setMicroservices: React.Dispatch<React.SetStateAction<Microservice[]>>;
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  setAppGlobalAuthProfiles: React.Dispatch<React.SetStateAction<GlobalAuthProfile[]>>;
  setActiveTab: (tab: Tab) => void;
}

export function usePreferencesImport({
  setEnvironments,
  setMicroservices,
  setFeatureGroups,
  setAppGlobalAuthProfiles,
  setActiveTab,
}: UsePreferencesImportParams) {
  const handleImportData = useCallback(async (data: {
    environments?: Environment[];
    microservices?: Microservice[];
    featureGroups?: FeatureGroup[];
    globalAuthProfiles?: GlobalAuthProfile[];
  }) => {
    if (data.environments?.length) {
      setEnvironments((prev) => mergeById(prev, data.environments!));
    }
    if (data.microservices?.length) {
      setMicroservices((prev) => mergeById(prev, data.microservices!));
    }
    if (data.featureGroups?.length) {
      setFeatureGroups((prev) => [...prev, ...normalizeGroupActionTypes(data.featureGroups!)]);
    }
    if (data.globalAuthProfiles?.length) {
      setAppGlobalAuthProfiles((prev) => mergeById(prev, data.globalAuthProfiles!));
    }
    setActiveTab('environments');
  }, [
    setEnvironments,
    setMicroservices,
    setFeatureGroups,
    setAppGlobalAuthProfiles,
    setActiveTab,
  ]);

  return { handleImportData };
}
