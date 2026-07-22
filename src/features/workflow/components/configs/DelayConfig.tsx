import type { DelayNodeData } from '../../types/workflow';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

export default function DelayConfig({ data, onChange }: { data: DelayNodeData; onChange: (d: DelayNodeData) => void }) {
  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>
      <div className="wf-config-field">
        <label>Mode</label>
        <CustomSelect
          value={data.mode}
          onChange={(v) => onChange({ ...data, mode: v as 'fixed' | 'random' })}
          options={[
            { value: 'fixed', label: 'Fixed' },
            { value: 'random', label: 'Random Range' },
          ]}
        />
      </div>
      {data.mode === 'fixed' && (
        <div className="wf-config-field">
          <label>Delay (ms)</label>
          <input type="number" min={0} max={60000} value={data.delayMs} onChange={(e) => onChange({ ...data, delayMs: parseInt(e.target.value) || 0 })} />
        </div>
      )}
      {data.mode === 'random' && (
        <>
          <div className="wf-config-field">
            <label>Min (ms)</label>
            <input type="number" min={0} value={data.minMs ?? 0} onChange={(e) => onChange({ ...data, minMs: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="wf-config-field">
            <label>Max (ms)</label>
            <input type="number" min={0} value={data.maxMs ?? data.delayMs} onChange={(e) => onChange({ ...data, maxMs: parseInt(e.target.value) || 0 })} />
          </div>
        </>
      )}
    </div>
  );
}
