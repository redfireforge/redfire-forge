import { useState } from 'react';
import type { VersionImportOptions } from '../hooks/useScenarioExportImport';
import { countVersions } from '../utils/scenarioImportExport';
import VersionCheckboxGroup from './VersionCheckboxGroup';

interface Props {
  data: unknown;
  onConfirm: (opts: VersionImportOptions) => void;
  onCancel: () => void;
}

export default function ImportVersionModal({ data, onConfirm, onCancel }: Props) {
  const counts = countVersions(data);
  const [opts, setOpts] = useState<VersionImportOptions>({
    importResponseVersions: true,
    importRulesVersions: true,
    importDefinitionVersions: true,
    importStructureLog: true,
  });

  return (
    <div className="import-version-overlay" onClick={onCancel}>
      <div className="import-version-modal" onClick={(e) => e.stopPropagation()}>
        <div className="import-version-title">Import Version Options</div>
        <p className="import-version-hint">
          The imported file contains version history. Choose which versions to include:
        </p>
        <VersionCheckboxGroup
          counts={counts}
          values={{ responseVersions: opts.importResponseVersions, rulesVersions: opts.importRulesVersions, definitionVersions: opts.importDefinitionVersions, structureLog: opts.importStructureLog }}
          onChange={(v) => setOpts({ importResponseVersions: v.responseVersions, importRulesVersions: v.rulesVersions, importDefinitionVersions: v.definitionVersions, importStructureLog: v.structureLog })}
        />
        <div className="import-version-actions">
          <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-sm btn-primary" onClick={() => onConfirm(opts)}>Import</button>
        </div>
      </div>
    </div>
  );
}
