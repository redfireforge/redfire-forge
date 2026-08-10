import { useEffect, useState } from 'react';
import type { GlobalAuthProfile } from '../../../../shared/types';
import type { GrpcUnaryNodeData } from '../../types/workflow/node-grpc';
import GrpcWorkflowCallTargetFields from './GrpcWorkflowCallTargetFields';
import GrpcWorkflowConnectionSecurityFields from './GrpcWorkflowConnectionSecurityFields';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { KafkaCard, KafkaFormRow } from './KafkaConfigUi';

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
    <div className="wf-config-body wf-grpc-unary-config" data-testid="grpc-unary-config">
      <KafkaCard
        title="Call"
        hint="Target, schema, and RPC selection for this unary step."
      >
        <div className="wf-kafka-form wf-kafka-form--grpc">
          <KafkaFormRow label="Label" hint="Canvas node title" compact>
            <input
              className="wf-kafka-form-input"
              data-testid="grpc-unary-config-label"
              value={data.label}
              onChange={(e) => update({ label: e.target.value })}
              aria-label="gRPC Unary label"
            />
          </KafkaFormRow>

          <GrpcWorkflowCallTargetFields
            data={data}
            onChange={onChange}
            callType="unary"
            testIdPrefix="grpc-unary-config"
            workflowVariables={workflowVariables}
          />
        </div>
      </KafkaCard>

      <KafkaCard
        title="Security"
        hint="TLS and authentication applied to this call."
      >
        <div className="wf-kafka-form wf-kafka-form--grpc">
          <GrpcWorkflowConnectionSecurityFields
            data={data}
            onChange={onChange}
            testIdPrefix="grpc-unary-config"
            globalAuthProfiles={globalAuthProfiles}
            defaultAuthProfileId={defaultAuthProfileId}
          />
        </div>
      </KafkaCard>

      <KafkaCard
        title="Behavior"
        hint="Timeout, failure policy, and optional response alias."
      >
        <div className="wf-kafka-form wf-kafka-form--grpc">
          <KafkaFormRow label="Timeout" hint="0 = default (30s)" compact>
            <div className="wf-grpc-timeout-ctrl">
              <input
                className="wf-kafka-form-input"
                type="number"
                min={0}
                step={1000}
                data-testid="grpc-unary-config-timeout"
                value={data.timeoutMs ?? ''}
                onChange={(e) => update({
                  timeoutMs: e.target.value === '' ? undefined : Number(e.target.value),
                })}
                placeholder="30000"
                aria-label="Timeout (ms)"
              />
              <span className="unit">ms</span>
            </div>
          </KafkaFormRow>

          <KafkaFormRow label="On Error" hint="Workflow continues or fails" compact>
            <CustomSelect
              data-testid="grpc-unary-config-on-error"
              value={data.onError ?? 'fail'}
              onChange={(v) => update({ onError: v as 'fail' | 'continue' })}
              options={[
                { value: 'fail', label: 'Fail workflow' },
                { value: 'continue', label: 'Continue workflow' },
              ]}
            />
          </KafkaFormRow>

          <KafkaFormRow label="Save As" hint="Optional response alias" compact>
            <input
              className="wf-kafka-form-input"
              data-testid="grpc-unary-config-save-as"
              value={data.saveAs ?? ''}
              onChange={(e) => update({ saveAs: e.target.value || undefined })}
              placeholder="Optional alias"
              aria-label="Save As"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Payload"
        hint="Request body and metadata sent with the unary call."
        hintBelow
      >
        <div className="wf-grpc-payload">
          <div className="wf-grpc-code-field">
            <div className="wf-grpc-code-toolbar">
              <span className="wf-grpc-code-toolbar-label">Request Body</span>
              <span className="wf-grpc-code-toolbar-hint">JSON object</span>
            </div>
            <textarea
              className="wf-config-textarea wf-grpc-code-editor"
              data-testid="grpc-unary-config-body"
              rows={5}
              value={bodyText}
              onChange={(e) => {
                const value = e.target.value;
                setBodyText(value);
                applyObjectField(value, 'body');
              }}
              placeholder="{}"
              spellCheck={false}
            />
          </div>

          <div className="wf-grpc-code-field">
            <div className="wf-grpc-code-toolbar">
              <span className="wf-grpc-code-toolbar-label">Metadata</span>
              <span className="wf-grpc-code-toolbar-hint">JSON object — gRPC headers</span>
            </div>
            <textarea
              className="wf-config-textarea wf-grpc-code-editor"
              data-testid="grpc-unary-config-metadata"
              rows={3}
              value={metadataText}
              onChange={(e) => {
                const value = e.target.value;
                setMetadataText(value);
                applyObjectField(value, 'metadata');
              }}
              placeholder='{"x-correlation-id":"abc"}'
              spellCheck={false}
            />
          </div>
        </div>
      </KafkaCard>
    </div>
  );
}
