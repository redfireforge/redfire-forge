import { useRef } from 'react';
import type { HarParseResult } from '../utils/harParser';
import { parseHarEntries } from '../utils/harParser';

interface Props {
  /** Called when a HAR file has been selected and parsed */
  onFileParsed: (result: HarParseResult, fileName: string) => void;
  /** Whether the button should be disabled (e.g. while a workflow is running) */
  disabled?: boolean;
}

/**
 * A toolbar button that opens a native file picker for .har files.
 * When the user selects a file, it is parsed immediately and the result
 * is passed to onFileParsed — the caller decides what to show next
 * (typically HarImportPreviewModal).
 */
export function HarImportButton({ onFileParsed, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const result = parseHarEntries(text);
    onFileParsed(result, file.name);

    // Reset so the same file can be selected again
    e.target.value = '';
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-sm wf-toolbar-btn wf-toolbar-har-import-btn"
        onClick={handleClick}
        disabled={disabled}
        title="Import a HAR file as a new workflow"
        data-testid="wf-toolbar-har-import-btn"
      >
        <svg
          className="wf-toolbar-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Import HAR
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".har,application/json"
        style={{ display: 'none' }}
        aria-hidden="true"
        data-testid="wf-har-file-input"
        onChange={handleChange}
      />
    </>
  );
}
