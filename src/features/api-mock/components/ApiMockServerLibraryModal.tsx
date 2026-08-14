import AppModalFrame from '../../../shared/components/AppModalFrame';
import { ApiMockServerLibraryPanel } from './ApiMockServerLibraryPanel';
import type { ApiMockLibraryEntry } from '../apiMockServerLibrary';

interface Props {
  entries: ApiMockLibraryEntry[];
  activeServerId?: string;
  atTabLimit: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onClose: () => void;
}

/** Dialog wrapper around the saved-server library (opened from the tab bar). */
export function ApiMockServerLibraryModal({
  entries,
  activeServerId,
  atTabLimit,
  onOpen,
  onDelete,
  onCreate,
  onClose,
}: Props) {
  return (
    <AppModalFrame
      title={
        <div className="am-modal-title-block">
          <div className="am-modal-title">Saved servers</div>
          <div className="am-modal-subtitle">
            Every mock server you have created. Closing a tab keeps its rules here.
          </div>
        </div>
      }
      onClose={onClose}
      dialogClassName="modal am-studio-modal am-library-modal"
      bodyClassName="am-studio-modal-body"
      footerClassName="am-studio-modal-footer"
      showExpandButton={false}
      dialogTestId="api-mock-library-modal"
      footer={
        <div className="am-library-modal-footer">
          <button type="button" className="am-btn" onClick={onClose} data-testid="api-mock-library-close">
            Close
          </button>
        </div>
      }
    >
      <div className="api-mock-root am-in-modal">
        <ApiMockServerLibraryPanel
          entries={entries}
          activeServerId={activeServerId}
          atTabLimit={atTabLimit}
          onOpen={onOpen}
          onDelete={onDelete}
          onCreate={onCreate}
          variant="modal"
        />
      </div>
    </AppModalFrame>
  );
}
