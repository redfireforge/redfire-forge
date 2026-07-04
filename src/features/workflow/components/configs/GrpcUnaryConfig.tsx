import { useEffect, useState } from 'react';
import type { GrpcUnaryNodeData } from '../../types/workflow/node-grpc';

export default function GrpcUnaryConfig({
  data,
  onChange,
}: {
  data: GrpcUnaryNodeData;
  onChange: (d: GrpcUnaryNodeData) => void;
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
        <input value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>
      <div className="wf-config-field--row">
        <label>Target</label>
        <input value={data.target} onChange={(e) => update({ target: e.target.value })} placeholder="127.0.0.1:50051" />
      </div>
      <div className="wf-config-field--row">
        <label>Descriptor Key</label>
        <input value={data.descriptorKey} onChange={(e) => update({ descriptorKey: e.target.value })} />
      </div>
      <div className="wf-config-field--row">
        <label>Service</label>
        <input value={data.service} onChange={(e) => update({ service: e.target.value })} placeholder="package.Service" />
      </div>
      <div className="wf-config-field--row">
        <label>Method</label>
        <input value={data.method} onChange={(e) => update({ method: e.target.value })} placeholder="MethodName" />
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
        <select value={data.onError ?? 'fail'} onChange={(e) => update({ onError: e.target.value as 'fail' | 'continue' })}>
          <option value="fail">Fail workflow</option>
          <option value="continue">Continue workflow</option>
        </select>
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
