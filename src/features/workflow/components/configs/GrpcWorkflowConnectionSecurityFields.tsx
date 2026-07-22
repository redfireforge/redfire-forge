import { useMemo, useState } from 'react';
import type { GrpcTlsConfig, GrpcTlsMode } from '../../../../shared/grpc/contracts';
import type { GlobalAuthProfile } from '../../../../shared/types';
import { GrpcTlsConfigBody } from '../../../grpc/components/GrpcTlsConfigBody';
import { GrpcAuthPanel } from '../../../grpc/components/GrpcAuthPanel';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { useGrpcTls } from '../../../grpc/hooks/useGrpcTls';
import { buildGrpcAuthPreviewWithProfiles } from '../../../grpc/utils/grpcAuthProfileResolve';
import type { GrpcWorkflowBaseConfig } from '../../types/workflow/node-grpc';

const TLS_MODE_OPTIONS: Array<{ value: GrpcTlsMode; label: string }> = [
  { value: 'disabled', label: 'Plaintext' },
  { value: 'tls', label: 'TLS' },
  { value: 'mtls', label: 'mTLS' },
];

export default function GrpcWorkflowConnectionSecurityFields<T extends GrpcWorkflowBaseConfig>({
  data,
  onChange,
  testIdPrefix,
  globalAuthProfiles = [],
  defaultAuthProfileId = null,
}: {
  data: T;
  onChange: (next: T) => void;
  testIdPrefix: string;
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultAuthProfileId?: string | null;
}) {
  const tlsMode: GrpcTlsMode = data.tlsMode ?? 'disabled';
  const [tlsExpanded, setTlsExpanded] = useState(tlsMode !== 'disabled');
  const targetPreview = data.target.trim() || 'localhost:50051';
  const { issues: tlsIssues } = useGrpcTls(tlsMode, data.tlsConfig, targetPreview);

  const authPreviewState = useMemo(
    () => buildGrpcAuthPreviewWithProfiles(
      data.metadata ?? {},
      data.auth,
      globalAuthProfiles,
      defaultAuthProfileId,
    ),
    [data.auth, data.metadata, defaultAuthProfileId, globalAuthProfiles],
  );

  const update = (patch: Partial<T>) => onChange({ ...data, ...patch });

  const handleTlsModeChange = (mode: GrpcTlsMode) => {
    update({ tlsMode: mode } as Partial<T>);
    if (mode !== 'disabled') {
      setTlsExpanded(true);
    }
  };

  const handleTlsConfigChange = (patch: Partial<GrpcTlsConfig>) => {
    update({
      tlsConfig: { ...(data.tlsConfig ?? {}), ...patch },
    } as Partial<T>);
  };

  return (
    <>
      <div className="wf-config-field--row">
        <label>TLS mode</label>
        <div className="wf-config-inline-ctrls">
          <CustomSelect
            data-testid={`${testIdPrefix}-tls-mode`}
            value={tlsMode}
            onChange={(v) => handleTlsModeChange(v as GrpcTlsMode)}
            options={TLS_MODE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
          {tlsMode !== 'disabled' && (
            <button
              type="button"
              className="btn-ghost wf-config-inline-btn"
              data-testid={`${testIdPrefix}-tls-configure`}
              onClick={() => setTlsExpanded((open) => !open)}
            >
              {tlsExpanded ? 'Hide certificates' : 'Configure certificates'}
            </button>
          )}
        </div>
      </div>

      {tlsMode !== 'disabled' && tlsExpanded && (
        <div
          className="wf-config-field"
          data-testid={`${testIdPrefix}-tls-panel`}
        >
          <GrpcTlsConfigBody
            tlsMode={tlsMode}
            tlsConfig={data.tlsConfig}
            issues={tlsIssues}
            hideModePicker
            onTlsModeChange={handleTlsModeChange}
            onTlsConfigChange={handleTlsConfigChange}
          />
        </div>
      )}

      <div className="wf-config-field" data-testid={`${testIdPrefix}-auth-section`}>
        <label>Authentication</label>
        <GrpcAuthPanel
          auth={data.auth}
          preview={authPreviewState.preview}
          globalAuthProfiles={globalAuthProfiles}
          defaultAuthProfileId={defaultAuthProfileId}
          onChange={(auth) => update({ auth } as Partial<T>)}
        />
      </div>
    </>
  );
}
