import type { RefObject, ReactNode } from 'react';
import { Viewer } from 'json-diff-kit';
import type { DiffResult } from 'json-diff-kit';

interface Props {
  compareLeft: string | null;
  compareRight: string | null;
  diffResult: readonly [DiffResult[], DiffResult[]] | null;
  diffViewerRef: RefObject<HTMLDivElement | null>;
  /** Optional extra diff result to display (e.g. rules tab) */
  activeDiffResult?: readonly [DiffResult[], DiffResult[]] | null;
  /** Content rendered between selectors and viewer (info bar, tabs, etc.) */
  children?: ReactNode;
}

export default function VersionDiffViewerSection({
  compareLeft, compareRight,
  diffResult,
  diffViewerRef,
  activeDiffResult,
  children,
}: Props) {
  const activeResult = activeDiffResult !== undefined ? activeDiffResult : diffResult;

  return (
    <>
      {children}
      <div className="version-diff-viewer" ref={diffViewerRef}>
        {compareLeft && compareRight && compareLeft === compareRight ? (
          <div className="version-diff-identical">Select different versions on each side to compare.</div>
        ) : activeResult ? (
          <Viewer
            diff={activeResult}
            indent={2}
            lineNumbers={true}
            highlightInlineDiff={true}
            syntaxHighlight={{ theme: 'monokai' }}
          />
        ) : compareLeft && compareRight && compareLeft !== compareRight ? (
          <div className="version-diff-identical">No differences found.</div>
        ) : (
          <div className="version-diff-identical">Select two versions above to compare.</div>
        )}
      </div>
    </>
  );
}
