import { useEffect, useMemo, useState } from 'react';
import type { GrpcCallType, GrpcTlsMode } from '@shared/grpc/contracts';
import { loadGrpcConnectionProfilesFromStorage } from '@engine/grpc/grpcConnectionProfileHydration';
import { validateResolvedGrpcTargetAddress } from '@shared/grpc/targetValidation';
import type { GrpcConnectionProfile } from '@grpc/utils/resolveGrpcTabConnection';
import { useGrpcWorkflowTargetReflection } from '../../hooks/useGrpcWorkflowTargetReflection';
import type { GrpcWorkflowBaseConfig } from '../../types/workflow/node-grpc';
import { buildGrpcWorkflowReflectionPatch, listGrpcWorkflowMethods } from '../../utils/grpcWorkflowReflection';
import { CustomSelect } from '@shared/components/CustomSelect';
import { KafkaFormRow } from './KafkaConfigUi';

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

  const statusTone = status === 'ready'
    ? 'ready'
    : status === 'loading'
      ? 'loading'
      : status === 'error' || (data.target.trim() && !targetValidation.valid)
        ? 'error'
        : 'idle';

  return (
    <>
      <KafkaFormRow label="Target" hint="host:port or {{var}}" compact>
        <input
          className="wf-kafka-form-input"
          data-testid={`${testIdPrefix}-target`}
          value={data.target}
          onChange={(e) => update({ target: e.target.value } as Partial<T>)}
          placeholder="127.0.0.1:50051"
          aria-label="gRPC target"
        />
      </KafkaFormRow>

      <KafkaFormRow
        label="Schema"
        hint={status === 'error' ? 'Retry reflection' : 'From server reflection'}
        compact
      >
        <div
          className="wf-grpc-schema-status"
          data-testid={`${testIdPrefix}-reflect-status`}
          data-status={status}
        >
          <span className={`wf-grpc-schema-chip wf-grpc-schema-chip--${statusTone}`}>
            {status === 'ready' ? 'Ready' : status === 'loading' ? 'Loading' : status === 'error' ? 'Error' : 'Idle'}
          </span>
          <span className="wf-grpc-schema-detail">{statusLabel}</span>
          {status === 'error' && (
            <button
              type="button"
              className="btn-ghost wf-grpc-schema-retry"
              data-testid={`${testIdPrefix}-reflect-retry`}
              onClick={() => { void reflectNow(); }}
            >
              Retry
            </button>
          )}
        </div>
      </KafkaFormRow>

      <KafkaFormRow
        label="Descriptor"
        hint={descriptorAutoManaged ? 'Locked from reflection' : 'Auto-filled after reflect'}
        compact
      >
        <div className="wf-grpc-descriptor-ctrl">
          <input
            className="wf-kafka-form-input"
            data-testid={`${testIdPrefix}-descriptor-key`}
            value={data.descriptorKey}
            readOnly={descriptorAutoManaged}
            aria-readonly={descriptorAutoManaged || undefined}
            title={data.descriptorKey || undefined}
            onChange={(e) => {
              if (descriptorAutoManaged) return;
              update({ descriptorKey: e.target.value } as Partial<T>);
            }}
            placeholder="Auto-filled after reflection"
            aria-label="Descriptor key"
          />
          {descriptorAutoManaged && (
            <button
              type="button"
              className="btn-ghost wf-config-copy-btn"
              onClick={() => { void handleCopyDescriptorKey(); }}
              title="Copy descriptor key"
            >
              {descriptorCopied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </KafkaFormRow>

      <KafkaFormRow label="Profile" hint="Optional saved connection" compact>
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
      </KafkaFormRow>

      <KafkaFormRow label="Service" hint={useServiceSelect ? 'From reflection' : 'package.Service'} compact>
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
            className="wf-kafka-form-input"
            data-testid={`${testIdPrefix}-service`}
            value={data.service}
            onChange={(e) => update({ service: e.target.value } as Partial<T>)}
            placeholder="package.Service"
            aria-label="gRPC service"
          />
        )}
      </KafkaFormRow>

      <KafkaFormRow label="Method" hint={useMethodSelect ? 'Unary methods' : 'MethodName'} compact>
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
            className="wf-kafka-form-input"
            data-testid={`${testIdPrefix}-method`}
            value={data.method}
            onChange={(e) => update({ method: e.target.value } as Partial<T>)}
            placeholder="MethodName"
            aria-label="gRPC method"
          />
        )}
      </KafkaFormRow>
    </>
  );
}
