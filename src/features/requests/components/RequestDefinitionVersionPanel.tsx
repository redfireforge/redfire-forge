import type { RequestDefinitionVersion, RequestDefinitionSnapshot } from '../../../shared/types';
import { VersionHistoryPanel } from '../../../shared/components/version-diff';

interface Props {
  versions: RequestDefinitionVersion[];
  currentSnapshot: RequestDefinitionSnapshot;
  onRestore: (version: RequestDefinitionVersion) => void;
  onDelete: (versionId: string) => void;
  onRename: (versionId: string, label: string) => void;
  onCompare: (older: RequestDefinitionVersion, newer: RequestDefinitionVersion) => void;
}

export default function RequestDefinitionVersionPanel(props: Props) {
  return (
    <VersionHistoryPanel
      title="Request Definition History"
      emptyHint="Switch between requests to create definition snapshots automatically."
      {...props}
    />
  );
}
