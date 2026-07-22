import { useEffect, useState } from 'react';
import type { GrpcMockAssertNodeData } from '../../types/workflow/node-grpc-advanced';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

export default function GrpcMockAssertConfig({
  data,
  onChange,
}: {
  data: GrpcMockAssertNodeData;
  onChange: (d: GrpcMockAssertNodeData) => void;
}) {
  const [bodyText, setBodyText] = useState(() => JSON.stringify(data.body ?? {}, null, 2));
  const [metadataText, setMetadataText] = useState(() => JSON.stringify(data.metadata ?? {}, null, 2));
  const [expectedBodyValueText, setExpectedBodyValueText] = useState(() => {
    if (data.expectedBodyValue === undefined) return '';
    return JSON.stringify(data.expectedBodyValue, null, 2);
  });

  useEffect(() => {
    setBodyText(JSON.stringify(data.body ?? {}, null, 2));
  }, [data.body]);

  useEffect(() => {
    setMetadataText(JSON.stringify(data.metadata ?? {}, null, 2));
  }, [data.metadata]);

  useEffect(() => {
    if (data.expectedBodyValue === undefined) {
      setExpectedBodyValueText('');
      return;
    }
    setExpectedBodyValueText(JSON.stringify(data.expectedBodyValue, null, 2));
  }, [data.expectedBodyValue]);

  const update = (patch: Partial<GrpcMockAssertNodeData>) => onChange({ ...data, ...patch });

  const applyObjectField = (
    value: string,
    field: 'body' | 'metadata',
  ) => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        update({ [field]: parsed } as Partial<GrpcMockAssertNodeData>);
      }
    } catch {
      // Keep typed text until valid JSON.
    }
  };

  const applyExpectedBodyValue = (value: string) => {
    if (value.trim() === '') {
      update({ expectedBodyValue: undefined });
      return;
    }
    try {
      update({ expectedBodyValue: JSON.parse(value) });
    } catch {
      // Keep typed text until valid JSON.
    }
  };

  return (
    <div className="wf-config-body" data-testid="grpc-mock-assert-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>

      <div className="wf-config-field--row">
        <label>Listener Target</label>
        <input
          value={data.listenTarget}
          onChange={(e) => update({ listenTarget: e.target.value })}
          placeholder="127.0.0.1:50061"
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
        <label>Expected Status</label>
        <input
          type="number"
          value={data.expectedStatus ?? 0}
          onChange={(e) => update({ expectedStatus: Number(e.target.value) || 0 })}
        />
      </div>

      <div className="wf-config-field--row">
        <label>Expected Body Path</label>
        <input
          value={data.expectedBodyPath ?? ''}
          onChange={(e) => update({ expectedBodyPath: e.target.value || undefined })}
          placeholder="$.result.ok"
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

      <div className="wf-config-field">
        <label>Expected Body Value (JSON)</label>
        <textarea
          className="wf-config-textarea"
          rows={3}
          value={expectedBodyValueText}
          onChange={(e) => {
            const value = e.target.value;
            setExpectedBodyValueText(value);
            applyExpectedBodyValue(value);
          }}
          placeholder='{"ok":true}'
        />
      </div>
    </div>
  );
}
