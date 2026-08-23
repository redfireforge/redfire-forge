import { useEffect, useState } from 'react';
import type { GlobalAuthProfile } from '@shared/types';
import type { GrpcLoadTestNodeData } from '../../types/workflow/node-grpc-advanced';
import GrpcWorkflowCallTargetFields from './GrpcWorkflowCallTargetFields';
import GrpcWorkflowConnectionSecurityFields from './GrpcWorkflowConnectionSecurityFields';
import { CustomSelect } from '@shared/components/CustomSelect';

export default function GrpcLoadTestConfig({
  data,
  onChange,
  globalAuthProfiles = [],
  defaultAuthProfileId = null,
  workflowVariables = {},
}: {
  data: GrpcLoadTestNodeData;
  onChange: (d: GrpcLoadTestNodeData) => void;
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultAuthProfileId?: string | null;
  workflowVariables?: Record<string, string>;
}) {
  const [bodyText, setBodyText] = useState(() => JSON.stringify(data.body ?? {}, null, 2));
  const [loadTestText, setLoadTestText] = useState(() => JSON.stringify(data.loadTest ?? {}, null, 2));

  useEffect(() => {
    setBodyText(JSON.stringify(data.body ?? {}, null, 2));
  }, [data.body]);

  useEffect(() => {
    setLoadTestText(JSON.stringify(data.loadTest ?? {}, null, 2));
  }, [data.loadTest]);

  const update = (patch: Partial<GrpcLoadTestNodeData>) => onChange({ ...data, ...patch });

  const applyBody = (value: string) => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        update({ body: parsed as Record<string, unknown> });
      }
    } catch {
      // Keep typed text until valid JSON.
    }
  };

  const applyLoadTest = (value: string) => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        update({ loadTest: parsed as NonNullable<GrpcLoadTestNodeData['loadTest']> });
      }
    } catch {
      // Keep typed text until valid JSON.
    }
  };

  return (
    <div className="wf-config-body" data-testid="grpc-load-test-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>

      <div className="wf-kafka-form wf-kafka-form--grpc wf-kafka-form--flush-top">
        <GrpcWorkflowCallTargetFields
          data={data}
          onChange={onChange}
          callType="unary"
          testIdPrefix="grpc-load-test-config"
          workflowVariables={workflowVariables}
        />
      </div>

      <div className="wf-kafka-form wf-kafka-form--grpc wf-kafka-form--flush-top">
        <GrpcWorkflowConnectionSecurityFields
          data={data}
          onChange={onChange}
          testIdPrefix="grpc-load-test-config"
          globalAuthProfiles={globalAuthProfiles}
          defaultAuthProfileId={defaultAuthProfileId}
        />
      </div>

      <div className="wf-config-field--row">
        <label>Profile ID</label>
        <input
          value={data.profileId ?? ''}
          onChange={(e) => update({ profileId: e.target.value || undefined })}
          placeholder="Optional profile id"
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
        <input
          value={data.saveAs ?? ''}
          onChange={(e) => update({ saveAs: e.target.value || undefined })}
          placeholder="Optional summary alias"
        />
      </div>

      <div className="wf-config-field">
        <label>Request Body (JSON object)</label>
        <textarea
          className="wf-config-textarea"
          rows={5}
          value={bodyText}
          onChange={(e) => {
            const value = e.target.value;
            setBodyText(value);
            applyBody(value);
          }}
          placeholder="{}"
        />
      </div>

      <div className="wf-config-field">
        <label>Load Test Config (JSON object)</label>
        <textarea
          className="wf-config-textarea"
          rows={5}
          value={loadTestText}
          onChange={(e) => {
            const value = e.target.value;
            setLoadTestText(value);
            applyLoadTest(value);
          }}
          placeholder='{"concurrency":1,"totalCalls":10}'
        />
      </div>
    </div>
  );
}
