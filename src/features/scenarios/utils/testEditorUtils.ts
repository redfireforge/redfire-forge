import { v4 as uuidv4 } from 'uuid';
import type { KeyValue, Scenario, ScenarioActionType } from '../../../shared/types';
import { isWsActionType } from '../../../shared/types';
import {
  getBaseUrl as getBaseUrlShared,
  parseQueryParamsPreserveTemplates,
  rebuildUrl as rebuildUrlShared,
} from '../../../shared/utils/queryParams';
import {
  createDefaultWsConnectAction,
  createDefaultWsSendAction,
  createDefaultWsReceiveAction,
} from '../../../shared/utils/wsScenarioDefaults';
import { makeDefaultGrpcHarnessCallAction } from '../../../shared/utils/grpcHarnessScenarioContracts';

export const emptyTest = (actionType?: ScenarioActionType): Scenario => {
  const base: Scenario = {
    id: uuidv4(),
    name: '',
    url: '',
    method: 'GET',
    headers: [{ key: '', value: '' }],
    body: '',
    bodyType: 'none',
    bodyForm: [{ key: '', value: '' }],
    auth: { type: 'inherit' },
    validation: { mode: 'none', expectedFields: [] },
  };

  if (!actionType || actionType === 'http') return base;

  if (actionType === 'kafkaProduce' || actionType === 'kafkaConsume') {
    return { ...base, actionType, method: 'KAFKA' };
  }

  if (isWsActionType(actionType)) {
    const ws: Partial<Scenario> = { actionType, method: 'WEBSOCKET' };
    if (actionType === 'wsConnect') ws.wsConnectAction = createDefaultWsConnectAction();
    else if (actionType === 'wsSend') ws.wsSendAction = createDefaultWsSendAction();
    else if (actionType === 'wsReceive') ws.wsReceiveAction = createDefaultWsReceiveAction();
    return { ...base, ...ws };
  }

  if (actionType === 'grpcCall') {
    return {
      ...base,
      actionType,
      method: 'GRPC',
      grpcCallAction: makeDefaultGrpcHarnessCallAction(),
    };
  }

  return base;
};

import { canonicalize } from '../../../shared/utils/canonicalize';
export { canonicalize };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripPaths(obj: any, paths: string[]): any {
  if (!paths.length || obj === null || obj === undefined || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const p of paths) {
    const segments = p.replace(/^\$\.?/, '').split('.').filter(Boolean);
    if (!segments.length) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cursor: any = clone;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const bracketMatch = seg.match(/^(.+)\[(\d+)\]$/);
      if (bracketMatch) {
        cursor = cursor?.[bracketMatch[1]];
        cursor = Array.isArray(cursor) ? (cursor = [...cursor]) : cursor;
        cursor = cursor?.[Number(bracketMatch[2])];
      } else {
        if (cursor && typeof cursor === 'object' && !Array.isArray(cursor)) cursor[seg] = { ...cursor[seg] };
        cursor = cursor?.[seg];
      }
      if (!cursor || typeof cursor !== 'object') break;
    }
    if (cursor && typeof cursor === 'object') {
      const last = segments[segments.length - 1];
      delete cursor[last];
    }
  }
  return clone;
}

export function jsonEqual(a: string, b: string, excludedPaths?: string[]): boolean {
  try {
    let objA = JSON.parse(a);
    let objB = JSON.parse(b);
    if (excludedPaths?.length) {
      objA = stripPaths(objA, excludedPaths);
      objB = stripPaths(objB, excludedPaths);
    }
    return JSON.stringify(canonicalize(objA)) === JSON.stringify(canonicalize(objB));
  } catch {
    return a === b;
  }
}

export function parseQueryParams(url: string): KeyValue[] {
  const params = parseQueryParamsPreserveTemplates(url);
  return params.length > 0 ? params : [{ key: '', value: '' }];
}

export function rebuildUrl(url: string, params: KeyValue[]): string {
  return rebuildUrlShared(url, params);
}

export const getBaseUrl = getBaseUrlShared;

// unwrapImport and pickJsonFile moved to scenarioImportExport.ts — import from there
export { unwrapImport, pickJsonFile } from './scenarioImportExport';
