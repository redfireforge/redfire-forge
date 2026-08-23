import { useState, useEffect } from 'react';
import type { Environment, Microservice, FeatureGroup } from '@shared/types';

interface Props {
  environments: Environment[];
  microservices: Microservice[];
  featureGroups: FeatureGroup[];
  selectedEnvId: string;
  selectedSvcId: string;
  onEnvSelect: (envId: string) => void;
  onSvcSelect: (svcId: string) => void;
  sidebarView: 'env' | 'svc';
  onSidebarViewChange: (view: 'env' | 'svc') => void;
}

export default function Sidebar({
  environments, microservices, featureGroups,
  selectedEnvId, selectedSvcId, onEnvSelect, onSvcSelect,
  sidebarView, onSidebarViewChange,
}: Props) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Auto-expand the selected environment/microservice on initial load
  useEffect(() => {
    if (selectedEnvId && sidebarView === 'env') {
      setExpandedNodes(prev => {
        if (prev.has(selectedEnvId)) return prev;
        const next = new Set(prev);
        next.add(selectedEnvId);
        return next;
      });
    }
    if (selectedSvcId && sidebarView === 'svc') {
      setExpandedNodes(prev => {
        if (prev.has(selectedSvcId)) return prev;
        const next = new Set(prev);
        next.add(selectedSvcId);
        return next;
      });
    }
  }, [selectedEnvId, selectedSvcId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpanded = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allExpanded = sidebarView === 'env'
    ? environments.length > 0 && environments.every((e) => expandedNodes.has(e.id))
    : microservices.length > 0 && microservices.every((s) => expandedNodes.has(s.id));

  const expandAll = () => {
    if (sidebarView === 'env') setExpandedNodes(new Set(environments.map((e) => e.id)));
    else setExpandedNodes(new Set(microservices.map((s) => s.id)));
  };
  const collapseAll = () => setExpandedNodes(new Set());

  return (
    <div className="config-sidebar-inner">
      <div className="sidebar-toggle">
        <button className={`sidebar-toggle-btn ${sidebarView === 'env' ? 'active' : ''}`} onClick={() => { onSidebarViewChange('env'); setExpandedNodes(new Set()); }}>Environments</button>
        <button className={`sidebar-toggle-btn ${sidebarView === 'svc' ? 'active' : ''}`} onClick={() => { onSidebarViewChange('svc'); setExpandedNodes(new Set()); }}>Microservices</button>
      </div>
      <div className="sidebar-expand-all">
        <button className="btn btn-xs" onClick={allExpanded ? collapseAll : expandAll}>
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {sidebarView === 'env' && (
        <div className="sidebar-list">
          {environments.length === 0 && <div className="empty-hint">No environments. Go to Environments to add.</div>}
          {environments.map((env) => {
            const svcsInEnv = microservices.filter((s) => env.id in s.baseUrls);
            const isExpanded = expandedNodes.has(env.id);
            const envHasFeatures = featureGroups.some((fg) => fg.environmentId === env.id);
            return (
              <div key={env.id} className="sidebar-tree-node">
                <div className={`sidebar-item ${selectedEnvId === env.id ? 'selected' : ''} ${envHasFeatures ? 'has-features' : 'no-features'}`}>
                  <span className={`sidebar-expand-icon ${isExpanded ? 'expanded' : ''}`} onClick={(e) => { e.stopPropagation(); toggleExpanded(env.id); }}>▸</span>
                  <span className="sidebar-item-name" onClick={() => {
                    toggleExpanded(env.id);
                    // Also select this env + first microservice in it
                    onEnvSelect(env.id);
                    if (svcsInEnv.length > 0) onSvcSelect(svcsInEnv[0].id);
                  }}>{env.name}</span>
                  <span className="sidebar-item-count">{svcsInEnv.length}</span>
                </div>
                {isExpanded && (
                  <div className="sidebar-children">
                    {svcsInEnv.length === 0
                      ? <div className="empty-hint">No microservices deployed here.</div>
                      : svcsInEnv.map((svc) => {
                        const hasFeatures = featureGroups.some((fg) => fg.microserviceId === svc.id && fg.environmentId === env.id);
                        return (
                          <div key={svc.id} className={`sidebar-child ${selectedEnvId === env.id && selectedSvcId === svc.id ? 'selected' : ''} ${hasFeatures ? 'has-features' : 'no-features'}`}
                            onClick={() => { onEnvSelect(env.id); onSvcSelect(svc.id); }}>
                            {svc.name}
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            );
          })}
          {/* Additional (service-specific) environments */}
          {microservices.flatMap(svc => (svc.customEnvs ?? []).map(ce => ({ ...ce, svcId: svc.id, svcName: svc.name }))).length > 0 && (
            <>
              <div className="sidebar-section-divider">Additional Environments</div>
              {microservices.flatMap(svc =>
                (svc.customEnvs ?? []).map(ce => {
                  const envHasFeatures = featureGroups.some(fg => fg.environmentId === ce.id);
                  return (
                    <div key={ce.id} className="sidebar-tree-node">
                      <div className={`sidebar-item sidebar-item--additional ${selectedEnvId === ce.id ? 'selected' : ''} ${envHasFeatures ? 'has-features' : 'no-features'}`}
                        onClick={() => { onEnvSelect(ce.id); onSvcSelect(svc.id); }}>
                        <span className="sidebar-item-name">{ce.name}</span>
                        <span className="sidebar-additional-env-tag">{svc.name}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      )}

      {sidebarView === 'svc' && (
        <div className="sidebar-list">
          {microservices.length === 0 && <div className="empty-hint">No microservices. Go to Environments to add.</div>}
          {microservices.map((svc) => {
            const envsForSvc = [
              ...environments.filter((e) => e.id in svc.baseUrls),
              ...(svc.customEnvs ?? []).filter((e) => e.id in svc.baseUrls),
            ];
            const isExpanded = expandedNodes.has(svc.id);
            const svcHasFeatures = featureGroups.some((fg) => fg.microserviceId === svc.id);
            return (
              <div key={svc.id} className="sidebar-tree-node">
                <div className={`sidebar-item ${selectedSvcId === svc.id ? 'selected' : ''} ${svcHasFeatures ? 'has-features' : 'no-features'}`}>
                  <span className={`sidebar-expand-icon ${isExpanded ? 'expanded' : ''}`} onClick={(e) => { e.stopPropagation(); toggleExpanded(svc.id); }}>▸</span>
                  <span className="sidebar-item-name" onClick={() => {
                    toggleExpanded(svc.id);
                  }}>{svc.name}</span>
                  <span className="sidebar-item-count">{envsForSvc.length}</span>
                </div>
                {isExpanded && (
                  <div className="sidebar-children">
                    {envsForSvc.length === 0
                      ? <div className="empty-hint">Not deployed to any environment.</div>
                      : envsForSvc.map((env) => {
                        const hasFeatures = featureGroups.some((fg) => fg.microserviceId === svc.id && fg.environmentId === env.id);
                        const isAdditional = !environments.some((e) => e.id === env.id);
                        return (
                          <div key={env.id} className={`sidebar-child ${selectedSvcId === svc.id && selectedEnvId === env.id ? 'selected' : ''} ${hasFeatures ? 'has-features' : 'no-features'}`}
                            onClick={() => { onSvcSelect(svc.id); onEnvSelect(env.id); }}>
                            {env.name}
                            {isAdditional && <span className="sidebar-additional-env-tag">additional</span>}
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
