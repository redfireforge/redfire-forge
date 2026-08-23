import { v4 as uuidv4 } from 'uuid';
import type { FeatureGroup, RequestCollection, RequestFolder, Scenario, TestScenario } from '@shared/types';
import type { PromotionContext, PromotionOptions } from './requestToScenario';
import { createScenarioFromRequest } from './requestToScenario';

export interface PromoteTarget {
  targetGroupId?: string;
  targetScenarioId?: string;
  newGroupName?: string;
  newScenarioName?: string;
  environmentId?: string;
  microserviceId?: string;
}

export interface PromoteResult {
  featureGroups: FeatureGroup[];
  createdGroupId: string;
  createdScenarioId: string;
}

export function promoteToFeatureGroups(
  featureGroups: FeatureGroup[],
  scenario: Scenario,
  target: PromoteTarget,
): PromoteResult {
  let groups = [...featureGroups];
  let groupId = target.targetGroupId;
  let scenarioId = target.targetScenarioId;

  if (!groupId && target.newGroupName) {
    groupId = uuidv4();
    const newScenarioId = uuidv4();
    const newScenarioName = target.newScenarioName?.trim() || scenario.name || 'Default';
    const newGroup: FeatureGroup = {
      id: groupId,
      name: target.newGroupName.trim(),
      microserviceId: target.microserviceId,
      environmentId: target.environmentId,
      scenarios: [{
        id: newScenarioId,
        name: newScenarioName,
        kind: 'standard',
        tests: [scenario],
      }],
    };
    groups = [newGroup, ...groups];
    return { featureGroups: groups, createdGroupId: groupId, createdScenarioId: newScenarioId };
  }

  if (!groupId) {
    return { featureGroups: groups, createdGroupId: '', createdScenarioId: '' };
  }

  if (!scenarioId && target.newScenarioName) {
    scenarioId = uuidv4();
    const newScenario: TestScenario = {
      id: scenarioId,
      name: target.newScenarioName.trim(),
      kind: 'standard',
      tests: [scenario],
    };
    const finalScenarioId = scenarioId;
    groups = groups.map(fg =>
      fg.id === groupId
        ? { ...fg, scenarios: [...fg.scenarios, newScenario] }
        : fg,
    );
    return { featureGroups: groups, createdGroupId: groupId, createdScenarioId: finalScenarioId };
  }

  if (scenarioId) {
    groups = groups.map(fg =>
      fg.id === groupId
        ? {
            ...fg,
            scenarios: fg.scenarios.map(sc =>
              sc.id === scenarioId
                ? { ...sc, tests: [...sc.tests, scenario] }
                : sc,
            ),
          }
        : fg,
    );
    return { featureGroups: groups, createdGroupId: groupId, createdScenarioId: scenarioId };
  }

  return { featureGroups: groups, createdGroupId: groupId, createdScenarioId: '' };
}

export interface BatchPromoteResult {
  featureGroup: FeatureGroup;
  promotedRequestIds: string[];
}

/**
 * Promote an entire collection (or selected requests) to a single FeatureGroup.
 * Maps: collection → FeatureGroup, folders → TestScenarios, requests → tests.
 */
export function batchPromoteCollection(
  collection: RequestCollection,
  context: PromotionContext,
  selectedRequestIds?: Set<string>,
  options?: PromotionOptions,
  targetEnvId?: string,
  targetSvcId?: string,
): BatchPromoteResult {
  const promotedRequestIds: string[] = [];
  const scenarios: TestScenario[] = [];

  const rootReqs = collection.requests
    .filter(r => !selectedRequestIds || selectedRequestIds.has(r.id));

  if (rootReqs.length > 0) {
    const tests = rootReqs.map(req => createScenarioFromRequest(req, context, options));
    promotedRequestIds.push(...rootReqs.map(r => r.id));
    scenarios.push({
      id: uuidv4(),
      name: collection.name,
      kind: 'standard',
      tests,
    });
  }

  const processFolders = (folders: RequestFolder[]) => {
    for (const folder of folders) {
      const filteredReqs = folder.requests
        .filter(r => !selectedRequestIds || selectedRequestIds.has(r.id));
      if (filteredReqs.length > 0) {
        const ctx = { ...context, folderId: folder.id };
        const tests = filteredReqs.map(req => createScenarioFromRequest(req, ctx, options));
        promotedRequestIds.push(...filteredReqs.map(r => r.id));
        scenarios.push({
          id: uuidv4(),
          name: folder.name,
          kind: 'standard',
          tests,
        });
      }
      if (folder.folders) processFolders(folder.folders);
    }
  };

  if (collection.folders) processFolders(collection.folders);

  const featureGroup: FeatureGroup = {
    id: uuidv4(),
    name: collection.name,
    microserviceId: targetSvcId ?? collection.microserviceId,
    environmentId: targetEnvId,
    scenarios,
  };

  return { featureGroup, promotedRequestIds };
}
