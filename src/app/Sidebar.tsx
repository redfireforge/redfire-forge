import { useState } from 'react';
import type { Environment, Microservice, FeatureGroup } from '../shared/types';

interface Props {
  environments: Environment[];
  microservices: Microservice[];
  featureGroups: FeatureGroup[];
  selectedEnvId: string;
  selectedSvcId: string;
  onEnvSelect: (envId: string) => void;
  onSvcSelect: (svcId: string) => void;
}

export default function Sidebar({
  environments, microservices, featureGroups,
  selectedEnvId, selectedSvcId, onEnvSelect, onSvcSelect,
}: Props) {
  const [sidebarView, setSidebarView] = useState<'env' | 'svc'>('env');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

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
        <button className={`sidebar-toggle-btn ${sidebarView === 'env' ? 'active' : ''}`} onClick={() => { setSidebarView('env'); setExpandedNodes(new Set()); }}>Environments</button>
        <button className={`sidebar-toggle-btn ${sidebarView === 'svc' ? 'active' : ''}`} onClick={() => { setSidebarView('svc'); setExpandedNodes(new Set()); }}>Microservices</button>
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
        </div>
      )}

      {sidebarView === 'svc' && (
        <div className="sidebar-list">
          {microservices.length === 0 && <div className="empty-hint">No microservices. Go to Environments to add.</div>}
          {microservices.map((svc) => {
            const envsForSvc = environments.filter((e) => e.id in svc.baseUrls);
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
                        return (
                          <div key={env.id} className={`sidebar-child ${selectedSvcId === svc.id && selectedEnvId === env.id ? 'selected' : ''} ${hasFeatures ? 'has-features' : 'no-features'}`}
                            onClick={() => { onSvcSelect(svc.id); onEnvSelect(env.id); }}>
                            {env.name}
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
