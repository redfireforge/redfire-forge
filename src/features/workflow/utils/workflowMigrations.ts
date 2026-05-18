import { v4 as uuidv4 } from 'uuid';
import type { Workflow, HttpNodeData, WorkflowHostProfile, WorkflowAuthProfile, WorkflowService, WorkflowServiceUrlMode, ServiceEndpoint, WorkflowNode } from '../types/workflow';
import type { AuthConfig } from '../../../shared/types';

// ── v1 → v2: Inline host/auth fields → hostProfiles / authProfiles ──

function migrateV1ToV2(wf: Workflow): Workflow {
  const base: Workflow = {
    ...wf,
    hostProfiles: wf.hostProfiles ?? [],
    authProfiles: wf.authProfiles ?? [],
  };

  if ((wf.schemaVersion ?? 1) >= 2) {
    return base;
  }

  const hostProfiles = [...(base.hostProfiles ?? [])];
  const authProfiles = [...(base.authProfiles ?? [])];

  const hostByKey = new Map<string, string>();
  for (const hp of hostProfiles) {
    const key = JSON.stringify({
      hostBaseUrl: hp.hostBaseUrl?.trim() || '',
      hostEnvironmentId: hp.hostEnvironmentId || '',
      hostMicroserviceId: hp.hostMicroserviceId || '',
    });
    hostByKey.set(key, hp.id);
  }

  const authByKey = new Map<string, string>();
  for (const ap of authProfiles) {
    authByKey.set(JSON.stringify(ap.auth), ap.id);
  }

  const migratedNodes = base.nodes.map((node) => {
    if (node.type !== 'http') return node;
    const data = { ...(node.data as HttpNodeData) };

    if (!data.hostProfileId && (data.hostBaseUrl || (data.hostEnvironmentId && data.hostMicroserviceId))) {
      const key = JSON.stringify({
        hostBaseUrl: data.hostBaseUrl?.trim() || '',
        hostEnvironmentId: data.hostEnvironmentId || '',
        hostMicroserviceId: data.hostMicroserviceId || '',
      });
      let hostProfileId = hostByKey.get(key);
      if (!hostProfileId) {
        hostProfileId = `host_${uuidv4()}`;
        const profile: WorkflowHostProfile = {
          id: hostProfileId,
          name: data.label ? `${data.label} host` : `Host ${hostProfiles.length + 1}`,
          hostBaseUrl: data.hostBaseUrl,
          hostEnvironmentId: data.hostEnvironmentId,
          hostMicroserviceId: data.hostMicroserviceId,
        };
        hostProfiles.push(profile);
        hostByKey.set(key, hostProfileId);
      }
      data.hostProfileId = hostProfileId;
    }

    if (!data.authProfileId) {
      const auth = data.scenario?.auth;
      if (auth && auth.type !== 'none' && auth.type !== 'inherit') {
        const key = JSON.stringify(auth);
        let authProfileId = authByKey.get(key);
        if (!authProfileId) {
          authProfileId = `auth_${uuidv4()}`;
          const profile: WorkflowAuthProfile = {
            id: authProfileId,
            name: data.label ? `${data.label} auth` : `Auth ${authProfiles.length + 1}`,
            auth,
          };
          authProfiles.push(profile);
          authByKey.set(key, authProfileId);
        }
        data.authProfileId = authProfileId;
      }
    }

    return { ...node, data };
  });

  return {
    ...base,
    nodes: migratedNodes,
    hostProfiles,
    authProfiles,
    schemaVersion: 2,
  };
}

// ── v2 → v3: hostProfiles + authProfiles → services[] / serviceId ──

/**
 * Try to extract protocol + host from a URL string.
 * Returns null for relative URLs, template-only URLs, or unparseable strings.
 */
