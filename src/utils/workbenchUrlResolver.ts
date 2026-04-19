import type { WorkbenchCollection, WorkbenchFolder } from '../types';

export interface UrlResolverContext {
  collectionMode: WorkbenchCollection['mode'];
  resolvedColBaseUrls: Record<string, string>;
  parentSubCollection?: Pick<WorkbenchFolder, 'baseUrls'>;
  subColEnvId?: string;
  selectedEnvId?: string;
}

export function resolveBaseUrl(ctx: UrlResolverContext): string | null {
  const envId = ctx.subColEnvId || ctx.selectedEnvId;

  if (ctx.parentSubCollection?.baseUrls) {
    const subBaseUrls = ctx.parentSubCollection.baseUrls;
    if (envId && subBaseUrls[envId]) {
      return subBaseUrls[envId].replace(/\/+$/, '');
    }
    const firstBase = Object.values(subBaseUrls)[0];
    if (firstBase) return firstBase.replace(/\/+$/, '');
  }

  if (envId && ctx.resolvedColBaseUrls[envId]) {
    return ctx.resolvedColBaseUrls[envId].replace(/\/+$/, '');
  }

  return null;
}

export function buildDisplayUrl(relativePath: string, ctx: UrlResolverContext): string {
  if (ctx.collectionMode === 'direct') return relativePath;
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) return relativePath;

  const base = resolveBaseUrl(ctx);
  if (!base) return relativePath;

  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${base}${path}`;
}

export function resolveFullSendUrl(
  relativeUrl: string,
  ctx: UrlResolverContext,
): { url: string; error?: string } {
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return { url: relativeUrl };
  }

  const base = resolveBaseUrl(ctx);
  if (base) {
    const path = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
    return { url: `${base}${path}` };
  }

  const error = ctx.collectionMode === 'multi-env'
    ? 'Cannot send: no base URL configured for the selected environment. Edit collection settings to add hostnames.'
    : 'Cannot send: URL must be a full URL (e.g. https://api.example.com/...).';
  return { url: relativeUrl, error };
}
