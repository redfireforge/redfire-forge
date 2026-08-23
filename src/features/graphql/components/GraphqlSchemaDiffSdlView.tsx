import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchMatchBar } from '@shared/components/SearchMatchBar';
import { useSearchMatchNavigation } from '@shared/hooks/useSearchMatchNavigation';
import {
  annotateSplitDiffHunks,
  buildSplitDiffRows,
  canonicalizeSdlForDiff,
  computeInlineDiffSpans,
  computeLineDiff,
  summarizeSplitDiffRows,
  type AnnotatedSdlSplitDiffRow,
  type HunkSegmentRole,
  type InlineDiffSpan,
  type SdlSplitRowKind,
} from '../utils/sdlLineDiff';
import { tokenizeSDL } from '../utils/sdlTokenizer';

function SdlHighlightedLine({ text }: { text: string }) {
  const tokens = useMemo(() => tokenizeSDL(text), [text]);
  return (
    <span className="gql-diff-sdl-text">
      {tokens.map((tok, j) => (
        tok.cls
          ? <span key={j} className={tok.cls}>{tok.text}</span>
          : <span key={j}>{tok.text}</span>
      ))}
    </span>
  );
}

function SdlInlineDiffLine({ spans }: { spans: InlineDiffSpan[] }) {
  return (
    <span className="gql-diff-sdl-text">
      {spans.map((span, j) => (
        span.kind === 'same'
          ? <span key={j}>{span.text}</span>
          : (
            <span
              key={j}
              className={span.kind === 'delete' ? 'gql-diff-sdl-inline-del' : 'gql-diff-sdl-inline-ins'}
            >
              {span.text}
            </span>
          )
      ))}
    </span>
  );
}

function SdlDiffLineContent({
  text,
  kind,
  side,
  pairText,
}: {
  text: string;
  kind: SdlSplitRowKind;
  side: 'left' | 'right';
  pairText?: string;
}) {
  const inlineSpans = useMemo(() => {
    if (kind !== 'modified' || pairText == null || pairText === text) return null;
    const left = side === 'left' ? text : pairText;
    const right = side === 'right' ? text : pairText;
    return computeInlineDiffSpans(left, right)[side];
  }, [text, pairText, kind, side]);

  if (inlineSpans) {
    return <SdlInlineDiffLine spans={inlineSpans} />;
  }
  return <SdlHighlightedLine text={text} />;
}

function SdlDiffConnectorGutter({
  kind,
  hunkRole,
}: {
  kind: SdlSplitRowKind;
  hunkRole: HunkSegmentRole;
}) {
  if (kind === 'unchanged') {
    return (
      <div
        className="gql-diff-sdl-connector gql-diff-sdl-connector--unchanged gql-diff-sdl-connector--slot-mid"
        aria-hidden="true"
        data-testid="gql-diff-sdl-connector"
      />
    );
  }

  const label = kind === 'modified' ? 'Updated line' : kind === 'removed' ? 'Deleted line' : 'Added line';
  const arrow = kind === 'modified' ? '↔' : kind === 'removed' ? '»' : '«';

  return (
    <div
      className={`gql-diff-sdl-connector gql-diff-sdl-connector--${kind} gql-diff-sdl-connector--${hunkRole} gql-diff-sdl-connector--slot-mid`}
      aria-label={label}
      title={label}
      data-testid="gql-diff-sdl-connector"
    >
      <svg className="gql-diff-sdl-connector-svg" viewBox="0 0 40 24" preserveAspectRatio="none" aria-hidden="true">
        {kind === 'removed' && (
          <polygon className="gql-diff-sdl-connector-shape gql-diff-sdl-connector-shape--removed" points="0,12 40,2 40,22" />
        )}
        {kind === 'added' && (
          <polygon className="gql-diff-sdl-connector-shape gql-diff-sdl-connector-shape--added" points="0,2 0,22 40,12" />
        )}
        {kind === 'modified' && (
          <polygon className="gql-diff-sdl-connector-shape gql-diff-sdl-connector-shape--modified" points="0,10 40,10 40,14 0,14" />
        )}
      </svg>
      <span className="gql-diff-sdl-connector-arrow" aria-hidden="true">{arrow}</span>
    </div>
  );
}