export function extractUrlOrigin(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^\{\{/.test(trimmed)) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    const m = trimmed.match(/^(https?:\/\/[^/?#]+)/i);
    return m ? m[1] : null;
  }
}

export function deriveServiceNameFromLabel(label: string): string {
  const cleaned = label.replace(/\s*-\s*[A-Z0-9_]+\.{0,3}$/, '').trim();
  return cleaned || label;
}

export function commonLabelPrefix(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return deriveServiceNameFromLabel(labels[0]);
  let prefix = labels[0];
  for (let i = 1; i < labels.length; i++) {
    while (!labels[i].startsWith(prefix) && prefix.length > 0) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix.replace(/[\s\-–—:,]+$/, '').trim() || deriveServiceNameFromLabel(labels[0]);
}

/** v2→v3 phase 4: assign serviceId from orphan-group map to HTTP nodes still missing one. */
export function applyServiceIdsFromOrphanMap(
  phase2Nodes: WorkflowNode[],
  nodeIdToService: Map<string, string>,
): WorkflowNode[] {
  return phase2Nodes.map((node) => {
    if (node.type !== 'http') return node;
    const data = node.data as HttpNodeData;
    if (data.serviceId) return node;
    const svcId = nodeIdToService.get(node.id);
    if (svcId) return { ...node, data: { ...data, serviceId: svcId } };
    return node;
  });
}

function migrateV2ToV3(wf: Workflow): Workflow {
  if ((wf.schemaVersion ?? 1) >= 3) return wf;
  if ((wf.schemaVersion ?? 1) < 2) wf = migrateV1ToV2(wf);

  const hostProfiles = wf.hostProfiles ?? [];
  const authProfiles = wf.authProfiles ?? [];
  const services: WorkflowService[] = [...(wf.services ?? [])];

  // Phase 1: Convert legacy hostProfiles/authProfiles into services
  const hostProfileToService = new Map<string, string>();
  const nodeAuthMap = new Map<string, string>();
  for (const node of wf.nodes) {
    if (node.type !== 'http') continue;
    const data = node.data as HttpNodeData;
    if (data.hostProfileId && data.authProfileId) {
      if (!nodeAuthMap.has(data.hostProfileId)) {
        nodeAuthMap.set(data.hostProfileId, data.authProfileId);
      }
    }
  }

  for (const hp of hostProfiles) {
    let urlMode: WorkflowServiceUrlMode = 'direct';
    let directUrl: string | undefined;
    let microserviceId: string | undefined;
    if (hp.hostBaseUrl?.trim()) {
      directUrl = hp.hostBaseUrl.trim();
    } else if (hp.hostEnvironmentId && hp.hostMicroserviceId) {
      urlMode = 'multi-env';
      microserviceId = hp.hostMicroserviceId;
    }
    let auth: AuthConfig | undefined;
    const pairedAuthId = nodeAuthMap.get(hp.id);
    if (pairedAuthId) {
      const ap = authProfiles.find((a) => a.id === pairedAuthId);
      if (ap) auth = ap.auth;
    }
    const svc: WorkflowService = {
      id: `svc_${uuidv4()}`,
      name: hp.name || `Service ${services.length + 1}`,
      urlMode,
      directUrl,
      microserviceId,
      auth,
      defaultAuth: auth,
      endpoints: directUrl
        ? [{ envId: '__all__', url: directUrl, enabled: true, authMode: 'inherit' as const, source: 'manual' as const }]
        : [],
    };
    services.push(svc);
    hostProfileToService.set(hp.id, svc.id);
  }

  // Phase 2: Assign serviceId from legacy profiles
  const phase2Nodes = wf.nodes.map((node) => {
    if (node.type !== 'http') return node;
    const data = { ...(node.data as HttpNodeData) };
    if (data.serviceId) return node;
    if (data.hostProfileId) {
      const svcId = hostProfileToService.get(data.hostProfileId);
      if (svcId) data.serviceId = svcId;
    }
    return { ...node, data };
  });

  // Phase 3: Group remaining orphan nodes by URL origin
  const orphanHttpNodes = phase2Nodes.filter((n) => n.type === 'http' && !(n.data as HttpNodeData).serviceId);

  interface OrphanGroup { groupKey: string; nodeIds: string[]; origin: string | null; label: string; auth?: AuthConfig; microserviceId?: string; hostBaseUrl?: string; }
  const groupMap = new Map<string, OrphanGroup>();

  for (const node of orphanHttpNodes) {
    const data = node.data as HttpNodeData;
    const url = data.scenario?.url ?? '';
    const auth = data.scenario?.auth;
    const hasAuth = auth && auth.type !== 'none' && auth.type !== 'inherit';

    let groupKey: string;
    let origin: string | null = null;
    let microserviceId: string | undefined;
    let hostBaseUrl: string | undefined;

    if (data.hostBaseUrl?.trim()) {
      groupKey = `host:${data.hostBaseUrl.trim()}`;
      hostBaseUrl = data.hostBaseUrl.trim();
    } else if (data.hostEnvironmentId && data.hostMicroserviceId) {
      groupKey = `ms:${data.hostMicroserviceId}`;
      microserviceId = data.hostMicroserviceId;
    } else {
      origin = extractUrlOrigin(url);
      if (origin) {
        groupKey = `origin:${origin}`;
      } else {
        groupKey = `label:${deriveServiceNameFromLabel(data.label || 'HTTP Request')}`;
      }
    }

    const existing = groupMap.get(groupKey);
    if (existing) {
      existing.nodeIds.push(node.id);
    } else {
      groupMap.set(groupKey, {
        groupKey,
        nodeIds: [node.id],
        origin,
        label: data.label || 'HTTP Request',
        auth: hasAuth ? auth : undefined,
        microserviceId,
        hostBaseUrl,
      });
    }
  }

  const nodeIdToService = new Map<string, string>();

  for (const group of groupMap.values()) {
    const labels = group.nodeIds.map((id) => {
      const n = phase2Nodes.find((x) => x.id === id);
      return (n?.data as HttpNodeData)?.label || 'HTTP Request';
    });
    const svcName = labels.length === 1
      ? deriveServiceNameFromLabel(labels[0])
      : commonLabelPrefix(labels);

    let urlMode: WorkflowServiceUrlMode = 'direct';
    let directUrl: string | undefined;
    let msId: string | undefined;

    if (group.hostBaseUrl) {
      directUrl = group.hostBaseUrl;
    } else if (group.microserviceId) {
      urlMode = 'multi-env';
      msId = group.microserviceId;
    } else if (group.origin) {
      directUrl = group.origin;
    }

    const svc: WorkflowService = {
      id: `svc_${uuidv4()}`,
      name: svcName,
      urlMode,
      directUrl,
      microserviceId: msId,
      auth: group.auth,
      defaultAuth: group.auth,
      endpoints: directUrl
        ? [{ envId: '__all__', url: directUrl, enabled: true, authMode: 'inherit' as const, source: 'manual' as const }]
        : [],
    };
    services.push(svc);
    for (const nodeId of group.nodeIds) {
      nodeIdToService.set(nodeId, svc.id);
    }
  }

  // Phase 4: Assign serviceId to all remaining nodes
  const finalNodes = applyServiceIdsFromOrphanMap(phase2Nodes, nodeIdToService);

  return {
    ...wf,
    nodes: finalNodes,
    services,
    schemaVersion: 3,
  };
}

// ── Post-migration fixups ──

/** Convert legacy service format (urlMode/directUrl/baseUrls) to endpoints array. */
export function convertLegacyEndpoints(services: WorkflowService[]): WorkflowService[] {
  return services.map((svc) => {
    if (svc.endpoints?.length) return svc;
    const endpoints: ServiceEndpoint[] = [];
    if (svc.urlMode === 'direct' && svc.directUrl?.trim()) {
      endpoints.push({ envId: '__all__', url: svc.directUrl.trim(), enabled: true, authMode: 'inherit', source: 'manual' });
    } else if (svc.urlMode === 'adhoc' && svc.adhocUrl?.trim()) {
      endpoints.push({ envId: '__adhoc__', url: svc.adhocUrl.trim(), enabled: true, authMode: 'inherit', source: 'manual' });
    } else if (svc.urlMode === 'multi-env' && svc.baseUrls) {
      for (const [envId, url] of Object.entries(svc.baseUrls)) {
        if (url?.trim()) {
          const authMode = svc.authPerEnv?.[envId] ? 'custom' as const : 'inherit' as const;
          endpoints.push({ envId, url: url.trim(), enabled: true, authMode, auth: svc.authPerEnv?.[envId], source: 'manual' });
        }
      }
    }
    return {
      ...svc,
      endpoints,
      defaultAuth: svc.defaultAuth ?? svc.auth,
    };
  });
}

/** Split over-grouped services (nodes sharing one service but with different URL origins) and assign orphans. */
function fixupOverGroupedServices(migrated: Workflow): Workflow {
  const httpNodes = migrated.nodes.filter((n) => n.type === 'http');
  const services = [...(migrated.services ?? [])];

  const serviceNodeMap = new Map<string, typeof httpNodes>();
  for (const node of httpNodes) {
    const svcId = (node.data as HttpNodeData).serviceId;
    if (!svcId) continue;
    const list = serviceNodeMap.get(svcId) ?? [];
    list.push(node);
    serviceNodeMap.set(svcId, list);
  }

  const nodesToRegroup = new Set<string>();
  const servicesToRemove = new Set<string>();

  for (const [svcId, nodes] of serviceNodeMap) {
    if (nodes.length <= 1) continue;
    const originMap = new Map<string, string[]>();
    for (const node of nodes) {
      const data = node.data as HttpNodeData;
      const url = data.scenario?.url ?? '';
      const origin = extractUrlOrigin(url);
      const key = origin ?? `label:${deriveServiceNameFromLabel(data.label || 'HTTP Request')}`;
      const list = originMap.get(key) ?? [];
      list.push(node.id);
      originMap.set(key, list);
    }
    if (originMap.size <= 1) continue;
    for (const node of nodes) nodesToRegroup.add(node.id);
    servicesToRemove.add(svcId);
  }

  const orphans = httpNodes.filter((n) => !(n.data as HttpNodeData).serviceId);
  for (const node of orphans) nodesToRegroup.add(node.id);

  if (nodesToRegroup.size === 0) return migrated;

  const filteredServices = services.filter((s) => !servicesToRemove.has(s.id));

  const groups = new Map<string, { nodeIds: string[]; origin: string | null; label: string; auth?: AuthConfig }>();
  for (const nodeId of nodesToRegroup) {
    const node = migrated.nodes.find((n) => n.id === nodeId)!;
    const data = node.data as HttpNodeData;
    const url = data.scenario?.url ?? '';
    const origin = extractUrlOrigin(url);
    const auth = data.scenario?.auth;
    const hasAuth = auth && auth.type !== 'none' && auth.type !== 'inherit';
    const groupKey = origin
      ? `origin:${origin}`
      : `label:${deriveServiceNameFromLabel(data.label || 'HTTP Request')}`;

    const existing = groups.get(groupKey);
    if (existing) {
      existing.nodeIds.push(nodeId);
    } else {
      groups.set(groupKey, {
        nodeIds: [nodeId],
        origin,
        label: data.label || 'HTTP Request',
        auth: hasAuth ? auth : undefined,
      });
    }
  }

  const nodeToSvc = new Map<string, string>();
  for (const group of groups.values()) {
    const labels = group.nodeIds.map((id) => {
      const n = migrated.nodes.find((x) => x.id === id);
      return (n?.data as HttpNodeData)?.label || 'HTTP Request';
    });
    const svcName = labels.length === 1
      ? deriveServiceNameFromLabel(labels[0])
      : commonLabelPrefix(labels);

    const svc: WorkflowService = {
      id: `svc_${uuidv4()}`,
      name: svcName,
      urlMode: group.origin ? 'direct' : 'multi-env',
      directUrl: group.origin ?? undefined,
      auth: group.auth,
      defaultAuth: group.auth,
      endpoints: group.origin
        ? [{ envId: '__all__', url: group.origin, enabled: true, authMode: 'inherit' as const, source: 'manual' as const }]
        : [],
    };
    filteredServices.push(svc);
    for (const nodeId of group.nodeIds) {
      nodeToSvc.set(nodeId, svc.id);
    }
  }

  return {
    ...migrated,
    services: filteredServices,
    nodes: migrated.nodes.map((n) => {
      if (n.type !== 'http') return n;
      const data = n.data as HttpNodeData;
      const newSvcId = nodeToSvc.get(n.id);
      if (newSvcId) return { ...n, data: { ...data, serviceId: newSvcId } };
      return n;
    }),
  };
}

// ── v3 → v4: Auto-insert a Start node for workflows that lack one ──

export function migrateV3ToV4(wf: Workflow): Workflow {
  if ((wf.schemaVersion ?? 1) >= 4) return wf;
  const hasStart = wf.nodes.some(n => n.type === 'start');
  if (hasStart || wf.nodes.length === 0) return { ...wf, schemaVersion: 4 };

  const startNodeId = uuidv4();
  const startNode = {
    id: startNodeId,
    type: 'start' as const,
    position: { x: 250, y: 0 },
    data: { label: 'Start', inputVariables: {} },
  };

  // Find root nodes (no incoming edges) to connect the Start node to them.
  const targets = new Set(wf.edges.map(e => e.target));
  const rootNodes = wf.nodes.filter(n => !targets.has(n.id));

  const newEdges = rootNodes.map(root => ({
    id: `e-${startNodeId}-${root.id}`,
    source: startNodeId,
    sourceHandle: 'out',
    target: root.id,
    targetHandle: null,
  }));

  // Shift existing nodes down to make room for the Start node.
  const shiftedNodes = wf.nodes.map(n => ({
    ...n,
    position: { ...n.position, y: n.position.y + 100 },
  }));

  return {
    ...wf,
    schemaVersion: 4,
    nodes: [startNode, ...shiftedNodes],
    edges: [...wf.edges, ...newEdges],
  };
}

// ── v4 → v5: Sub-workflow node support (structural bump, no data changes) ──

export function migrateV4ToV5(wf: Workflow): Workflow {
  if ((wf.schemaVersion ?? 1) >= 5) return wf;
  return { ...wf, schemaVersion: 5 };
}

// ── v5 → v6: Remove orphaned Start nodes from webhook/schedule triggered workflows ──

export function migrateV5ToV6(wf: Workflow): Workflow {
  if ((wf.schemaVersion ?? 1) >= 6) return wf;
  
  // Check if workflow has webhook or schedule trigger nodes
  const webhookNode = wf.nodes.find(n => n.type === 'webhook');
  const scheduleNode = wf.nodes.find(n => n.type === 'schedule');
  const triggerNode = webhookNode || scheduleNode;
  
  if (!triggerNode) {
    // Not a trigger-based workflow, no changes needed
    return { ...wf, schemaVersion: 6 };
  }
  
  // Find Start nodes that only connect to the trigger node (orphaned)
  const startNodesToRemove: string[] = [];
  
  for (const node of wf.nodes) {
    if (node.type !== 'start') continue;
    
    const outgoingEdges = wf.edges.filter(e => e.source === node.id);
    
    // Remove if: no outgoing edges, or only connects to the trigger node
    if (outgoingEdges.length === 0) {
      startNodesToRemove.push(node.id);
    } else if (outgoingEdges.length === 1 && outgoingEdges[0].target === triggerNode.id) {
      startNodesToRemove.push(node.id);
    }
  }
  
  if (startNodesToRemove.length === 0) {
    return { ...wf, schemaVersion: 6 };
  }
  
  const removedSet = new Set(startNodesToRemove);
  
  return {
    ...wf,
    schemaVersion: 6,
    nodes: wf.nodes.filter(n => !removedSet.has(n.id)),
    edges: wf.edges.filter(e => !removedSet.has(e.source) && !removedSet.has(e.target)),
  };
}

/**
 * Run all schema migrations on a workflow (v1 → v2 → v3 → v4 → v5 → v6 + fixups).
 * Pure function — no React dependencies.
 */
export function migrateWorkflowSchema(wf: Workflow): Workflow {
  const version = wf.schemaVersion ?? 1;
  let migrated = wf;
  if (version < 2) migrated = migrateV1ToV2(migrated);
  if ((migrated.schemaVersion ?? 1) < 3) migrated = migrateV2ToV3(migrated);
  if ((migrated.schemaVersion ?? 1) < 4) migrated = migrateV3ToV4(migrated);
  if ((migrated.schemaVersion ?? 1) < 5) migrated = migrateV4ToV5(migrated);
  if ((migrated.schemaVersion ?? 1) < 6) migrated = migrateV5ToV6(migrated);

  migrated = {
    ...migrated,
    hostProfiles: migrated.hostProfiles ?? [],
    authProfiles: migrated.authProfiles ?? [],
    services: convertLegacyEndpoints(migrated.services ?? []),
  };

  migrated = fixupOverGroupedServices(migrated);

  return migrated;
}

export { migrateV1ToV2, migrateV2ToV3 };
