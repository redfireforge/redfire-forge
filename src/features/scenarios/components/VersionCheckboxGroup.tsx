interface VersionCounts {
  responseVersionCount: number;
  rulesVersionCount: number;
  definitionVersionCount: number;
  structureLogCount: number;
}

interface VersionToggles {
  responseVersions: boolean;
  rulesVersions: boolean;
  definitionVersions: boolean;
  structureLog: boolean;
}

interface Props {
  counts: VersionCounts;
  values: VersionToggles;
  onChange: (next: VersionToggles) => void;
}

/** Shared checkbox pair for response/rules version toggles — used by export popover, import modal, and settings tab. */
export default function VersionCheckboxGroup({ counts, values, onChange }: Props) {
  return (
    <>
      <label className="export-opts-check">
        <input
          type="checkbox"
          checked={values.responseVersions}
          onChange={(e) => onChange({ ...values, responseVersions: e.target.checked })}
        />
        <span>Response Versions</span>
        <span className="export-opts-count">({counts.responseVersionCount})</span>
      </label>
      <label className="export-opts-check">
        <input
          type="checkbox"
          checked={values.rulesVersions}
          onChange={(e) => onChange({ ...values, rulesVersions: e.target.checked })}
        />
        <span>Rules Versions</span>
        <span className="export-opts-count">({counts.rulesVersionCount})</span>
      </label>
      <label className="export-opts-check">
        <input
          type="checkbox"
          checked={values.definitionVersions}
          onChange={(e) => onChange({ ...values, definitionVersions: e.target.checked })}
        />
        <span>Definition Versions</span>
        <span className="export-opts-count">({counts.definitionVersionCount})</span>
      </label>
      <label className="export-opts-check">
        <input
          type="checkbox"
          checked={values.structureLog}
          onChange={(e) => onChange({ ...values, structureLog: e.target.checked })}
        />
        <span>Structure History</span>
        <span className="export-opts-count">({counts.structureLogCount})</span>
      </label>
    </>
  );
}
