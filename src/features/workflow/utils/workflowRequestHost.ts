import type { Environment, Microservice, RequestCollection, RequestFolder, RequestItem } from '../../../shared/types';
import { findAncestorSubCollection } from '../../requests/utils/requestTree';
import { resolveBaseUrl, type UrlResolverContext } from '../../requests/utils/requestUrlResolver';
import { stripTrailingSlash } from './workflowHostResolve';

function buildResolvedColBaseUrls(
  collection: RequestCollection,
  appMicroservices: Microservice[],
  wbEnvironments: Environment[],
): Record<string, string> {
  const linkedSvc = collection.microserviceId
    ? appMicroservices.find((s) => s.id === collection.microserviceId)
    : undefined;
  if (linkedSvc) {
    const allSvcEnvs = [...wbEnvironments, ...(linkedSvc.customEnvs ?? [])];
    const mapped: Record<string, string> = {};
    for (const [appEnvId, url] of Object.entries(linkedSvc.baseUrls)) {
      const appEnv = allSvcEnvs.find((e) => e.id === appEnvId);
      if (!appEnv) continue;
      const wbEnv = wbEnvironments.find((e) => e.name === appEnv.name);
      if (wbEnv) mapped[wbEnv.id] = url;
    }
    return mapped;
  }
  return collection.baseUrls ?? {};
}

function computeSubColEnvId(parentSub: RequestFolder, wbEnvironments: Environment[]): string | undefined {
  if (parentSub.selectedEnvId) return parentSub.selectedEnvId;
  const matched = wbEnvironments.find((e) => e.name.toLowerCase() === parentSub.name.toLowerCase());
  return matched?.id;
}

export interface WorkflowRequestHostResolution {
  /** Subcollection / custom base not matching a single microservice row in Environments. */
  hostBaseUrl?: string;
  hostMicroserviceId?: string;
  hostEnvironmentId?: string;
}

function matchMicroserviceBase(
  targetNorm: string,
  microservices: Microservice[],
  wbEnvironments: Environment[],
): Pick<WorkflowRequestHostResolution, 'hostMicroserviceId' | 'hostEnvironmentId'> | null {
  for (const svc of microservices) {
    for (const env of wbEnvironments) {
      const u = stripTrailingSlash(svc.baseUrls[env.id] ?? '');
      if (u && u === targetNorm) {
        return { hostMicroserviceId: svc.id, hostEnvironmentId: env.id };
      }
    }
  }
  return null;
}

/**
 * When folder metadata is missing or ambiguous, infer host from a stored absolute URL (common for
 * multi-env requests that keep a full `https://…` in the item).
 */
function hostResolutionFromAbsoluteRequestUrl(
  req: RequestItem,
  harnessBaseUrl: string,
  microservices: Microservice[],
  wbEnvironments: Environment[],
): WorkflowRequestHostResolution | null {
  const raw = req.url?.trim() ?? '';
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return null;
  let origin: string;
  try {
    origin = new URL(raw).origin;
  } catch {
    return null;
  }
  const originNorm = stripTrailingSlash(origin);
  const harnessNorm = stripTrailingSlash(harnessBaseUrl);
  if (originNorm === harnessNorm) return {};

  const matched = matchMicroserviceBase(originNorm, microservices, wbEnvironments);
  if (matched) return matched;
  return { hostBaseUrl: originNorm };
}

/**
 * Same host resolution as the Requests editor: subcollection `baseUrls`, collection `baseUrls`,
 * or linked microservice — so Quick Test uses the correct base for URL-collection requests.
 */
export function resolveQuickTestHostForRequest(
  collection: RequestCollection,
  req: RequestItem,
  harnessEnvId: string,
  harnessBaseUrl: string,
  microservices: Microservice[],
  wbEnvironments: Environment[],
): WorkflowRequestHostResolution {
  const parentSub = findAncestorSubCollection(collection.folders ?? [], req.id);
  const resolvedColBaseUrls = buildResolvedColBaseUrls(collection, microservices, wbEnvironments);
  const subColEnvId = parentSub ? computeSubColEnvId(parentSub, wbEnvironments) : undefined;

  const urlCtx: UrlResolverContext = {
    collectionMode: collection.mode,
    resolvedColBaseUrls,
    parentSubCollection: parentSub ?? undefined,
    subColEnvId,
    selectedEnvId: harnessEnvId,
  };

  const resolved = resolveBaseUrl(urlCtx);
  const harnessNorm = stripTrailingSlash(harnessBaseUrl);
  const resolvedNorm = resolved ? stripTrailingSlash(resolved) : '';

  if (!resolvedNorm) {
    if (collection.microserviceId && harnessEnvId) {
      const fromUrl = hostResolutionFromAbsoluteRequestUrl(req, harnessBaseUrl, microservices, wbEnvironments);
      if (fromUrl && Object.keys(fromUrl).length > 0) return fromUrl;
      return { hostMicroserviceId: collection.microserviceId, hostEnvironmentId: harnessEnvId };
    }
    const fromUrlOnly = hostResolutionFromAbsoluteRequestUrl(req, harnessBaseUrl, microservices, wbEnvironments);
    return fromUrlOnly ?? {};
  }

  if (resolvedNorm === harnessNorm) {
    const fromUrl = hostResolutionFromAbsoluteRequestUrl(req, harnessBaseUrl, microservices, wbEnvironments);
    if (fromUrl && Object.keys(fromUrl).length > 0) return fromUrl;
    return {};
  }

  const matched = matchMicroserviceBase(resolvedNorm, microservices, wbEnvironments);
  if (matched) return matched;

  return { hostBaseUrl: resolvedNorm };
}
