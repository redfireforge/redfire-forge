import type { GrpcSchemaDiffNodeData } from '../../types/workflow/node-grpc-advanced';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

export default function GrpcSchemaDiffConfig({
  data,
  onChange,
}: {
  data: GrpcSchemaDiffNodeData;
  onChange: (d: GrpcSchemaDiffNodeData) => void;
}) {
  const update = (patch: Partial<GrpcSchemaDiffNodeData>) => onChange({ ...data, ...patch });

  return (
    <div className="wf-config-body" data-testid="grpc-schema-diff-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>

      <div className="wf-config-field--row">
        <label>Left Descriptor Key</label>
        <input
          value={data.leftDescriptorKey}
          onChange={(e) => update({ leftDescriptorKey: e.target.value })}
          placeholder="baseline descriptor key"
        />
      </div>

      <div className="wf-config-field--row">
        <label>Right Descriptor Key</label>
        <input
          value={data.rightDescriptorKey}
          onChange={(e) => update({ rightDescriptorKey: e.target.value })}
          placeholder="candidate descriptor key"
        />
      </div>

      <div className="wf-config-field--row">
        <label>Fail On Breaking</label>
        <input
          type="checkbox"
          checked={data.failOnBreaking !== false}
          onChange={(e) => update({ failOnBreaking: e.target.checked })}
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
    </div>
  );
}
