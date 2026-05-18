import { v4 as uuidv4 } from 'uuid';
import type {
  AuthConfig,
  Environment,
  GlobalAuthProfile,
  Microservice,
  RequestCollection,
  RequestEnv,
  RequestFolder,
  RequestItem,
  Scenario,
  ValidationConfig,
} from '../../../shared/types';
import { resolveBaseUrl } from './requestUrlResolver';
import type { UrlResolverContext } from './requestUrlResolver';

export interface PromotionContext {
  collection: RequestCollection;
  folderId?: string;
  selectedEnvId?: string;
  environments: RequestEnv[];
  globalAuthProfiles: GlobalAuthProfile[];
  microservices: Microservice[];
  appEnvironments?: Environment[];
}

export interface PromotionOptions {
  validationPreset?: 'none' | 'status-200';
  authMode?: 'concrete' | 'inherit';
  openEditorAfter?: boolean;
}

/**
 * Resolve auth from the Requests inheritance chain:
 *   Request → Parent Folder → Per-Env → Collection → Microservice Global Profile → none
 *
 * Extracted from RequestEditor.resolveEffectiveAuth as a pure function.
 */
export function resolveRequestAuth(
  request: Pick<RequestItem, 'auth'>,
  collection: Pick<RequestCollection, 'auth' | 'authPerEnv' | 'microserviceId'>,
  parentFolder: Pick<RequestFolder, 'auth'> | undefined,
  envId: string | undefined,
  microservices: Pick<Microservice, 'id' | 'authProfileIds'>[],
  globalAuthProfiles: Pick<GlobalAuthProfile, 'id' | 'auth'>[],
  requestEnvs: Pick<RequestEnv, 'id' | 'name'>[],
  appEnvironments?: Pick<Environment, 'id' | 'name'>[],
): AuthConfig {
  if (request.auth?.type !== 'none' && request.auth?.type !== 'inherit') {
    return request.auth;
  }

  if (parentFolder?.auth?.type && parentFolder.auth.type !== 'none' && parentFolder.auth.type !== 'inherit') {
    return parentFolder.auth;
  }

  if (envId && collection.authPerEnv?.[envId]) {
    const envAuth = collection.authPerEnv[envId];
    if (envAuth.type && envAuth.type !== 'none') return envAuth;
  }

  if (collection.auth?.type && collection.auth.type !== 'none') {
    return collection.auth;
  }

  const linkedSvc = collection.microserviceId
    ? microservices.find(s => s.id === collection.microserviceId)
    : undefined;

  if (linkedSvc?.authProfileIds && envId) {
    const wbEnv = requestEnvs.find(e => e.id === envId);
    const appEnv = wbEnv ? appEnvironments?.find(ae => ae.name === wbEnv.name) : undefined;
    const lookupId = appEnv?.id ?? envId;
    const profileId = linkedSvc.authProfileIds[lookupId];
    if (profileId) {
      const profile = globalAuthProfiles.find(p => p.id === profileId);
      if (profile) return { ...profile.auth, globalProfileId: profile.id };
    }
  }

  return { type: 'none' };
}

function findParentFolder(
  folders: RequestFolder[] | undefined,
  targetFolderId: string,
): RequestFolder | undefined {
  if (!folders) return undefined;
  for (const f of folders) {
    if (f.id === targetFolderId) return f;
    const nested = findParentFolder(f.folders, targetFolderId);
    if (nested) return nested;
  }
  return undefined;
}

function resolveAbsoluteUrl(
  request: RequestItem,
  collection: RequestCollection,
  parentFolder: RequestFolder | undefined,
  selectedEnvId: string | undefined,
): string {
  const url = request.url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return bakeQueryParams(url, request.savedQueryParams);
  }

  const ctx: UrlResolverContext = {
    collectionMode: collection.mode,
    resolvedColBaseUrls: collection.baseUrls ?? {},
    parentSubCollection: parentFolder?.isSubCollection ? parentFolder : undefined,
    subColEnvId: parentFolder?.selectedEnvId,
    selectedEnvId,
  };

  let base = resolveBaseUrl(ctx);

  if (!base) {
    const subUrls = parentFolder?.isSubCollection ? parentFolder.baseUrls : undefined;
    const fallbackMap = subUrls ?? collection.baseUrls;
    if (fallbackMap) {
      const first = Object.values(fallbackMap)[0];
      if (first) base = first.replace(/\/+$/, '');
    }
  }

  const path = url.startsWith('/') ? url : `/${url}`;
  const absolute = base ? `${base}${path}` : url;
  return bakeQueryParams(absolute, request.savedQueryParams);
}