function SdlDiffPanePlaceholder({ side }: { side: 'left' | 'right' }) {
  return (
    <>
      <span className="gql-diff-sdl-ln gql-diff-sdl-ln--empty" aria-hidden="true" />
      <span
        className={`gql-diff-sdl-placeholder-cell gql-diff-sdl-placeholder-cell--${side}`}
        aria-hidden="true"
      />
    </>
  );
}

function SdlSplitDiffRowView({ row }: { row: AnnotatedSdlSplitDiffRow }) {
  const showLeft = row.leftText != null;
  const showRight = row.rightText != null;

  return (
    <div className={`gql-diff-sdl-row gql-diff-sdl-row--${row.kind}`} data-testid="gql-diff-sdl-row">
      <div className={`gql-diff-sdl-pane gql-diff-sdl-pane--left gql-diff-sdl-pane--slot-left${showLeft ? '' : ' gql-diff-sdl-pane--placeholder-side'}`}>
        {showLeft ? (
          <>
            <span className="gql-diff-sdl-ln" aria-hidden="true">{row.leftLineNum ?? ''}</span>
            <SdlDiffLineContent
              text={row.leftText!}
              kind={row.kind}
              side="left"
              pairText={row.rightText}
            />
          </>
        ) : (
          <SdlDiffPanePlaceholder side="left" />
        )}
      </div>
      <SdlDiffConnectorGutter kind={row.kind} hunkRole={row.hunkRole} />
      <div className={`gql-diff-sdl-pane gql-diff-sdl-pane--right gql-diff-sdl-pane--slot-right${showRight ? '' : ' gql-diff-sdl-pane--placeholder-side'}`}>
        {showRight ? (
          <>
            <span className="gql-diff-sdl-ln" aria-hidden="true">{row.rightLineNum ?? ''}</span>
            <SdlDiffLineContent
              text={row.rightText!}
              kind={row.kind}
              side="right"
              pairText={row.leftText}
            />
          </>
        ) : (
          <SdlDiffPanePlaceholder side="right" />
        )}
      </div>
    </div>
  );
}

