import { useEffect, useMemo, useState } from 'react';
import type { AuthConfig, Environment, GlobalAuthProfile, Microservice } from '../../../../shared/types';
import type { HttpNodeData, Workflow, WorkflowNode } from '../../types/workflow';
import { resolveHttpNodeBaseUrl } from '../../utils/workflowHostResolve';
import WorkflowEditorModalFrame from './WorkflowEditorModalFrame';

interface Props {
  open: boolean;
  workflow: Workflow | null;
  environments: Environment[];
  microservices: Microservice[];
  globalAuthProfiles: GlobalAuthProfile[];
  harnessEnvId: string;
  harnessSvcId: string;
  harnessBaseUrl: string;
  onApply: (workflowId: string, nodes: WorkflowNode[]) => void;
  onClose: () => void;
}

function isHttpNode(node: WorkflowNode): boolean {
  return node.type === 'http' && !!node.data && typeof node.data === 'object' && 'scenario' in node.data;
}

function cloneHttpData(data: HttpNodeData): HttpNodeData {
  return JSON.parse(JSON.stringify(data)) as HttpNodeData;
}

export default function WorkflowRequestsSettingsModal({
  open,
  workflow,
  environments,
  microservices,
  globalAuthProfiles,
  harnessEnvId: harnessEnvId,
  harnessSvcId: harnessSvcId,
  harnessBaseUrl: harnessBaseUrl,
  onApply,
  onClose,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, HttpNodeData>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const httpRows = useMemo(() => {
    if (!workflow) return [];
    return workflow.nodes
      .filter(isHttpNode)
      .map((n) => ({
        id: n.id,
        data: (drafts[n.id] ?? cloneHttpData(n.data as HttpNodeData)),
      }));
  }, [workflow, drafts]);

  useEffect(() => {
    if (!open || !workflow) return;
    const next: Record<string, HttpNodeData> = {};
    for (const node of workflow.nodes) {
      if (!isHttpNode(node)) continue;
      next[node.id] = cloneHttpData(node.data as HttpNodeData);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset drafts when modal opens with workflow data
    setDrafts(next);
    const firstId = Object.keys(next)[0] ?? null;
     
    setSelectedNodeId(firstId);
  }, [open, workflow]);

  const selectedDraft = selectedNodeId ? drafts[selectedNodeId] : null;

  const microservicesForEnv = useMemo(() => {
    if (!selectedDraft?.hostEnvironmentId) return [];
    return microservices.filter((s) => selectedDraft.hostEnvironmentId! in s.baseUrls);
  }, [microservices, selectedDraft?.hostEnvironmentId]);

  const previewBase = useMemo(() => {
    if (!selectedDraft) return '—';
    return resolveHttpNodeBaseUrl(selectedDraft, microservices, workflow?.hostProfiles ?? []) || harnessBaseUrl.trim() || '—';
  }, [selectedDraft, microservices, workflow?.hostProfiles, harnessBaseUrl]);

  if (!open || !workflow) return null;

  const updateSelected = (patch: Partial<HttpNodeData>) => {
    if (!selectedNodeId || !selectedDraft) return;
    setDrafts((prev) => ({ ...prev, [selectedNodeId]: { ...selectedDraft, ...patch } }));
  };

  const updateSelectedAuth = (auth: AuthConfig) => {
    if (!selectedNodeId || !selectedDraft) return;
    setDrafts((prev) => ({
      ...prev,
      [selectedNodeId]: {
        ...selectedDraft,
        scenario: { ...selectedDraft.scenario, auth },
      },
    }));
  };

  const selectedAuth = selectedDraft?.scenario.auth ?? { type: 'none' as const };
  const selectedAuthProfileId = (selectedAuth as { globalProfileId?: string }).globalProfileId;
  const authSelectValue = selectedAuthProfileId ? 'global-profile' : selectedAuth.type;

  const apply = () => {
    const nodes = workflow.nodes.map((node) => {
      if (!isHttpNode(node)) return node;
      const d = drafts[node.id];
      return d ? { ...node, data: d } : node;
    });
    onApply(workflow.id, nodes);
    onClose();
  };

  return (
    <WorkflowEditorModalFrame
      open={open}
      title={<span id="wf-req-settings-title">{workflow.name} - Request Host/Auth Settings</span>}
      onClose={onClose}
      overlayClassName="wf-req-settings-overlay"
      dialogClassName="wf-req-settings-modal"
      bodyScrollable={false}
      footer={(
        <>
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={apply} disabled={httpRows.length === 0}>Apply</button>
        </>
      )}
    >
        <div className="wf-req-settings-body">
          <div className="wf-req-settings-left">
            <div className="wf-req-settings-left-head">Requests</div>
            <div className="wf-req-settings-list">
              {httpRows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`wf-req-settings-row ${selectedNodeId === r.id ? 'active' : ''}`}
                  onClick={() => setSelectedNodeId(r.id)}
                >
                  <span className="wf-req-settings-row-name">{r.data.label || 'HTTP step'}</span>
                  <span className="wf-req-settings-row-method">{r.data.scenario.method}</span>
                </button>
              ))}
              {httpRows.length === 0 && (
                <div className="wf-req-settings-empty">No HTTP requests in this workflow.</div>
              )}
            </div>
          </div>

          <div className="wf-req-settings-right">
            {!selectedDraft ? (
              <div className="wf-req-settings-empty">Select a request on the left.</div>
            ) : (
              <>
                <div className="wf-req-settings-grid">
                  <div className="wf-config-field">
                    <label>Request Name</label>
                    <input value={selectedDraft.label} onChange={(e) => updateSelected({ label: e.target.value })} />
                  </div>

                  <div className="wf-config-field">
                    <label>Host Mode</label>
                    <div className="wf-host-mode" role="group" aria-label="Host mode">
                      <label className="wf-config-inline-radio">
                        <input
                          type="radio"
                          name="wf-bulk-host-mode"
                          checked={!selectedDraft.hostEnvironmentId || !selectedDraft.hostMicroserviceId}
                          onChange={() => updateSelected({ hostEnvironmentId: undefined, hostMicroserviceId: undefined, hostBaseUrl: undefined, hostProfileId: undefined })}
                        />
                        Harness bar (default)
                      </label>
                      <label className="wf-config-inline-radio">
                        <input
                          type="radio"
                          name="wf-bulk-host-mode"
                          checked={!!(selectedDraft.hostEnvironmentId && selectedDraft.hostMicroserviceId)}
                          onChange={() => {
                            const envId = harnessEnvId || environments[0]?.id;
                            if (!envId) return;
                            const svcs = microservices.filter((s) => envId in s.baseUrls);
                            const svcId = (harnessSvcId && svcs.some((s) => s.id === harnessSvcId)) ? harnessSvcId : svcs[0]?.id;
                            if (!svcId) return;
                            updateSelected({ hostEnvironmentId: envId, hostMicroserviceId: svcId, hostBaseUrl: undefined, hostProfileId: undefined });
                          }}
                        />
                        This request only
                      </label>
                    </div>
                  </div>

                  {!!(selectedDraft.hostEnvironmentId || selectedDraft.hostMicroserviceId) && (
                    <>
                      <div className="wf-config-field">
                        <label>Environment</label>
                        <select
                          value={selectedDraft.hostEnvironmentId ?? ''}
                          onChange={(e) => {
                            const envId = e.target.value || undefined;
                            if (!envId) {
                              updateSelected({ hostEnvironmentId: undefined, hostMicroserviceId: undefined, hostBaseUrl: undefined, hostProfileId: undefined });
                              return;
                            }
                            const svcs = microservices.filter((s) => envId in s.baseUrls);
                            let svcId = selectedDraft.hostMicroserviceId;
                            if (!svcId || !svcs.some((s) => s.id === svcId)) svcId = svcs[0]?.id;
                            updateSelected({ hostEnvironmentId: envId, hostMicroserviceId: svcId, hostBaseUrl: undefined, hostProfileId: undefined });
                          }}
                        >
                          <option value="">Environment...</option>
                          {environments.map((env) => (
                            <option key={env.id} value={env.id}>{env.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="wf-config-field">
                        <label>Microservice</label>
                        <select
                          value={selectedDraft.hostMicroserviceId ?? ''}
                          onChange={(e) => updateSelected({ hostMicroserviceId: e.target.value || undefined, hostBaseUrl: undefined, hostProfileId: undefined })}
                          disabled={!selectedDraft.hostEnvironmentId}
                        >
                          <option value="">Microservice...</option>
                          {microservicesForEnv.map((svc) => (
                            <option key={svc.id} value={svc.id}>{svc.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="wf-config-field">
                    <label>Resolved Hostname</label>
                    <div className="wf-req-settings-preview"><code>{previewBase}</code></div>
                  </div>

                  <div className="wf-config-field">
                    <label>Auth Type</label>
                    <select
                      value={authSelectValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'global-profile') {
                          const first = globalAuthProfiles[0];
                          if (first) updateSelectedAuth({ ...first.auth, globalProfileId: first.id } as AuthConfig);
                          return;
                        }
                        updateSelectedAuth({ type: val as AuthConfig['type'] });
                      }}
                    >
                      <option value="none">None</option>
                      {globalAuthProfiles.length > 0 && <option value="global-profile">Global Auth Profile</option>}
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                      <option value="apikey">API Key</option>
                      <option value="oauth2">OAuth2 Client Credentials</option>
                    </select>
                  </div>

                  {authSelectValue === 'global-profile' && (
                    <div className="wf-config-field">
                      <label>Global Auth Profile</label>
                      <select
                        value={selectedAuthProfileId ?? ''}
                        onChange={(e) => {
                          const p = globalAuthProfiles.find((x) => x.id === e.target.value);
                          if (p) updateSelectedAuth({ ...p.auth, globalProfileId: p.id } as AuthConfig);
                        }}
                      >
                        {globalAuthProfiles.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedAuth.type === 'bearer' && authSelectValue !== 'global-profile' && (
                    <>
                      <div className="wf-config-field">
                        <label>Prefix</label>
                        <input value={selectedAuth.prefix ?? 'Bearer'} onChange={(e) => updateSelectedAuth({ ...selectedAuth, prefix: e.target.value })} />
                      </div>
                      <div className="wf-config-field">
                        <label>Token</label>
                        <input value={selectedAuth.token ?? ''} onChange={(e) => updateSelectedAuth({ ...selectedAuth, token: e.target.value })} />
                      </div>
                    </>
                  )}

                  {selectedAuth.type === 'basic' && authSelectValue !== 'global-profile' && (
                    <>
                      <div className="wf-config-field">
                        <label>Username</label>
                        <input value={selectedAuth.username ?? ''} onChange={(e) => updateSelectedAuth({ ...selectedAuth, username: e.target.value })} />
                      </div>
                      <div className="wf-config-field">
                        <label>Password</label>
                        <input type="password" value={selectedAuth.password ?? ''} onChange={(e) => updateSelectedAuth({ ...selectedAuth, password: e.target.value })} />
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
    </WorkflowEditorModalFrame>
  );
}
