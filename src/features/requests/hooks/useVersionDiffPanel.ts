/**
 * useVersionDiffPanel — shared state, callbacks, and diff-search highlighting
 * logic used by both ResponseVersionPanel and RulesVersionPanel.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { DiffResult } from 'json-diff-kit';

export interface VersionBase {
  id: string;
  timestamp: number;
  label?: string;
}

export interface UseVersionDiffPanelReturn<V extends VersionBase> {
  // ── State ──
  compareLeft: string | null;
  setCompareLeft: React.Dispatch<React.SetStateAction<string | null>>;
  compareRight: string | null;
  setCompareRight: React.Dispatch<React.SetStateAction<string | null>>;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  editingLabel: string | null;
  setEditingLabel: React.Dispatch<React.SetStateAction<string | null>>;
  labelText: string;
  setLabelText: React.Dispatch<React.SetStateAction<string>>;
  showDuplicateConfirm: boolean;
  setShowDuplicateConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  previewId: string | null;
  setPreviewId: React.Dispatch<React.SetStateAction<string | null>>;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  // ── Diff search ──
  diffSearch: string;
  setDiffSearch: React.Dispatch<React.SetStateAction<string>>;
  diffMatchIdx: number;
  setDiffMatchIdx: React.Dispatch<React.SetStateAction<number>>;
  diffMatchCount: number;
  diffSearchRef: React.RefObject<HTMLInputElement | null>;
  diffViewerRef: React.RefObject<HTMLDivElement | null>;
  diffGoNext: () => void;
  diffGoPrev: () => void;
  // ── Computed ──
  sorted: V[];
  isIdentical: boolean;
  diffResult: readonly [DiffResult[], DiffResult[]] | null;
  // ── Actions ──
  handleSaveClick: () => void;
  openCompare: () => void;
  formatTime: (ts: number) => string;
}

export interface UseVersionDiffPanelOptions<V extends VersionBase> {
  versions: V[];
  onSaveVersion: () => void;
  /** Compute the diff result for the current left/right comparison. */
  computeDiff: (left: V, right: V) => readonly [DiffResult[], DiffResult[]] | null;
  /** Whether saving would create a duplicate. */
  isDuplicate: boolean;
  /**
   * Extra deps that should reset the diff search (e.g. diffTab for ResponseVersionPanel).
   * The hook already resets on showModal changes.
   */
  extraSearchResetDeps?: unknown[];
  /**
   * Extra diff-result deps to re-run search highlighting (e.g. rulesDiffResult, diffTab).
   */
  extraHighlightDeps?: unknown[];
  /**
   * If true, Escape when the search input is focused & non-empty clears the
   * search instead of closing the modal (RulesVersionPanel behaviour).
   */
  escapeClearsSearch?: boolean;
}

