import { useEffect, useState } from 'react';
import type { GrpcAssertNodeData } from '../../types/workflow/node-grpc';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

export default function GrpcAssertConfig({
  data,
  onChange,
}: {
  data: GrpcAssertNodeData;
  onChange: (d: GrpcAssertNodeData) => void;
}) {
  const [assertionsText, setAssertionsText] = useState(() => JSON.stringify(data.assertions ?? [], null, 2));

  useEffect(() => {
    setAssertionsText(JSON.stringify(data.assertions ?? [], null, 2));
  }, [data.assertions]);

  const update = (patch: Partial<GrpcAssertNodeData>) => onChange({ ...data, ...patch });

  const applyAssertions = (value: string) => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        update({ assertions: parsed as GrpcAssertNodeData['assertions'] });
      }
    } catch {
      // Keep typed text until valid JSON.
    }
  };

  return (
    <div className="wf-config-body wf-grpc-assert-config-body" data-testid="grpc-assert-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input data-testid="grpc-assert-config-label" value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>
      <div className="wf-config-field--row">
        <label>Source</label>
        <input
          data-testid="grpc-assert-config-source"
          value={data.source}
          onChange={(e) => update({ source: e.target.value })}
          placeholder="Upstream gRPC node id or saveAs alias"
        />
      </div>
      <div className="wf-config-field--row">
        <label>On Error</label>
        <CustomSelect
          data-testid="grpc-assert-config-on-error"
          value={data.onError ?? 'fail'}
          onChange={(v) => update({ onError: v as 'fail' | 'continue' })}
          options={[
            { value: 'fail', label: 'Fail workflow' },
            { value: 'continue', label: 'Continue workflow' },
          ]}
        />
      </div>
      <div className="wf-config-field wf-grpc-assertions-field">
        <label>Assertions (JSON array)</label>
        <textarea
          className="wf-config-textarea wf-grpc-assertions-textarea"
          data-testid="grpc-assert-config-assertions"
          rows={12}
          value={assertionsText}
          onChange={(e) => {
            const value = e.target.value;
            setAssertionsText(value);
            applyAssertions(value);
          }}
          placeholder='[{"grpcStatus":0}]'
        />
      </div>
    </div>
  );
}
