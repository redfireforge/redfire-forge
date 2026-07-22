import { useEffect, useState } from 'react';
import type { GlobalAuthProfile } from '../../../../shared/types';
import type { GrpcUnaryNodeData } from '../../types/workflow/node-grpc';
import GrpcWorkflowCallTargetFields from './GrpcWorkflowCallTargetFields';
import GrpcWorkflowConnectionSecurityFields from './GrpcWorkflowConnectionSecurityFields';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

export default function GrpcUnaryConfig({
  data,
  onChange,
  globalAuthProfiles = [],
  defaultAuthProfileId = null,
  workflowVariables = {},
}: {
  data: GrpcUnaryNodeData;
  onChange: (d: GrpcUnaryNodeData) => void;
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultAuthProfileId?: string | null;
  workflowVariables?: Record<string, string>;
}) {
  const [bodyText, setBodyText] = useState(() => JSON.stringify(data.body ?? {}, null, 2));
  const [metadataText, setMetadataText] = useState(() => JSON.stringify(data.metadata ?? {}, null, 2));

  useEffect(() => {
    setBodyText(JSON.stringify(data.body ?? {}, null, 2));
  }, [data.body]);

  useEffect(() => {
    setMetadataText(JSON.stringify(data.metadata ?? {}, null, 2));
  }, [data.metadata]);

  const update = (patch: Partial<GrpcUnaryNodeData>) => onChange({ ...data, ...patch });

  const applyObjectField = (value: string, field: 'body' | 'metadata') => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        update({ [field]: parsed } as Partial<GrpcUnaryNodeData>);
      }
    } catch {
      // Keep typed text until valid JSON.
    }
  };

  return (
    <div className="wf-config-body" data-testid="grpc-unary-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input data-testid="grpc-unary-config-label" value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>

      <GrpcWorkflowCallTargetFields
        data={data}
        onChange={onChange}
        callType="unary"
        testIdPrefix="grpc-unary-config"
        workflowVariables={workflowVariables}
      />

      <GrpcWorkflowConnectionSecurityFields
        data={data}
        onChange={onChange}
        testIdPrefix="grpc-unary-config"
        globalAuthProfiles={globalAuthProfiles}
        defaultAuthProfileId={defaultAuthProfileId}
      />

      <div className="wf-config-field--row">
        <label>Timeout (ms)</label>
        <input
          type="number"
          data-testid="grpc-unary-config-timeout"
          value={data.timeoutMs ?? ''}
          onChange={(e) => update({ timeoutMs: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="30000"
        />
      </div>
      <div className="wf-config-field--row">
        <label>On Error</label>
        <CustomSelect
          data-testid="grpc-unary-config-on-error"
          value={data.onError ?? 'fail'}
          onChange={(v) => update({ onError: v as 'fail' | 'continue' })}
          options={[
            { value: 'fail', label: 'Fail workflow' },
            { value: 'continue', label: 'Continue workflow' },
          ]}
        />
      </div>
      <div className="wf-config-field--row">
        <label>Save As</label>
        <input data-testid="grpc-unary-config-save-as" value={data.saveAs ?? ''} onChange={(e) => update({ saveAs: e.target.value || undefined })} placeholder="Optional alias" />
      </div>
      <div className="wf-config-field">
        <label>Request Body (JSON object)</label>
        <textarea
          className="wf-config-textarea"
          data-testid="grpc-unary-config-body"
          rows={4}
          value={bodyText}
          onChange={(e) => {
            const value = e.target.value;
            setBodyText(value);
            applyObjectField(value, 'body');
          }}
          placeholder="{}"
        />
      </div>
      <div className="wf-config-field">
        <label>Metadata (JSON object)</label>
        <textarea
          className="wf-config-textarea"
          data-testid="grpc-unary-config-metadata"
          rows={3}
          value={metadataText}
          onChange={(e) => {
            const value = e.target.value;
            setMetadataText(value);
            applyObjectField(value, 'metadata');
          }}
          placeholder='{"x-correlation-id":"abc"}'
        />
      </div>
    </div>
  );
}
