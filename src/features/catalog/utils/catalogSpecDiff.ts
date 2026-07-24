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

  if (oldEp.summary !== newEp.summary) {
    details.push(`Summary: "${oldEp.summary || '(none)'}" → "${newEp.summary || '(none)'}"`);
  }
  if (oldEp.description !== newEp.description) details.push('Description changed');
  if (oldEp.deprecated !== newEp.deprecated) {
    details.push(newEp.deprecated ? 'Marked as deprecated' : 'No longer deprecated');
  }

  const oldParamKeys = new Set(oldEp.parameters.map(p => `${p.in}:${p.name}`));
  const newParamKeys = new Set(newEp.parameters.map(p => `${p.in}:${p.name}`));
  const addedParams = newEp.parameters.filter(p => !oldParamKeys.has(`${p.in}:${p.name}`));
  const removedParams = oldEp.parameters.filter(p => !newParamKeys.has(`${p.in}:${p.name}`));
  if (addedParams.length > 0) details.push(`Added parameters: ${addedParams.map(p => `${p.name} (${p.in})`).join(', ')}`);
  if (removedParams.length > 0) details.push(`Removed parameters: ${removedParams.map(p => `${p.name} (${p.in})`).join(', ')}`);

  for (const newP of newEp.parameters) {
    const oldP = oldEp.parameters.find(p => p.in === newP.in && p.name === newP.name);
    if (!oldP) continue;
    if (oldP.required !== newP.required) details.push(`Parameter "${newP.name}" required: ${oldP.required} → ${newP.required}`);
    if (JSON.stringify(oldP.schema) !== JSON.stringify(newP.schema)) {
      const oldType = oldP.schema?.type || 'unknown';
      const newType = newP.schema?.type || 'unknown';
      if (oldType !== newType) {
        details.push(`Parameter "${newP.name}" type: ${oldType} → ${newType}`);
      } else {
        details.push(`Parameter "${newP.name}" schema changed`);
      }
    }
  }

  const oldHasBody = !!oldEp.requestBody;
  const newHasBody = !!newEp.requestBody;
  if (!oldHasBody && newHasBody) {
    const cts = newEp.requestBody!.contentTypes.map(ct => ct.mediaType);
    details.push(`Request body added (${cts.join(', ')})`);
  }
  if (oldHasBody && !newHasBody) details.push('Request body removed');
  if (oldHasBody && newHasBody) {
    const oldCTs = oldEp.requestBody!.contentTypes.map(ct => ct.mediaType).sort();
    const newCTs = newEp.requestBody!.contentTypes.map(ct => ct.mediaType).sort();
    if (JSON.stringify(oldCTs) !== JSON.stringify(newCTs)) {
      const addedCTs = newCTs.filter(ct => !oldCTs.includes(ct));
      const removedCTs = oldCTs.filter(ct => !newCTs.includes(ct));
      const parts: string[] = [];
      if (removedCTs.length > 0) parts.push(`removed: ${removedCTs.join(', ')}`);
      if (addedCTs.length > 0) parts.push(`added: ${addedCTs.join(', ')}`);
      details.push(`Request body content types changed (${parts.join('; ')})`);
      if (oldCTs.length > 0 && newCTs.length > 0) {
        details.push(`  Before: ${oldCTs.join(', ')}`);
        details.push(`  After: ${newCTs.join(', ')}`);
      }
    }
    if (oldEp.requestBody!.required !== newEp.requestBody!.required) {
      details.push(`Request body required: ${oldEp.requestBody!.required} → ${newEp.requestBody!.required}`);
    }

    for (const newCT of newEp.requestBody!.contentTypes) {
      const oldCT = oldEp.requestBody!.contentTypes.find(ct => ct.mediaType === newCT.mediaType);
      if (!oldCT) continue;
      if (JSON.stringify(oldCT.schema) !== JSON.stringify(newCT.schema)) {
        const oldProps = Object.keys(oldCT.schema?.properties || {});
        const newProps = Object.keys(newCT.schema?.properties || {});
        const addedProps = newProps.filter(p => !oldProps.includes(p));
        const removedProps = oldProps.filter(p => !newProps.includes(p));
        if (addedProps.length > 0 || removedProps.length > 0) {
          if (addedProps.length > 0) details.push(`  ${newCT.mediaType}: added fields: ${addedProps.join(', ')}`);
          if (removedProps.length > 0) details.push(`  ${newCT.mediaType}: removed fields: ${removedProps.join(', ')}`);
        } else {
          details.push(`  ${newCT.mediaType}: body schema changed`);
        }
      }
    }
  }

  const oldRespCodes = new Set(oldEp.responses.map(r => r.statusCode));
  const newRespCodes = new Set(newEp.responses.map(r => r.statusCode));
  const addedResp = newEp.responses.filter(r => !oldRespCodes.has(r.statusCode));
  const removedResp = oldEp.responses.filter(r => !newRespCodes.has(r.statusCode));
  if (addedResp.length > 0) details.push(`Added response codes: ${addedResp.map(r => `${r.statusCode} (${r.description || 'no description'})`).join(', ')}`);
  if (removedResp.length > 0) details.push(`Removed response codes: ${removedResp.map(r => `${r.statusCode} (${r.description || 'no description'})`).join(', ')}`);

  for (const newR of newEp.responses) {
    const oldR = oldEp.responses.find(r => r.statusCode === newR.statusCode);
    if (!oldR) continue;
    if (oldR.description !== newR.description) {
      details.push(`Response ${newR.statusCode} description: "${oldR.description || ''}" → "${newR.description || ''}"`);
    }
  }

  if (JSON.stringify(oldEp.security) !== JSON.stringify(newEp.security)) {
    const oldSec = oldEp.security?.join(', ') || '(none)';
    const newSec = newEp.security?.join(', ') || '(none)';
    details.push(`Security: ${oldSec} → ${newSec}`);
  }

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

  const metadata: string[] = [];
  if (oldEntry.name !== newEntry.name) {
    metadata.push(`Title: "${oldEntry.name}" → "${newEntry.name}"`);
  }
  if (oldEntry.description !== newEntry.description) {
    metadata.push('API description changed');
  }
  const oldServerUrls = oldEntry.servers.map(s => s.url).sort().join(', ');
  const newServerUrls = newEntry.servers.map(s => s.url).sort().join(', ');
  if (oldServerUrls !== newServerUrls) {
    metadata.push(`Servers: ${oldEntry.servers.map(s => s.url).join(', ') || '(none)'} → ${newEntry.servers.map(s => s.url).join(', ') || '(none)'}`);
  }
  const oldSecSchemes = Object.keys(oldEntry.securitySchemes).sort().join(', ');
  const newSecSchemes = Object.keys(newEntry.securitySchemes).sort().join(', ');
  if (oldSecSchemes !== newSecSchemes) {
    metadata.push(`Security schemes: ${oldSecSchemes || '(none)'} → ${newSecSchemes || '(none)'}`);
  }

  return {
    fromVersion,
    toVersion,
    added,
    removed,
    changed,
    metadata: metadata.length > 0 ? metadata : undefined,
    summary: {
      totalAdded: added.length,
      totalRemoved: removed.length,
      totalChanged: changed.length,
    },
  };
}
