import { useEffect, useState } from 'react';
import type { GrpcLoadTestNodeData } from '../../types/workflow/node-grpc-advanced';

export default function GrpcLoadTestConfig({
  data,
  onChange,
}: {
  data: GrpcLoadTestNodeData;
  onChange: (d: GrpcLoadTestNodeData) => void;
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

      <div className="wf-config-field--row">
        <label>Target</label>
        <input
          value={data.target}
          onChange={(e) => update({ target: e.target.value })}
          placeholder="127.0.0.1:50051 or {{grpcHost}}"
        />
      </div>

      <div className="wf-config-field--row">
        <label>Descriptor Key</label>
        <input
          value={data.descriptorKey}
          onChange={(e) => update({ descriptorKey: e.target.value })}
          placeholder="descriptor key"
        />
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
        <select
          value={data.onError ?? 'fail'}
          onChange={(e) => update({ onError: e.target.value as 'fail' | 'continue' })}
        >
          <option value="fail">Fail workflow</option>
          <option value="continue">Continue workflow</option>
        </select>
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
