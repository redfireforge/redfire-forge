interface Props {
  variables: Record<string, string>;
  label?: string;
}

export default function VariablePanel({ variables, label }: Props) {
  const entries = Object.entries(variables);
  if (entries.length === 0) return null;

  return (
    <div className="var-panel">
      <div className="var-panel-title">{label ?? 'Workflow Variables'}</div>
      <div className="var-panel-grid">
        {entries.map(([name, value]) => (
          <span key={name} className="var-chip">
            <span className="var-chip-name">{`{{${name}}}`}</span>
            <span className="var-chip-eq">=</span>
            <span className="var-chip-val" title={value}>{value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
