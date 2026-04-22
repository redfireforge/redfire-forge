import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Workflow, HttpNodeData, WorkflowHostProfile, WorkflowAuthProfile, WorkflowService, WorkflowServiceUrlMode, ServiceEndpoint } from '../types/workflow';
import type { AuthConfig } from '../types';
import { createSampleWorkflow } from '../data/sampleWorkflow';
import {
  loadWorkflows,
  saveWorkflows,
  loadWorkflowSampleDismissed,
  saveWorkflowSampleDismissed,
  loadSelectedWorkflowId,
  saveSelectedWorkflowId,
} from '../utils/storage';

const WORKFLOW_SCHEMA_VERSION = 3;

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

// ── v2 → v3: hostProfiles + authProfiles → services[] / serviceId ────

/**
 * Try to extract protocol + host from a URL string.
 * Returns null for relative URLs, template-only URLs, or unparseable strings.
 */
function extractUrlOrigin(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  // Skip if URL starts with a template variable like {{baseUrl}}/path
  if (/^\{\{/.test(trimmed)) return null;
  // Must start with http:// or https://
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    // URL might contain un-substituted {{variables}} in the hostname; try a regex
    const m = trimmed.match(/^(https?:\/\/[^/?#]+)/i);
    return m ? m[1] : null;
  }
}

/**
 * Derive a short service name from a node label.
 * Strips common trailing identifiers like " - FIRST_OWNER..." to find a shared prefix.
 */
function deriveServiceNameFromLabel(label: string): string {
  // Strip trailing " - DETAILS" patterns
  const cleaned = label.replace(/\s*-\s*[A-Z0-9_]+\.{0,3}$/, '').trim();
  return cleaned || label;
}

/**
 * Find the longest common prefix among a set of labels (for grouping similar names).
 */
function commonLabelPrefix(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return deriveServiceNameFromLabel(labels[0]);
  let prefix = labels[0];
  for (let i = 1; i < labels.length; i++) {
    while (!labels[i].startsWith(prefix) && prefix.length > 0) {
      prefix = prefix.slice(0, -1);
    }
  }
  // Trim trailing punctuation/spaces
  return prefix.replace(/[\s\-–—:,]+$/, '').trim() || deriveServiceNameFromLabel(labels[0]);
}

function migrateV2ToV3(wf: Workflow): Workflow {
  if ((wf.schemaVersion ?? 1) >= 3) return wf;
  // Run v1→v2 first if needed
  if ((wf.schemaVersion ?? 1) < 2) wf = migrateV1ToV2(wf);

  const hostProfiles = wf.hostProfiles ?? [];
  const authProfiles = wf.authProfiles ?? [];
  const services: WorkflowService[] = [...(wf.services ?? [])];

  // ── Phase 1: Convert legacy hostProfiles/authProfiles into services ──
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

  // ── Phase 2: Assign serviceId from legacy profiles ──
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

  // ── Phase 3: Group remaining orphan nodes by URL origin → one service per microservice endpoint ──
  const orphanHttpNodes = phase2Nodes.filter((n) => n.type === 'http' && !(n.data as HttpNodeData).serviceId);

  // Group orphans by "service identity": URL origin, or inline host config, or label prefix
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

    // Priority 1: Inline host fields (hostBaseUrl or env+svc)
    if (data.hostBaseUrl?.trim()) {
      groupKey = `host:${data.hostBaseUrl.trim()}`;
      hostBaseUrl = data.hostBaseUrl.trim();
    } else if (data.hostEnvironmentId && data.hostMicroserviceId) {
      groupKey = `ms:${data.hostMicroserviceId}`;
      microserviceId = data.hostMicroserviceId;
    } else {
      // Priority 2: Extract origin from the full URL
      origin = extractUrlOrigin(url);
      if (origin) {
        groupKey = `origin:${origin}`;
      } else {
        // Priority 3: Use cleaned label as the group key (relative URLs / template URLs)
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

  // Create one service per group
  const nodeIdToService = new Map<string, string>();

  for (const group of groupMap.values()) {
    // Derive service name
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
    // else: relative/template URL → leave directUrl empty for user to fill in

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

  // ── Phase 4: Assign serviceId to all remaining nodes ──
  const finalNodes = phase2Nodes.map((node) => {
    if (node.type !== 'http') return node;
    const data = node.data as HttpNodeData;
    if (data.serviceId) return node;
    const svcId = nodeIdToService.get(node.id);
    if (svcId) return { ...node, data: { ...data, serviceId: svcId } };
    return node;
  });

  return {
    ...wf,
    nodes: finalNodes,
    services,
    schemaVersion: 3,
  };
}

function migrateWorkflowSchema(wf: Workflow): Workflow {
  const version = wf.schemaVersion ?? 1;
  let migrated = wf;
  if (version < 2) migrated = migrateV1ToV2(migrated);
  if ((migrated.schemaVersion ?? 1) < 3) migrated = migrateV2ToV3(migrated);

  // Ensure defaults are populated
  migrated = {
    ...migrated,
    hostProfiles: migrated.hostProfiles ?? [],
    authProfiles: migrated.authProfiles ?? [],
    services: migrated.services ?? [],
  };

  // Convert legacy service format (urlMode/directUrl/baseUrls) to endpoints array
  migrated = {
    ...migrated,
    services: (migrated.services ?? []).map((svc) => {
      if (svc.endpoints?.length) return svc; // already converted
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
    }),
  };

  // Fixup: handle orphan HTTP nodes AND split services that lump nodes with different URL origins.
  const httpNodes = migrated.nodes.filter((n) => n.type === 'http');
  const services = [...(migrated.services ?? [])];

  // Step 1: Detect over-grouped services — nodes sharing one service but with different URL origins
  const serviceNodeMap = new Map<string, typeof httpNodes>();
  for (const node of httpNodes) {
    const svcId = (node.data as HttpNodeData).serviceId;
    if (!svcId) continue;
    const list = serviceNodeMap.get(svcId) ?? [];
    list.push(node);
    serviceNodeMap.set(svcId, list);
  }

  // Collect nodes that need re-grouping (their serviceId will be cleared)
  const nodesToRegroup = new Set<string>();
  const servicesToRemove = new Set<string>();

  for (const [svcId, nodes] of serviceNodeMap) {
    if (nodes.length <= 1) continue;
    // Check if nodes have distinct URL origins
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
    // If all nodes share the same origin, the service is fine
    if (originMap.size <= 1) continue;
    // Multiple origins — mark all nodes for re-grouping and remove the old service
    for (const node of nodes) nodesToRegroup.add(node.id);
    servicesToRemove.add(svcId);
  }

  // Also add orphan nodes (no serviceId at all)
  const orphans = httpNodes.filter((n) => !(n.data as HttpNodeData).serviceId);
  for (const node of orphans) nodesToRegroup.add(node.id);

  if (nodesToRegroup.size > 0) {
    // Remove over-grouped services
    const filteredServices = services.filter((s) => !servicesToRemove.has(s.id));

    // Group all nodes-to-regroup by URL origin or label
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

    migrated = {
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

  return migrated;
}

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [wfs, dismissed, storedSelectedId] = await Promise.all([
        loadWorkflows(),
        loadWorkflowSampleDismissed(),
        loadSelectedWorkflowId(),
      ]);
      if (cancelled) return;
      let next = wfs.map(migrateWorkflowSchema);
      const migrated = JSON.stringify(next) !== JSON.stringify(wfs);
      if (!dismissed && !next.some((w) => w.id === 'sample-workflow-001')) {
        next = [migrateWorkflowSchema(createSampleWorkflow()), ...next];
        await saveWorkflows(next);
      } else if (migrated) {
        await saveWorkflows(next);
      }
      if (cancelled) return;

      let initialSelected: string | null = null;
      if (storedSelectedId && next.some((w) => w.id === storedSelectedId)) {
        initialSelected = storedSelectedId;
      } else if (storedSelectedId) {
        void saveSelectedWorkflowId(null);
      }

      setWorkflows(next);
      setSelectedId(initialSelected);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveSelectedWorkflowId(selectedId);
  }, [loaded, selectedId]);

  /** Ensure a workflow is selected when the list is non-empty (invalid id, missing storage, or after delete). */
  useEffect(() => {
    if (!loaded) return;
    const missing = selectedId === null && workflows.length > 0;
    const invalid = selectedId != null && !workflows.some((w) => w.id === selectedId);
    if (!missing && !invalid) return;
    const sorted = [...workflows].sort((a, b) => b.updatedAt - a.updatedAt);
    const pick = sorted[0]?.id ?? null;
    setSelectedId(pick);
    void saveSelectedWorkflowId(pick);
  }, [loaded, workflows, selectedId]);

  const create = useCallback((name: string): Workflow => {
    const wf: Workflow = {
      id: uuidv4(),
      name,
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      variables: {},
      hostProfiles: [],
      authProfiles: [],
      services: [],
      nodes: [],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setWorkflows((prev) => {
      const next = [...prev, wf];
      void saveWorkflows(next);
      return next;
    });
    setSelectedId(wf.id);
    return wf;
  }, []);

  /** Always merges into the latest workflows (avoids stale closure if multiple updates batch). */
  const update = useCallback((id: string, patch: Partial<Omit<Workflow, 'id' | 'createdAt'>>) => {
    setWorkflows((prev) => {
      const next = prev.map((wf) => (wf.id === id ? { ...wf, ...patch, updatedAt: Date.now() } : wf));
      void saveWorkflows(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    if (id === 'sample-workflow-001') {
      void saveWorkflowSampleDismissed(true);
    }
    setWorkflows((prev) => {
      const next = prev.filter((wf) => wf.id !== id);
      void saveWorkflows(next);
      return next;
    });
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const insert = useCallback((wf: Workflow) => {
    setWorkflows((prev) => {
      if (prev.some((w) => w.id === wf.id)) {
        return prev;
      }
      if (wf.id === 'sample-workflow-001') {
        void saveWorkflowSampleDismissed(false);
      }
      const next = [...prev, wf];
      void saveWorkflows(next);
      return next;
    });
    setSelectedId(wf.id);
  }, []);

  const duplicate = useCallback((id: string) => {
    let copyId: string | null = null;
    setWorkflows((prev) => {
      const src = prev.find((wf) => wf.id === id);
      if (!src) return prev;
      copyId = uuidv4();
      const copy: Workflow = {
        ...structuredClone(src),
        id: copyId,
        name: `${src.name} (copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const next = [...prev, copy];
      void saveWorkflows(next);
      return next;
    });
    if (copyId) setSelectedId(copyId);
  }, []);

  const selected = workflows.find((wf) => wf.id === selectedId) ?? null;

  return {
    workflows,
    selected,
    selectedId,
    loaded,
    select: setSelectedId,
    create,
    insert,
    update,
    remove,
    duplicate,
  };
}

export type WorkflowHook = ReturnType<typeof useWorkflows>;
