interface Props {
  variables: Record<string, string>;
}

export default function VariableContextBar({ variables }: Props) {
  const entries = Object.entries(variables);
  if (entries.length === 0) return null;

  return (
    <div className="wf-var-bar">
      <span className="wf-var-bar-title">Variables</span>
      <div className="wf-var-bar-chips">
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
