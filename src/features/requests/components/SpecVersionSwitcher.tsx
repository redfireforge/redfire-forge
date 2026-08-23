import { useCallback } from 'react';
import { CustomSelect } from '@shared/components/CustomSelect';
import type { RequestItem } from '@shared/types';
import { applySpecVersion } from '../../catalog/utils/versionMerge';

interface Props {
  request: RequestItem;
  onUpdateRequest: (patch: Partial<RequestItem>) => void;
  onCompare?: () => void;
}

export function SpecVersionSwitcher({ request, onUpdateRequest, onCompare }: Props) {
  const versions = request.specVersions;
  const activeId = request.activeSpecVersionId ?? versions?.[versions.length - 1]?.id ?? '';
  const activeVersion = versions?.find(v => v.id === activeId);

  const handleChange = useCallback((value: string) => {
    const target = versions?.find(v => v.id === value);
    if (!target) return;
    onUpdateRequest(applySpecVersion(target));
  }, [versions, onUpdateRequest]);

  if (!versions || versions.length <= 1) return null;

  return (
    <div className="spec-version-switcher">
      <span className="spec-version-badge" title="Spec versions available">
        v{activeVersion?.catalogVersion || '?'}
      </span>
      <CustomSelect
        className="spec-version-select"
        value={activeId}
        onChange={handleChange}
        options={versions.map(v => ({
          value: v.id,
          label: `v${v.catalogVersion}${v.id === activeId ? ' (active)' : ''}`,
        }))}
        aria-label="Switch spec version"
      />
      <span className="spec-version-count">{versions.length}</span>
      {onCompare && (
        <button className="spec-version-compare-btn" onClick={onCompare} title="Compare versions">
          Compare
        </button>
      )}
    </div>
  );
}
