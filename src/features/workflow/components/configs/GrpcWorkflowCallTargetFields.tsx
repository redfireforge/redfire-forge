import { useEffect, useMemo, useState } from 'react';
import type { GrpcCallType, GrpcTlsMode } from '../../../../shared/grpc/contracts';
import { loadGrpcConnectionProfilesFromStorage } from '../../../../engine/grpcConnectionProfileHydration';
import { validateResolvedGrpcTargetAddress } from '../../../../shared/grpc/targetValidation';
import type { GrpcConnectionProfile } from '../../../grpc/utils/resolveGrpcTabConnection';
import { useGrpcWorkflowTargetReflection } from '../../hooks/useGrpcWorkflowTargetReflection';
import type { GrpcWorkflowBaseConfig } from '../../types/workflow/node-grpc';
import { buildGrpcWorkflowReflectionPatch, listGrpcWorkflowMethods } from '../../utils/grpcWorkflowReflection';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

type GrpcWorkflowCallConfig = Pick<
  GrpcWorkflowBaseConfig,
  'target' | 'tlsMode' | 'connectionId' | 'descriptorKey' | 'service' | 'method'
>;

export default function GrpcWorkflowCallTargetFields<T extends GrpcWorkflowCallConfig>({
  data,
  onChange,
  callType,
  testIdPrefix,
  workflowVariables = {},
}: {
  data: T;
  onChange: (next: T) => void;
  callType: GrpcCallType;
  testIdPrefix: string;
  /** Workflow-level defaults — used to resolve `{{var}}` targets for design-time reflection. */
  workflowVariables?: Record<string, string>;
}) {
  const profiles = useMemo(() => loadGrpcConnectionProfilesFromStorage(), []);
  const tlsMode: GrpcTlsMode = data.tlsMode ?? 'disabled';
  const {
    descriptor,
    services,
    status,
    errorMessage,
    resolvedTarget,
    usedWorkflowDefaults,
    reflectNow,
  } = useGrpcWorkflowTargetReflection(
    data.target,
    tlsMode,
    workflowVariables,
  );
  const methods = listGrpcWorkflowMethods(descriptor, data.service, callType);
  const targetValidation = validateResolvedGrpcTargetAddress(resolvedTarget.trim());
  const useServiceSelect = services.length > 0;
  const useMethodSelect = useServiceSelect && Boolean(data.service) && methods.length > 0;
  const descriptorAutoManaged = status === 'ready' && Boolean(data.descriptorKey?.trim());
  const [descriptorCopied, setDescriptorCopied] = useState(false);

  useEffect(() => {
    if (!descriptor) return;
    const patch = buildGrpcWorkflowReflectionPatch(
      {
        descriptorKey: data.descriptorKey,
        service: data.service,
        method: data.method,
      },
      descriptor,
      callType,
    );
    if (Object.keys(patch).length === 0) return;
    onChange({ ...data, ...patch });
  }, [callType, data, descriptor, onChange]);

  const update = (patch: Partial<T>) => onChange({ ...data, ...patch });

  const handleCopyDescriptorKey = async () => {
    const descriptorKey = data.descriptorKey?.trim();
    if (!descriptorKey || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(descriptorKey);
      setDescriptorCopied(true);
      window.setTimeout(() => setDescriptorCopied(false), 1200);
    } catch {
      // Clipboard may be unavailable in restricted contexts; keep UI silent.
    }
  };

  const handleProfileChange = (connectionId: string) => {
    const profile = profiles.find((entry) => entry.id === connectionId);
    const patch: Partial<T> = {
      connectionId: connectionId || undefined,
    } as Partial<T>;
    if (profile) {
      if (!data.target.trim()) {
        (patch as Partial<GrpcWorkflowBaseConfig>).target = profile.target;
      }
      (patch as Partial<GrpcWorkflowBaseConfig>).tlsMode = profile.tlsMode;
    }
    update(patch);
  };

  const resolvedHint = usedWorkflowDefaults && resolvedTarget.trim()
    ? ` (via ${resolvedTarget.trim()})`
    : '';
  const statusLabel = status === 'loading'
    ? `Reflecting target${resolvedHint}…`
    : status === 'ready'
      ? `${services.length} service${services.length === 1 ? '' : 's'} loaded via reflection${resolvedHint}`
      : status === 'error'
        ? errorMessage ?? 'Reflection failed'
        : data.target.trim() && !targetValidation.valid
          ? usedWorkflowDefaults
            ? `Resolved target "${resolvedTarget.trim()}" is not a valid host:port`
            : 'Enter a valid host:port (or a workflow variable that resolves to one) to load services'
          : 'Service and method lists populate after reflection';

  return (
    <>
      <div className="wf-config-field--row">
        <label>Target</label>
        <input
          data-testid={`${testIdPrefix}-target`}
          value={data.target}
          onChange={(e) => update({ target: e.target.value } as Partial<T>)}
          placeholder="127.0.0.1:50051"
        />
      </div>

      <div
        className="wf-config-field--row"
        data-testid={`${testIdPrefix}-reflect-status`}
        data-status={status}
      >
        <label>Schema</label>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="wf-config-hint-text">{statusLabel}</span>
          {status === 'error' && (
            <button
              type="button"
              className="btn-ghost"
              data-testid={`${testIdPrefix}-reflect-retry`}
              onClick={() => { void reflectNow(); }}
            >
              Retry reflect
            </button>
          )}
        </div>
      </div>

      <div className="wf-config-field--row wf-config-field--row-top">
        <label>Descriptor key</label>
        <div className="wf-config-row-stack">
          {descriptorAutoManaged ? (
            <div className="wf-config-readonly-row">
              <textarea
                className="wf-config-textarea wf-config-descriptor-textarea wf-config-textarea--readonly"
                data-testid={`${testIdPrefix}-descriptor-key`}
                rows={1}
                value={data.descriptorKey}
                readOnly
                aria-readonly="true"
                title={data.descriptorKey}
              />
              <button
                type="button"
                className="btn-ghost wf-config-copy-btn"
                onClick={() => { void handleCopyDescriptorKey(); }}
                title="Copy descriptor key"
              >
                {descriptorCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <textarea
              className="wf-config-textarea wf-config-descriptor-textarea"
              data-testid={`${testIdPrefix}-descriptor-key`}
              rows={1}
              value={data.descriptorKey}
              onChange={(e) => {
                update({ descriptorKey: e.target.value } as Partial<T>);
              }}
              placeholder="Auto-filled after reflection"
            />
          )}
          {descriptorAutoManaged && (
            <span className="wf-config-hint-text wf-config-hint-text--below">
              <strong>Managed automatically:</strong> locked while schema is loaded from reflection
            </span>
          )}
        </div>
      </div>

      <div className="wf-config-field--row">
        <label>Connection profile</label>
        <CustomSelect
          data-testid={`${testIdPrefix}-connection-profile`}
          value={data.connectionId ?? ''}
          onChange={(v) => handleProfileChange(v)}
          placeholder="Custom target…"
          options={[
            { value: '', label: 'Custom target…' },
            ...profiles.map((profile: GrpcConnectionProfile) => ({
              value: profile.id,
              label: `${profile.name} (${profile.target || 'no target'})`,
            })),
          ]}
        />
      </div>

      <div className="wf-config-field--row">
        <label>Service</label>
        {useServiceSelect ? (
          <CustomSelect
            data-testid={`${testIdPrefix}-service`}
            value={data.service}
            onChange={(v) => update({ service: v, method: '' } as Partial<T>)}
            placeholder="Select service…"
            options={[
              { value: '', label: 'Select service…' },
              ...services.map((service) => ({ value: service.fullName, label: service.fullName })),
            ]}
          />
        ) : (
          <input
            data-testid={`${testIdPrefix}-service`}
            value={data.service}
            onChange={(e) => update({ service: e.target.value } as Partial<T>)}
            placeholder="package.Service"
          />
        )}
      </div>

      <div className="wf-config-field--row">
        <label>Method</label>
        {useMethodSelect ? (
          <CustomSelect
            data-testid={`${testIdPrefix}-method`}
            value={data.method}
            onChange={(v) => update({ method: v } as Partial<T>)}
            placeholder="Select method…"
            options={[
              { value: '', label: 'Select method…' },
              ...methods.map((method) => ({
                value: method.name,
                label: `${method.name} (${method.callType.replace('_', ' ')})`,
              })),
            ]}
          />
        ) : (
          <input
            data-testid={`${testIdPrefix}-method`}
            value={data.method}
            onChange={(e) => update({ method: e.target.value } as Partial<T>)}
            placeholder="MethodName"
          />
        )}
      </div>
    </>
  );
}
