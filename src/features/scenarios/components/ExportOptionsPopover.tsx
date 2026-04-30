import { useState, useRef, useEffect } from 'react';
import type { VersionExportOptions } from '../utils/scenarioImportExport';
import { DEFAULT_VERSION_EXPORT, countVersions, hasVersionData } from '../utils/scenarioImportExport';
import VersionCheckboxGroup from './VersionCheckboxGroup';

interface Props {
  /** The data being exported — used to count versions */
  data: unknown;
  /** Called with version options when user confirms export */
  onExport: (opts: VersionExportOptions) => void;
  /** Close the popover without exporting */
  onClose: () => void;
}

export default function ExportOptionsPopover({ data, onExport, onClose }: Props) {
  const [opts, setOpts] = useState<VersionExportOptions>({ ...DEFAULT_VERSION_EXPORT });
  const ref = useRef<HTMLDivElement>(null);
  const counts = countVersions(data);
  const hasVersions = hasVersionData(data);
  const exportedRef = useRef(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // If no versions exist, export immediately with defaults (guarded against double-fire in StrictMode)
  useEffect(() => {
    if (!hasVersions && !exportedRef.current) {
      exportedRef.current = true;
      onExport(opts);
    }
  }, [hasVersions]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasVersions) {
    return null;
  }

  return (
    <div className="export-opts-popover" ref={ref}>
      <div className="export-opts-title">Export Options</div>
      <VersionCheckboxGroup
        counts={counts}
        values={{ responseVersions: opts.includeResponseVersions, rulesVersions: opts.includeRulesVersions }}
        onChange={(v) => setOpts({ includeResponseVersions: v.responseVersions, includeRulesVersions: v.rulesVersions })}
      />
      <div className="export-opts-actions">
        <button className="btn btn-xs" onClick={onClose}>Cancel</button>
        <button className="btn btn-xs btn-primary" onClick={() => onExport(opts)}>Export</button>
      </div>
    </div>
  );
}
