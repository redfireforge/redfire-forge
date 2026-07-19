import type { AuthConfig, BodyType, KeyValue } from './index';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CatalogRequestMeta {
  catalogEntryId?: string;
  catalogEndpointId?: string;
  catalogVersion?: string;
  operationId?: string;
  description?: string;
  originalPath: string;
  tags: string[];
  deprecated?: boolean;
  parameters?: {
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    required: boolean;
    description?: string;
    type?: string;
  }[];
  expectedResponses?: {
    statusCode: string;
    description: string;
  }[];
  security?: string[];
  sourceSpec?: string;
}

/** Snapshot of a request definition at a point in time. */
export interface RequestDefinitionSnapshot {
  name: string;
  url: string;
  method: HttpMethod;
  headers: KeyValue[];
  body: string;
  bodyType?: BodyType;
  bodyForm?: KeyValue[];
  auth: AuthConfig;
}

export interface RequestDefinitionVersion {
  id: string;
  timestamp: number;
  label?: string;
  changeSummary?: string;
  snapshot: RequestDefinitionSnapshot;
}

/** Snapshot of a request as it was when exported from a specific spec version. */
export interface SpecVersion {
  id: string;
  catalogVersion: string;
  catalogEntryId: string;
  catalogEndpointId: string;
  importedAt: number;
  url: string;
  method: HttpMethod;
  headers: KeyValue[];
  body: string;
  bodyType?: BodyType;
  bodyForm?: KeyValue[];
  savedQueryParams?: { key: string; value: string; enabled: boolean; description?: string }[];
  savedPathParams?: { key: string; value: string; description?: string; required?: boolean }[];
}

export interface RequestItem {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body: string;
  bodyType?: BodyType;
  bodyForm?: KeyValue[];
  auth: AuthConfig;
  savedQueryParams?: { key: string; value: string; enabled: boolean; description?: string }[];
  savedPathParams?: { key: string; value: string; description?: string; required?: boolean }[];
  catalogMeta?: CatalogRequestMeta;
  definitionVersions?: RequestDefinitionVersion[];
  specVersions?: SpecVersion[];
  activeSpecVersionId?: string;
  promotedToHarness?: boolean;
}

export interface RequestFolder {
  id: string;
  name: string;
  requests: RequestItem[];
  folders?: RequestFolder[];
  isSubCollection?: boolean;
  auth?: AuthConfig;
  baseUrls?: Record<string, string>;
  selectedEnvId?: string;
}

export interface RequestCollection {
  id: string;
  name: string;
  mode: 'direct' | 'multi-env' | 'group';
  groupId?: string;
  microserviceId?: string;
  baseUrls?: Record<string, string>;
  auth?: AuthConfig;
  authPerEnv?: Record<string, AuthConfig>;
  requests: RequestItem[];
  folders?: RequestFolder[];
}

export interface RequestEnv {
  id: string;
  name: string;
}

export interface RequestsData {
  /** @deprecated Legacy env registry — only present in pre-migration persisted data. Emptied by reconcileRequestsEnvKeys. */
  environments?: RequestEnv[];
  collections: RequestCollection[];
  selectedEnvId?: string;
  selectedCollectionId?: string;
  selectedRequestId?: string;
}

// ─── Multi-Tab Types ──────────────────────────────────────────────
export type RequestSubTab = 'params' | 'body' | 'auth' | 'headers' | 'history';
export type ResponseSubTab = 'preview' | 'headers' | 'console';
export type RequestInputMode = 'builder' | 'curlImport' | 'curlExport';

export interface RequestTab {
  id: string;
  collectionId: string;
  requestId: string;
  label: string;
  labelManual?: boolean;
  activeSubTab: RequestSubTab;
  responseSubTab: ResponseSubTab;
  inputMode: RequestInputMode;
  envId?: string;
  activeHistoryId?: string | null;
}

export const REQUEST_MAX_TABS = 50;