export function useVersionDiffPanel<V extends VersionBase>(
  opts: UseVersionDiffPanelOptions<V>,
): UseVersionDiffPanelReturn<V> {
  const { versions, onSaveVersion, computeDiff, isDuplicate, extraSearchResetDeps = [], extraHighlightDeps = [], escapeClearsSearch = false } = opts;

  // ── State ──
  const [compareLeft, setCompareLeft] = useState<string | null>(null);
  const [compareRight, setCompareRight] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelText, setLabelText] = useState('');
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [diffSearch, setDiffSearch] = useState('');
  const [diffMatchIdx, setDiffMatchIdx] = useState(0);
  const [diffMatchCount, setDiffMatchCount] = useState(0);
  const diffSearchRef = useRef<HTMLInputElement>(null);
  const diffViewerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);

  const sorted = useMemo(() => [...versions].sort((a, b) => b.timestamp - a.timestamp), [versions]);

  // ── Keyboard shortcuts (Escape / Cmd+F) ──
  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (escapeClearsSearch) {
          const el = diffSearchRef.current;
          if (el && document.activeElement === el && el.value.trim()) {
            e.preventDefault();
            setDiffSearch('');
            setDiffMatchIdx(0);
            return;
          }
        }
        setShowModal(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        diffSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal, escapeClearsSearch]);

  // ── Reset search on modal/tab change ──
  useEffect(() => {
    setDiffSearch('');
    setDiffMatchIdx(0);
    setDiffMatchCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extraSearchResetDeps intentionally spread
  }, [showModal, ...extraSearchResetDeps]);

  // ── Diff navigation ──
  const diffGoNext = useCallback(() => {
    if (diffMatchCount === 0) return;
    setDiffMatchIdx(prev => (prev < diffMatchCount - 1 ? prev + 1 : 0));
  }, [diffMatchCount]);
  const diffGoPrev = useCallback(() => {
    if (diffMatchCount === 0) return;
    setDiffMatchIdx(prev => (prev > 0 ? prev - 1 : diffMatchCount - 1));
  }, [diffMatchCount]);

  // ── Diff result ──
  const diffResult = useMemo(() => {
    if (!showModal || !compareLeft || !compareRight) return null;
    const leftVer = versions.find((v) => v.id === compareLeft);
    const rightVer = versions.find((v) => v.id === compareRight);
    if (!leftVer || !rightVer) return null;
    return computeDiff(leftVer, rightVer);
  }, [showModal, compareLeft, compareRight, versions, computeDiff]);

  const isIdentical = useMemo(() => {
    if (!diffResult) return false;
    return diffResult.every(segment => segment.every(line => line.type === 'equal'));
  }, [diffResult]);

  // ── Diff search highlighting ──
  useEffect(() => {
    if (!diffViewerRef.current) return;
    const container = diffViewerRef.current;
    container.querySelectorAll('.version-diff-search-hit, .version-diff-search-hit--active').forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });
    if (!diffSearch.trim()) { setDiffMatchCount(0); setDiffMatchIdx(0); return; }
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const matches: { node: Text; start: number }[] = [];
    const q = diffSearch.toLowerCase();
    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const text = textNode.textContent || '';
      let idx = text.toLowerCase().indexOf(q);
      while (idx !== -1) {
        matches.push({ node: textNode, start: idx });
        idx = text.toLowerCase().indexOf(q, idx + q.length);
      }
    }
    setDiffMatchCount(matches.length);
    if (matches.length === 0) { setDiffMatchIdx(0); return; }
    const safeIdx = Math.min(diffMatchIdx, matches.length - 1);
    if (safeIdx !== diffMatchIdx) setDiffMatchIdx(safeIdx);
    for (let i = matches.length - 1; i >= 0; i--) {
      const { node, start } = matches[i];
      const text = node.textContent || '';
      const before = text.slice(0, start);
      const match = text.slice(start, start + q.length);
      const after = text.slice(start + q.length);
      const mark = document.createElement('mark');
      mark.className = i === safeIdx ? 'version-diff-search-hit--active' : 'version-diff-search-hit';
      mark.textContent = match;
      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(mark);
      if (after) frag.appendChild(document.createTextNode(after));
      node.parentNode?.replaceChild(frag, node);
      if (i === safeIdx) mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extraHighlightDeps intentionally spread
  }, [diffSearch, diffMatchIdx, diffResult, ...extraHighlightDeps]);

  // ── Actions ──
  const handleSaveClick = useCallback(() => {
    if (isDuplicate) {
      setShowDuplicateConfirm(true);
    } else {
      onSaveVersion();
    }
  }, [isDuplicate, onSaveVersion]);

  const openCompare = useCallback(() => {
    if (sorted.length >= 2) {
      setCompareLeft(sorted[1].id);
      setCompareRight(sorted[0].id);
    }
    setShowModal(true);
  }, [sorted]);

  const formatTime = useCallback((ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  return {
    compareLeft, setCompareLeft,
    compareRight, setCompareRight,
    showModal, setShowModal,
    editingLabel, setEditingLabel,
    labelText, setLabelText,
    showDuplicateConfirm, setShowDuplicateConfirm,
    previewId, setPreviewId,
    expanded, setExpanded,
    diffSearch, setDiffSearch,
    diffMatchIdx, setDiffMatchIdx,
    diffMatchCount,
    diffSearchRef, diffViewerRef,
    diffGoNext, diffGoPrev,
    sorted,
    isIdentical,
    diffResult,
    handleSaveClick,
    openCompare,
    formatTime,
  };
}
