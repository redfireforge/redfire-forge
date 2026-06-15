import { useState, useMemo, useRef } from 'react';
import { SWAGGER_METHOD_COLORS } from '../../../shared/constants/httpMethodColors';
import type { RequestCollection, Environment, Microservice } from '../../../shared/types';
import { useEscapeKey } from '../../../shared/hooks/useEscapeKey';
import { collectAllRequestsFromCollection } from '../utils/requestTree';
import { CascadeSelect } from './CascadeSelect';
import HarnessOptionsGrid from './send-harness-shared/HarnessOptionsGrid';
import { useHarnessEnvironmentCascade } from '../hooks/useHarnessEnvironmentCascade';

export interface BatchSendToHarnessPayload {
  collectionId: string;
  selectedRequestIds: Set<string>;
  validationPreset: 'none' | 'status-200';
  authMode: 'concrete' | 'inherit';
  environmentId?: string;
  microserviceId?: string;
}

interface Props {
  collection: RequestCollection;
  environments: Environment[];
  microservices: Microservice[];
  onConfirm: (payload: BatchSendToHarnessPayload) => void;
  onClose: () => void;
}

type Step = 'target' | 'options';

export default function BatchSendToHarnessModal({ collection, environments, microservices, onConfirm, onClose }: Props) {
  const allRequests = useMemo(() => collectAllRequestsFromCollection(collection), [collection]);
  const [step, setStep] = useState<Step>('target');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(allRequests.map(r => r.id)));
  const [validationPreset, setValidationPreset] = useState<'none' | 'status-200'>('none');
  const [authMode, setAuthMode] = useState<'concrete' | 'inherit'>('concrete');

  const [envId, setEnvId] = useState('');
  const [svcId, setSvcId] = useState('');

  const allSelected = selectedIds.size === allRequests.length;
  const noneSelected = selectedIds.size === 0;

  const { envOptions, filteredMicroservices } = useHarnessEnvironmentCascade(
    environments,
    microservices,
    envId,
  );

  const handleEnvChange = (id: string) => {
    setEnvId(id);
    setSvcId('');
  };

  const envReady = !!envId;
  const svcReady = !!svcId;
  const canProceed = envReady && svcReady;

  const toggleRequest = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allRequests.map(r => r.id)));
  };

  useEscapeKey(onClose);

  const folderCount = collection.folders?.length ?? 0;
  const scenarioCount = 1 + folderCount;

  const targetSummary = useMemo(() => {
    const envName = envOptions.find(e => e.id === envId)?.name ?? '';
    const svcName = microservices.find(s => s.id === svcId)?.name ?? '';
    return { envName, svcName };
  }, [envId, svcId, envOptions, microservices]);

  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div className="send-harness-overlay" onClick={onClose}>
      <div className="send-harness-modal" onClick={e => e.stopPropagation()} style={{ width: 540 }}>

        {/* Header */}
        <div className="send-harness-header">
          <div className="send-harness-title-row">
            <h3>Send Collection to Harness</h3>
            <div className="send-harness-steps">
              <span className={`send-harness-step${step === 'target' ? ' active' : ''}`}>1 Target</span>
              <span className="send-harness-step-arrow">&rsaquo;</span>
              <span className={`send-harness-step${step === 'options' ? ' active' : ''}`}>2 Requests</span>
            </div>
          </div>
          <span className="batch-harness-col-name">{collection.name}</span>
        </div>

        {/* Step 1: Target Selection */}
        {step === 'target' && (
          <div className="send-harness-body">
            <CascadeSelect
              label="Environment"
              placeholder="Select environment..."
              value={envId}
              onChange={handleEnvChange}
              options={envOptions}
              settingsHint="Need a new environment? Go to Settings to create one."
            />

            <CascadeSelect
              label="Microservice"
              placeholder={envReady ? 'Select microservice...' : 'Select environment first...'}
              value={svcId}
              onChange={setSvcId}
              options={filteredMicroservices.map(s => ({ id: s.id, name: s.name }))}
              settingsHint="Need a new microservice? Go to Settings to create one."
            />
          </div>
        )}

        {/* Step 2: Requests & Options */}
        {step === 'options' && (
          <div className="send-harness-body">
            {/* Target breadcrumb */}
            <div className="send-harness-target-summary">
              <span className="send-harness-summary-item send-harness-summary-env">{targetSummary.envName}</span>
              <span className="send-harness-summary-sep">/</span>
              <span className="send-harness-summary-item send-harness-summary-svc">{targetSummary.svcName}</span>
              <span className="send-harness-summary-sep">/</span>
              <span className="send-harness-summary-item">{collection.name}</span>
            </div>

            {/* Request list */}
            <div className="send-harness-section">
              <div className="batch-harness-list-header">
                <label className="send-harness-label">
                  Requests
                  <span className="batch-harness-count">{selectedIds.size}/{allRequests.length}</span>
                </label>
                <button className="batch-harness-toggle-btn" onClick={toggleAll}>
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="batch-harness-list" ref={listRef}>
                {allRequests.map(req => {
                  const checked = selectedIds.has(req.id);
                  return (
                    <label key={req.id} className={`batch-harness-row${checked ? ' selected' : ''}`}>
                      <span className={`batch-harness-checkbox${checked ? ' checked' : ''}`}>
                        {checked && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      <input type="checkbox" checked={checked} onChange={() => toggleRequest(req.id)} className="batch-harness-hidden-input" />
                      <span className="batch-harness-method" style={{ color: SWAGGER_METHOD_COLORS[req.method] || '#94a3b8' }}>
                        {req.method}
                      </span>
                      <span className="batch-harness-name" title={req.name || req.url || 'Untitled'}>
                        {req.name || req.url || 'Untitled'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Preview summary */}
            <div className="send-harness-preview-card">
              <span className="batch-harness-preview-text">
                Will create <strong>1 Feature Group</strong>,{' '}
                <strong>{scenarioCount} Test Scenario{scenarioCount !== 1 ? 's' : ''}</strong>,{' '}
                <strong>{selectedIds.size} test{selectedIds.size !== 1 ? 's' : ''}</strong>
              </span>
            </div>

            {/* Options */}
            <HarnessOptionsGrid
              authMode={authMode} setAuthMode={setAuthMode}
              validationPreset={validationPreset} setValidationPreset={setValidationPreset}
              snapshotDesc="Freeze current auth config"
            />
          </div>
        )}

        {/* Footer */}
        <div className="send-harness-footer">
          <button className="send-harness-cancel-btn" onClick={onClose}>Cancel</button>
          <div className="send-harness-footer-right">
            {step === 'options' && (
              <button className="send-harness-back-btn" onClick={() => setStep('target')}>Back</button>
            )}
            {step === 'target' && (
              <button
                className="send-harness-next-btn"
                disabled={!canProceed}
                onClick={() => setStep('options')}
              >
                Next
              </button>
            )}
            {step === 'options' && (
              <button
                className="send-harness-confirm-btn"
                disabled={noneSelected}
                onClick={() => onConfirm({
                  collectionId: collection.id,
                  selectedRequestIds: selectedIds,
                  validationPreset,
                  authMode,
                  environmentId: envId || undefined,
                  microserviceId: svcId || undefined,
                })}
              >
                Send {selectedIds.size} to Harness
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
