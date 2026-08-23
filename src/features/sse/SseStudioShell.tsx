import { useRef, type ReactNode } from 'react';
import {
  SSE_LEFT_TABS,
  SSE_LEFT_TAB_LABELS,
  SSE_RIGHT_TABS,
  SSE_RIGHT_TAB_LABELS,
  type SseLeftTab,
  type SseRightTab,
} from './sseTypes';
import { useSplitPaneResize } from '@shared/hooks/useSplitPaneResize';
import { handleTabListArrowKeys } from '@shared/utils/tabListKeyboard';

const SSE_SPLIT_STORAGE_KEY = 'redfire-sse-split-v1';

const MIN_LEFT_PX = 280;
const MIN_RIGHT_PX = 320;

export interface SseStudioShellProps {
  /** Full-width top bar (URL input + connect/disconnect + state dot). */
  topBar: ReactNode;
  /** Full-width status strip rendered below the top bar. */
  statusStrip?: ReactNode;
  /** Left pane header label. Ignored when `leftTab` is provided (a tab strip
   * is rendered instead). */
  leftTitle?: string;
  /** Phase 8 — when provided, the left pane header renders a Connect/Auth tab
   * strip instead of the plain title; the page swaps `left` content to match. */
  leftTab?: SseLeftTab;
  onLeftTabChange?: (tab: SseLeftTab) => void;
  /** When true, show a presence dot on the Auth tab (auth is configured). */
  authConfigured?: boolean;
  /** Left pane content (connection config). */
  left: ReactNode;
  /** Right pane header label. Ignored when `rightTab` is provided. */
  rightTitle?: string;
  /** Phase 9 — when provided, the right pane header renders an Events/Console
   * tab strip instead of the plain title; the page swaps `right` to match. */
  rightTab?: SseRightTab;
  onRightTabChange?: (tab: SseRightTab) => void;
  /** Right pane content (events list + detail, or console). */
  right: ReactNode;
}

/**
 * Phase 7 presentational shell for the SSE studio: a resizable split-pane with
 * the connection config on the left and the events stream on the right. A
 * simplified mirror of the WebSocket `Client` mode shell — SSE has a single
 * connection, so there is no mode switch and (until Auth/Console land in
 * Phases 8/9) no per-pane tab strips, just a plain pane-title header.
 */
export function SseStudioShell({
  topBar,
  statusStrip,
  leftTitle = 'Connection',
  leftTab,
  onLeftTabChange,
  authConfigured = false,
  left,
  rightTitle = 'Events',
  rightTab,
  onRightTabChange,
  right,
}: SseStudioShellProps) {
  const splitRef = useRef<HTMLDivElement | null>(null);
  const { width: leftWidth, dividerProps } = useSplitPaneResize({
    storageKey: SSE_SPLIT_STORAGE_KEY,
    defaultWidth: 360,
    minWidth: MIN_LEFT_PX,
    minOppositeWidth: MIN_RIGHT_PX,
    containerRef: splitRef,
    label: 'Resize connection and events panes',
  });

  return (
    <div className="sse-studio-shell" data-testid="sse-studio-shell">
      <div className="sse-studio-topbar" data-testid="sse-studio-topbar">{topBar}</div>
      {statusStrip != null && (
        <div className="sse-studio-status-strip" data-testid="sse-studio-status-strip">
          {statusStrip}
        </div>
      )}

      <div className="sse-studio-split" ref={splitRef} data-testid="sse-studio-split">
        <div className="sse-studio-left" style={{ width: leftWidth }}>
          {leftTab != null ? (
            <div
              className="sse-studio-tabs"
              role="tablist"
              aria-label="Left pane"
              onKeyDown={handleTabListArrowKeys}
            >
              {SSE_LEFT_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`sse-left-tab-${t}`}
                  aria-selected={leftTab === t}
                  aria-controls="sse-studio-left-panel"
                  tabIndex={leftTab === t ? 0 : -1}
                  className={`sse-studio-tab ${leftTab === t ? 'active' : ''}`}
                  onClick={() => onLeftTabChange?.(t)}
                  data-testid={`sse-left-tab-${t}`}
                >
                  {SSE_LEFT_TAB_LABELS[t]}
                  {t === 'auth' && authConfigured && (
                    <span className="sse-studio-tab-dot" aria-label="Auth configured" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="sse-studio-pane-title">{leftTitle}</div>
          )}
          <div
            className="sse-studio-left-body"
            id="sse-studio-left-panel"
            role={leftTab != null ? 'tabpanel' : undefined}
            aria-labelledby={leftTab != null ? `sse-left-tab-${leftTab}` : undefined}
            tabIndex={leftTab != null ? 0 : undefined}
          >
            {left}
          </div>
        </div>

        <div
          className="sse-studio-divider"
          {...dividerProps}
          data-testid="sse-studio-divider"
        />

        <div className="sse-studio-right">
          {rightTab != null ? (
            <div
              className="sse-studio-tabs"
              role="tablist"
              aria-label="Right pane"
              onKeyDown={handleTabListArrowKeys}
            >
              {SSE_RIGHT_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`sse-right-tab-${t}`}
                  aria-selected={rightTab === t}
                  aria-controls="sse-studio-right-panel"
                  tabIndex={rightTab === t ? 0 : -1}
                  className={`sse-studio-tab ${rightTab === t ? 'active' : ''}`}
                  onClick={() => onRightTabChange?.(t)}
                  data-testid={`sse-right-tab-${t}`}
                >
                  {SSE_RIGHT_TAB_LABELS[t]}
                </button>
              ))}
            </div>
          ) : (
            <div className="sse-studio-pane-title">{rightTitle}</div>
          )}
          <div
            className="sse-studio-right-body"
            id="sse-studio-right-panel"
            role={rightTab != null ? 'tabpanel' : undefined}
            aria-labelledby={rightTab != null ? `sse-right-tab-${rightTab}` : undefined}
            tabIndex={rightTab != null ? 0 : undefined}
          >
            {right}
          </div>
        </div>
      </div>
    </div>
  );
}
