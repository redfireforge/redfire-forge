import type { CatalogEntry, CatalogEndpoint, CatalogSpecDiff, EndpointDiff } from '../types/catalog';

function collectEndpoints(entry: CatalogEntry): CatalogEndpoint[] {
  const eps: CatalogEndpoint[] = [...entry.endpoints];
  const walk = (folders: CatalogEntry['folders']) => {
    for (const f of folders) {
      eps.push(...f.endpoints);
      walk(f.folders);
    }
  };
  walk(entry.folders);
  return eps;
}

function endpointKey(ep: CatalogEndpoint): string {
  return `${ep.method} ${ep.path}`;
}

function diffEndpointDetails(oldEp: CatalogEndpoint, newEp: CatalogEndpoint): string[] {
  const details: string[] = [];

  if (oldEp.summary !== newEp.summary) details.push('Summary changed');
  if (oldEp.description !== newEp.description) details.push('Description changed');
  if (oldEp.deprecated !== newEp.deprecated) {
    details.push(newEp.deprecated ? 'Marked as deprecated' : 'No longer deprecated');
  }

  const oldParamKeys = new Set(oldEp.parameters.map(p => `${p.in}:${p.name}`));
  const newParamKeys = new Set(newEp.parameters.map(p => `${p.in}:${p.name}`));
  const addedParams = newEp.parameters.filter(p => !oldParamKeys.has(`${p.in}:${p.name}`));
  const removedParams = oldEp.parameters.filter(p => !newParamKeys.has(`${p.in}:${p.name}`));
  if (addedParams.length > 0) details.push(`Added parameters: ${addedParams.map(p => p.name).join(', ')}`);
  if (removedParams.length > 0) details.push(`Removed parameters: ${removedParams.map(p => p.name).join(', ')}`);

  for (const newP of newEp.parameters) {
    const oldP = oldEp.parameters.find(p => p.in === newP.in && p.name === newP.name);
    if (!oldP) continue;
    if (oldP.required !== newP.required) details.push(`Parameter "${newP.name}" required: ${oldP.required} → ${newP.required}`);
    if (JSON.stringify(oldP.schema) !== JSON.stringify(newP.schema)) details.push(`Parameter "${newP.name}" schema changed`);
  }

  const oldHasBody = !!oldEp.requestBody;
  const newHasBody = !!newEp.requestBody;
  if (!oldHasBody && newHasBody) details.push('Request body added');
  if (oldHasBody && !newHasBody) details.push('Request body removed');
  if (oldHasBody && newHasBody) {
    const oldCTs = oldEp.requestBody!.contentTypes.map(ct => ct.mediaType).sort();
    const newCTs = newEp.requestBody!.contentTypes.map(ct => ct.mediaType).sort();
    if (JSON.stringify(oldCTs) !== JSON.stringify(newCTs)) details.push('Request body content types changed');
    if (oldEp.requestBody!.required !== newEp.requestBody!.required) details.push('Request body required changed');
  }

  const oldRespCodes = new Set(oldEp.responses.map(r => r.statusCode));
  const newRespCodes = new Set(newEp.responses.map(r => r.statusCode));
  const addedResp = newEp.responses.filter(r => !oldRespCodes.has(r.statusCode));
  const removedResp = oldEp.responses.filter(r => !newRespCodes.has(r.statusCode));
  if (addedResp.length > 0) details.push(`Added response codes: ${addedResp.map(r => r.statusCode).join(', ')}`);
  if (removedResp.length > 0) details.push(`Removed response codes: ${removedResp.map(r => r.statusCode).join(', ')}`);

  if (JSON.stringify(oldEp.security) !== JSON.stringify(newEp.security)) details.push('Security requirements changed');

  return details;
}

export function diffCatalogEntries(
  oldEntry: CatalogEntry,
  newEntry: CatalogEntry,
  fromVersion: string,
  toVersion: string,
): CatalogSpecDiff {
  const oldEps = collectEndpoints(oldEntry);
  const newEps = collectEndpoints(newEntry);

  const oldMap = new Map(oldEps.map(ep => [endpointKey(ep), ep]));
  const newMap = new Map(newEps.map(ep => [endpointKey(ep), ep]));

  const added: EndpointDiff[] = [];
  const removed: EndpointDiff[] = [];
  const changed: EndpointDiff[] = [];

  for (const [key, newEp] of newMap) {
    const oldEp = oldMap.get(key);
    if (!oldEp) {
      added.push({ method: newEp.method, path: newEp.path, changeType: 'added' });
    } else {
      const details = diffEndpointDetails(oldEp, newEp);
      if (details.length > 0) {
        changed.push({ method: newEp.method, path: newEp.path, changeType: 'changed', details });
      }
    }
  }

  for (const [key, oldEp] of oldMap) {
    if (!newMap.has(key)) {
      removed.push({ method: oldEp.method, path: oldEp.path, changeType: 'removed' });
    }
  }

  return {
    fromVersion,
    toVersion,
    added,
    removed,
    changed,
    summary: {
      totalAdded: added.length,
      totalRemoved: removed.length,
      totalChanged: changed.length,
    },
  };
}