function bakeQueryParams(
  url: string,
  params?: { key: string; value: string; enabled: boolean }[],
): string {
  if (!params) return url;
  const enabled = params.filter(p => p.enabled && p.key.trim());
  if (enabled.length === 0) return url;

  const baseUrl = url.split('?')[0];
  const qs = enabled.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
  return `${baseUrl}?${qs}`;
}

function resolvePathParams(url: string, params?: { key: string; value: string }[]): string {
  if (!params) return url;
  let resolved = url;
  for (const p of params) {
    if (p.value) {
      resolved = resolved.replace(`{${p.key}}`, encodeURIComponent(p.value));
    }
  }
  return resolved;
}

function resolveMicroserviceBaseUrl(
  collection: RequestCollection,
  microservices: Pick<Microservice, 'id' | 'baseUrls'>[],
  selectedEnvId: string | undefined,
  appEnvironments?: Pick<Environment, 'id' | 'name'>[],
): string | null {
  if (!collection.microserviceId) return null;
  const svc = microservices.find(s => s.id === collection.microserviceId);
  if (!svc?.baseUrls) return null;

  if (selectedEnvId && svc.baseUrls[selectedEnvId]) {
    return svc.baseUrls[selectedEnvId].replace(/\/+$/, '');
  }

  if (selectedEnvId && appEnvironments) {
    const appEnv = appEnvironments.find(e => e.id === selectedEnvId);
    if (appEnv) {
      for (const [envId, url] of Object.entries(svc.baseUrls)) {
        const matchEnv = appEnvironments.find(e => e.id === envId);
        if (matchEnv?.name === appEnv.name && url) {
          return url.replace(/\/+$/, '');
        }
      }
    }
  }

  const first = Object.values(svc.baseUrls).find(u => u);
  return first ? first.replace(/\/+$/, '') : null;
}

function buildValidation(preset?: 'none' | 'status-200'): ValidationConfig {
  if (preset === 'status-200') {
    return {
      mode: 'selective',
      assertions: [{ type: 'status', expected: '200' }],
    };
  }
  return { mode: 'none' };
}

/**
 * Convert a RequestItem into a standalone Scenario for Harness promotion.
 * One-time snapshot — no live link back to the request.
 */
export function createScenarioFromRequest(
  request: RequestItem,
  context: PromotionContext,
  options?: PromotionOptions,
): Scenario {
  const parentFolder = context.folderId
    ? findParentFolder(context.collection.folders, context.folderId)
    : undefined;

  const authMode = options?.authMode ?? 'concrete';

  const auth: AuthConfig = authMode === 'inherit'
    ? { type: 'inherit' }
    : resolveRequestAuth(
        request,
        context.collection,
        parentFolder,
        context.selectedEnvId,
        context.microservices,
        context.globalAuthProfiles,
        context.environments,
        context.appEnvironments,
      );

  let resolvedUrl = resolveAbsoluteUrl(
    request,
    context.collection,
    parentFolder,
    context.selectedEnvId,
  );

  if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://')) {
    const svcBase = resolveMicroserviceBaseUrl(
      context.collection, context.microservices, context.selectedEnvId, context.appEnvironments,
    );
    if (svcBase) {
      const path = resolvedUrl.startsWith('/') ? resolvedUrl : `/${resolvedUrl}`;
      resolvedUrl = `${svcBase}${path}`;
    }
  }

  resolvedUrl = resolvePathParams(resolvedUrl, request.savedPathParams);

  const activeVersion = request.specVersions?.find(v => v.id === request.activeSpecVersionId);
  const versionLabel = activeVersion?.catalogVersion;

  return {
    id: uuidv4(),
    name: request.name,
    url: resolvedUrl,
    method: request.method as Scenario['method'],
    headers: request.headers ? [...request.headers] : [],
    body: request.body ?? '',
    bodyType: request.bodyType,
    bodyForm: request.bodyForm ? [...request.bodyForm] : undefined,
    auth,
    validation: buildValidation(options?.validationPreset),
    sourceRequestId: request.id,
    sourceSpecVersionId: request.activeSpecVersionId,
    sourceSpecVersionLabel: versionLabel,
  };
}
