import { useEffect, useState } from 'react';
import type { GlobalAuthProfile } from '../../../../shared/types';
import type { GrpcServerStreamNodeData } from '../../types/workflow/node-grpc';
import GrpcWorkflowCallTargetFields from './GrpcWorkflowCallTargetFields';
import GrpcWorkflowConnectionSecurityFields from './GrpcWorkflowConnectionSecurityFields';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

export default function GrpcServerStreamConfig({
  data,
  onChange,
  globalAuthProfiles = [],
  defaultAuthProfileId = null,
  workflowVariables = {},
}: {
  data: GrpcServerStreamNodeData;
  onChange: (d: GrpcServerStreamNodeData) => void;
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

  const update = (patch: Partial<GrpcServerStreamNodeData>) => onChange({ ...data, ...patch });

  const applyObjectField = (value: string, field: 'body' | 'metadata') => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        update({ [field]: parsed } as Partial<GrpcServerStreamNodeData>);
      }
    } catch {
      // Keep typed text until valid JSON.
    }
  };

  return (
    <div className="wf-config-body" data-testid="grpc-server-stream-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>

      <div className="wf-kafka-form wf-kafka-form--grpc wf-kafka-form--flush-top">
        <GrpcWorkflowCallTargetFields
          data={data}
          onChange={onChange}
          callType="server_streaming"
          testIdPrefix="grpc-server-stream-config"
          workflowVariables={workflowVariables}
        />
      </div>

      <div className="wf-kafka-form wf-kafka-form--grpc wf-kafka-form--flush-top">
        <GrpcWorkflowConnectionSecurityFields
          data={data}
          onChange={onChange}
          testIdPrefix="grpc-server-stream-config"
          globalAuthProfiles={globalAuthProfiles}
          defaultAuthProfileId={defaultAuthProfileId}
        />
      </div>

      <div className="wf-config-field--row">
        <label>Timeout (ms)</label>
        <input
          type="number"
          value={data.timeoutMs ?? ''}
          onChange={(e) => update({ timeoutMs: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="30000"
        />
      </div>
      <div className="wf-config-field--row">
        <label>Collect Max Messages</label>
        <input
          type="number"
          value={data.collect.maxMessages ?? ''}
          onChange={(e) => update({ collect: { ...data.collect, maxMessages: e.target.value === '' ? undefined : Number(e.target.value) } })}
          placeholder="10"
        />
      </div>
      <div className="wf-config-field--row">
        <label>Collect Max Duration (ms)</label>
        <input
          type="number"
          value={data.collect.maxDurationMs ?? ''}
          onChange={(e) => update({ collect: { ...data.collect, maxDurationMs: e.target.value === '' ? undefined : Number(e.target.value) } })}
          placeholder="30000"
        />
      </div>
      <div className="wf-config-field--row">
        <label>Collect Until Expression</label>
        <input
          value={data.collect.untilExpression ?? ''}
          onChange={(e) => update({ collect: { ...data.collect, untilExpression: e.target.value || undefined } })}
          placeholder="e.g. {{grpc.stream.count}} >= 5"
        />
      </div>
      <div className="wf-config-field--row">
        <label>On Error</label>
        <CustomSelect
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
        <input value={data.saveAs ?? ''} onChange={(e) => update({ saveAs: e.target.value || undefined })} placeholder="Optional alias" />
      </div>
      <div className="wf-config-field">
        <label>Request Body (JSON object)</label>
        <textarea
          className="wf-config-textarea"
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
