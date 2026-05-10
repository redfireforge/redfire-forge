import { useMemo } from 'react';
import type { Environment, Microservice, FeatureGroup, GlobalAuthProfile } from '../../shared/types';

interface UseDerivedViewStateArgs {
  environments: Environment[];
  microservices: Microservice[];
  featureGroups: FeatureGroup[];
  globalAuthProfiles: GlobalAuthProfile[];
  selectedEnvId: string;
  selectedSvcId: string;
}

export function useDerivedViewState({
  environments, microservices, featureGroups, globalAuthProfiles,
  selectedEnvId, selectedSvcId,
}: UseDerivedViewStateArgs) {
  const selectedEnv = environments.find((e) => e.id === selectedEnvId);
  const selectedSvc = microservices.find((s) => s.id === selectedSvcId);
  const resolvedBaseUrl = selectedEnv && selectedSvc ? (selectedSvc.baseUrls[selectedEnv.id] ?? '') : '';

  const envAuthProfileId = selectedSvc?.authProfileIds?.[selectedEnvId];
  const envFallbackAuth = envAuthProfileId
    ? globalAuthProfiles.find((p) => p.id === envAuthProfileId)?.auth
    : undefined;

  const filteredFeatureGroups = useMemo(() => {
    if (selectedSvcId && selectedEnvId) {
      return featureGroups.filter((fg) => fg.microserviceId === selectedSvcId && fg.environmentId === selectedEnvId);
    }
    if (selectedSvcId) {
      return featureGroups.filter((fg) => fg.microserviceId === selectedSvcId);
    }
    return [];
  }, [featureGroups, selectedSvcId, selectedEnvId]);

  const unassociatedFeatureGroups = useMemo(() => {
    const svcIds = new Set(microservices.map((s) => s.id));
    const envIds = new Set(environments.map((e) => e.id));
    const needsEnvAssignment = selectedSvcId
      ? featureGroups.filter((fg) => fg.microserviceId === selectedSvcId && !fg.environmentId)
      : [];
    const fullyUnassociated = featureGroups.filter((fg) => !fg.microserviceId);
    const orphanedFGs = featureGroups.filter((fg) =>
      (fg.microserviceId && !svcIds.has(fg.microserviceId)) ||
      (fg.environmentId && !envIds.has(fg.environmentId))
    );
    const seenIds = new Set([...needsEnvAssignment, ...fullyUnassociated].map((fg) => fg.id));
    return [
      ...needsEnvAssignment,
      ...fullyUnassociated,
      ...orphanedFGs.filter((fg) => !seenIds.has(fg.id)),
    ];
  }, [featureGroups, microservices, environments, selectedSvcId]);

  return {
    selectedEnv, selectedSvc, resolvedBaseUrl,
    envFallbackAuth, filteredFeatureGroups, unassociatedFeatureGroups,
  };
}
