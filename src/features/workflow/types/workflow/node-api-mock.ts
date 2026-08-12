// ── API Mock workflow node data types (Phase 11) ────

export interface ApiMockStartNodeData {
  [key: string]: unknown;
  label: string;
  serverId?: string;
  definitionSource?: 'workspace' | 'file';
  definitionFile?: string;
  portOverride?: number;
}

export interface ApiMockApplyNodeData {
  [key: string]: unknown;
  label: string;
  serverId: string;
}

export interface ApiMockResetStateNodeData {
  [key: string]: unknown;
  label: string;
  serverId: string;
}

export interface ApiMockStopNodeData {
  [key: string]: unknown;
  label: string;
  serverId: string;
}

export interface ApiMockAssertCallsNodeData {
  [key: string]: unknown;
  label: string;
  serverId: string;
  routeId?: string;
  expectedCount?: number;
  expectedMinCount?: number;
  expectedMaxCount?: number;
  expectedStatus?: number;
  expectedBodyContains?: string;
  expectedHeaderKey?: string;
  expectedHeaderValue?: string;
}
