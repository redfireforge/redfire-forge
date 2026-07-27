import { useId, type ReactNode, type RefObject } from 'react';
import type { DiffResult } from 'json-diff-kit';
import { useModalFrame } from '../../../../shared/hooks/useModalFrame';
import ModalResizeHandles from '../../../../shared/components/ModalResizeHandles';
import VersionDiffSearchBar from './VersionDiffSearchBar';
import VersionDiffSelectors from './VersionDiffSelectors';
import VersionDiffViewerSection from './VersionDiffViewerSection';

interface SearchBarProps {
  diffSearch: string;
  setDiffSearch: (v: string) => void;
  diffMatchIdx: number;
  setDiffMatchIdx: (v: number) => void;
  diffMatchCount: number;
  diffSearchRef: RefObject<HTMLInputElement | null>;
  diffGoNext: () => void;
  diffGoPrev: () => void;
  escapeClearsSearch?: boolean;
}

interface SelectorOption {
  id: string;
  label: string;
}

interface Props {
  show: boolean;
  onClose: () => void;
  title: string;
  /** Optional controls rendered alongside the search bar in the header */
  headerControls?: ReactNode;
  compareLeft: string | null;
  setCompareLeft: (v: string) => void;
  compareRight: string | null;
  setCompareRight: (v: string) => void;
  options: SelectorOption[];
  diffResult: readonly [DiffResult[], DiffResult[]] | null;
  /** When provided, this result is displayed instead of diffResult (e.g. for a rules tab) */
  activeDiffResult?: readonly [DiffResult[], DiffResult[]] | null;
  diffViewerRef: RefObject<HTMLDivElement | null>;
  searchBarProps: SearchBarProps;
  /** Content rendered inside the viewer section (info-bar, status badges, diff tabs, etc.) */
  children?: ReactNode;
}

/**
 * Shared compare-versions modal shell used by both ResponseVersionPanel and
 * RulesVersionPanel. Provides the overlay wrapper, modal header, version
 * selectors, diff viewer section, and footer Close button.
 */
export default function VersionDiffModal({
  show,
  onClose,
  title,
  headerControls,
  compareLeft, setCompareLeft,
  compareRight, setCompareRight,
  options,
  diffResult,
  activeDiffResult,
  diffViewerRef,
  searchBarProps,
  children,
}: Props) {
  const titleId = useId();
  const {
    isDragged,
    overlayStyle,
    dialogStyle,
    headerDragStyle,
    onHeaderMouseDown,
    onHeaderPointerDown,
    dialogRef,
    onRightEdge,
    onCorner,
    onBottomEdge,
  } = useModalFrame({
    open: show,
    minWidth: 640,
    minHeight: 360,
    constrainDragToViewport: true,
    dragViewportPadding: 12,
  });

  if (!show) return null;

  return (
    <div
      className="version-diff-overlay"
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`version-diff-modal${isDragged ? ' version-diff-modal--dragged' : ''}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={dialogStyle}
      >
        {/* Header doubles as the drag handle. */}
        <div
          className="version-diff-modal-header"
          style={headerDragStyle}
          onMouseDown={onHeaderMouseDown}
          onPointerDown={onHeaderPointerDown}
        >
          <h3 id={titleId}>{title}</h3>
          <div className="version-diff-modal-controls">
            {headerControls}
            <VersionDiffSearchBar
              diffSearch={searchBarProps.diffSearch}
              setDiffSearch={searchBarProps.setDiffSearch}
              diffMatchIdx={searchBarProps.diffMatchIdx}
              setDiffMatchIdx={searchBarProps.setDiffMatchIdx}
              diffMatchCount={searchBarProps.diffMatchCount}
              diffSearchRef={searchBarProps.diffSearchRef}
              diffGoNext={searchBarProps.diffGoNext}
              diffGoPrev={searchBarProps.diffGoPrev}
              escapeClearsSearch={searchBarProps.escapeClearsSearch}
            />
          </div>
        </div>
        <VersionDiffSelectors
          compareLeft={compareLeft} setCompareLeft={setCompareLeft}
          compareRight={compareRight} setCompareRight={setCompareRight}
          options={options}
        />
        <VersionDiffViewerSection
          compareLeft={compareLeft} compareRight={compareRight}
          diffResult={diffResult}
          diffViewerRef={diffViewerRef}
          activeDiffResult={activeDiffResult}
        >
          {children}
        </VersionDiffViewerSection>
        <div className="version-diff-footer">
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>

        {/* Must stay a direct child of the role="dialog" box — the resize hook
            measures the handle's parent to compute the drag origin. */}
        <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} onBottomEdge={onBottomEdge} />
      </div>
    </div>
  );
}
