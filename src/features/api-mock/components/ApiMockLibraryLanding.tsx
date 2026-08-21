import { ApiMockServerLibraryPanel } from './ApiMockServerLibraryPanel';
import type { ApiMockLibraryEntry } from '../apiMockServerLibrary';

interface Props {
  entries: ApiMockLibraryEntry[];
  activeServerId?: string;
  atTabLimit: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

/**
 * Shown when every tab is closed but the workspace still has saved servers —
 * the reassurance that closing a tab did not throw the work away.
 */
export function ApiMockLibraryLanding({
  entries,
  activeServerId,
  atTabLimit,
  onOpen,
  onDelete,
  onCreate,
}: Props) {
  return (
    <div className="am-library-landing" data-testid="api-mock-library-landing">
      <div className="am-library-landing-head">
        <h2>No mock server open</h2>
        <p>Your rules, examples, and settings are still saved. Open a server to pick up where you left off.</p>
      </div>
      <ApiMockServerLibraryPanel
        entries={entries}
        activeServerId={activeServerId}
        atTabLimit={atTabLimit}
        onOpen={onOpen}
        onDelete={onDelete}
        onCreate={onCreate}
        variant="page"
      />
    </div>
  );
}