export function SdlDiffView({
  oldSdl,
  newSdl,
  oldLabel,
  newLabel,
}: {
  oldSdl: string;
  newSdl: string;
  oldLabel: string;
  newLabel: string;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [hideUnchanged, setHideUnchanged] = useState(false);

  const canonicalSdl = useMemo(() => ({
    old: canonicalizeSdlForDiff(oldSdl),
    new: canonicalizeSdlForDiff(newSdl),
  }), [oldSdl, newSdl]);

  const splitRows = useMemo(
    () => annotateSplitDiffHunks(buildSplitDiffRows(computeLineDiff(canonicalSdl.old, canonicalSdl.new))),
    [canonicalSdl],
  );

  const stats = useMemo(() => summarizeSplitDiffRows(splitRows), [splitRows]);

  const displayRows = useMemo(
    () => (hideUnchanged ? splitRows.filter((r) => r.kind !== 'unchanged') : splitRows),
    [splitRows, hideUnchanged],
  );

  const [searchQuery, setSearchQuery] = useState('');

  const matchingRowIndices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return displayRows.reduce<number[]>((acc, row, i) => {
      const left = row.leftText?.toLowerCase().includes(q);
      const right = row.rightText?.toLowerCase().includes(q);
      if (left || right) acc.push(i);
      return acc;
    }, []);
  }, [displayRows, searchQuery]);

  const matchCount = matchingRowIndices.length;

  const {
    currentMatchIndex,
    setCurrentMatchIndex,
    goNext,
    goPrev,
    clear: clearNav,
  } = useSearchMatchNavigation(matchCount);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentMatchIndex(0);
  }, [setCurrentMatchIndex]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    clearNav();
  }, [clearNav]);

  const activeRowIndex = matchCount > 0 ? matchingRowIndices[currentMatchIndex] : -1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (activeRowIndex < 0) return;
    rowRefs.current.get(activeRowIndex)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeRowIndex]);

  const hasEdits = stats.removed > 0 || stats.added > 0 || stats.modified > 0;

  return (
    <div className="gql-diff-sdl-view" data-testid="gql-diff-sdl-view">
      <div className="gql-diff-sdl-toolbar">
        <div className="gql-diff-sdl-stats">
          <span className="gql-diff-sdl-stat gql-diff-sdl-stat--removed">
            − {stats.removed} removed
          </span>
          {stats.modified > 0 && (
            <span className="gql-diff-sdl-stat gql-diff-sdl-stat--modified">
              ↔ {stats.modified} modified
            </span>
          )}
          <span className="gql-diff-sdl-stat gql-diff-sdl-stat--added">
            + {stats.added} added
          </span>
          <span className="gql-diff-sdl-stat gql-diff-sdl-stat--unchanged">
            {stats.unchanged} unchanged
          </span>
        </div>
        <label className="gql-diff-sdl-toggle">
          <input
            type="checkbox"
            checked={hideUnchanged}
            onChange={(e) => setHideUnchanged(e.target.checked)}
            data-testid="gql-diff-sdl-hide-unchanged"
          />
          <span>Changes only</span>
        </label>
      </div>

      <div className="gql-diff-sdl-search-bar">
        <SearchMatchBar
          value={searchQuery}
          onChange={handleSearchChange}
          currentMatch={matchCount > 0 ? currentMatchIndex + 1 : 0}
          totalMatches={matchCount}
          onPrev={goPrev}
          onNext={goNext}
          onClear={clearSearch}
          inputRef={searchInputRef}
          placeholder="Search SDL… (Cmd+F)"
          className="gql-diff-sdl-search-inner"
          inputClassName="gql-diff-sdl-search-input"
          countClassName="gql-diff-sdl-search-count"
          navClassName="gql-diff-sdl-search-nav"
          clearClassName="gql-diff-sdl-search-clear"
          navStyle="text"
          ariaLabel="Search SDL diff"
          prevTitle="Previous match (Shift+Enter)"
          nextTitle="Next match (Enter)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matchCount > 0) {
              e.preventDefault();
              if (e.shiftKey) goPrev();
              else goNext();
            }
          }}
        />
      </div>

      <div className="gql-diff-sdl-header gql-diff-sdl-header--split">
        <div className="gql-diff-sdl-pane-head gql-diff-sdl-pane-head--left">
          <span className="gql-diff-sdl-gutter-label" aria-hidden="true">#</span>
          <span className="gql-diff-sdl-col-label gql-diff-sdl-col-label--left">{oldLabel}</span>
        </div>
        <div className="gql-diff-sdl-connector-head" aria-hidden="true" title="Change linkage">
          <span className="gql-diff-sdl-connector-head-icon">↔</span>
        </div>
        <div className="gql-diff-sdl-pane-head gql-diff-sdl-pane-head--right">
          <span className="gql-diff-sdl-gutter-label" aria-hidden="true">#</span>
          <span className="gql-diff-sdl-col-label gql-diff-sdl-col-label--right">{newLabel}</span>
        </div>
      </div>

      <div className="gql-diff-sdl-body gql-diff-sdl-body--split">
        {!hasEdits && (
          <div className="gql-diff-sdl-no-edits" data-testid="gql-diff-sdl-no-edits">
            <span className="gql-diff-sdl-no-edits-icon" aria-hidden="true">✓</span>
            <span>No SDL differences — every line matches between versions.</span>
          </div>
        )}

        {displayRows.length === 0 && hasEdits && hideUnchanged && (
          <div className="gql-diff-sdl-no-edits">
            <span>All visible lines are unchanged. Uncheck &ldquo;Changes only&rdquo; to see full SDL.</span>
          </div>
        )}

        {displayRows.map((row, i) => (
          <div
            key={`${row.kind}:${i}:${row.leftLineNum ?? ''}:${row.rightLineNum ?? ''}:${row.leftText ?? ''}:${row.rightText ?? ''}`}
            ref={(el) => {
              if (el) rowRefs.current.set(i, el);
              else rowRefs.current.delete(i);
            }}
            className={i === activeRowIndex ? 'gql-diff-sdl-row-wrap gql-diff-sdl-row-wrap--search-active' : 'gql-diff-sdl-row-wrap'}
          >
            <SdlSplitDiffRowView row={row} />
          </div>
        ))}
      </div>
    </div>
  );
}
