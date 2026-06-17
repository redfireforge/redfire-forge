import { useRef, type ReactNode } from 'react';
import {
  WS_LEFT_TABS,
  WS_RIGHT_TABS,
  type WsStudioMode,
  type WsLeftTab,
  type WsRightTab,
} from '../../shared/websocket/types';
import { useSplitPaneResize } from '../../shared/hooks/useSplitPaneResize';
import { handleTabListArrowKeys } from '../../shared/utils/tabListKeyboard';

const WS_SPLIT_STORAGE_KEY = 'redfire-ws-split-v1';

const MODE_LABELS: Record<WsStudioMode, string> = {
  client: 'Client',
  mock: 'Mock Server',
  saved: 'Saved',
};

const LEFT_TAB_LABELS: Record<WsLeftTab, string> = {
  connect: 'Connect',
  params: 'Params',
  auth: 'Auth',
  headers: 'Headers',
  send: 'Send',
};

const RIGHT_TAB_LABELS: Record<WsRightTab, string> = {
  events: 'Events',
  console: 'Console',
  stats: 'Stats',
  loadtest: 'Load Test',
  schema: 'Schema',
};

const MIN_LEFT_PX = 440;
const MIN_RIGHT_PX = 200;

export interface WebSocketStudioShellProps {
  mode: WsStudioMode;
  onModeChange: (mode: WsStudioMode) => void;
  leftTab: WsLeftTab;
  onLeftTabChange: (tab: WsLeftTab) => void;
  rightTab: WsRightTab;
  onRightTabChange: (tab: WsRightTab) => void;
  /** Existing studio content (WsConnectionTabContent), mounted in the primary
   * pane in Client mode and full-width in Mock/Saved modes. */
  children: ReactNode;
  /** Phase 4: content for the right pane. In Client mode it replaces the
   * placeholder; when omitted the placeholder renders as before. Phase 6:
   * supplying `rightPane` in Mock/Saved mode opts that mode into the resizable
   * split (divider + right pane) instead of the single full-width pane. */
  rightPane?: ReactNode;
  /** Phase 6: full-width content rendered above the split (used by Mock mode
   * for the server URL bar + status strip). Client/Saved pass nothing. */
  topBar?: ReactNode;
  /** Optional badge counts mirroring the legacy tab bar. */
  messageCount?: number;
  profileCount?: number;
  mockRunning?: boolean;
}

/**
 * Phase 1 (Option A) presentational shell: mode switch + resizable split-pane
 * chrome wrapping the existing studio content. The shell owns navigation when
 * mounted; the parent derives the child's controlled view from `mode`/`leftTab`
 * and progressively relocates real content into the panes in Phases 2–5.
 */
export function WebSocketStudioShell({
  mode,
  onModeChange,
  leftTab,
  onLeftTabChange,
  rightTab,
  onRightTabChange,
  children,
  rightPane,
  topBar,
  messageCount = 0,
  profileCount = 0,
  mockRunning = false,
}: WebSocketStudioShellProps) {
  const splitRef = useRef<HTMLDivElement | null>(null);
  const { width: leftWidth, dividerProps } = useSplitPaneResize({
    storageKey: WS_SPLIT_STORAGE_KEY,
    defaultWidth: 600,
    minWidth: MIN_LEFT_PX,
    minOppositeWidth: MIN_RIGHT_PX,
    containerRef: splitRef,
    label: 'Resize left and right panes',
  });

  // Phase 6: the resizable split (divider + right pane) is used by Client mode
  // and by any other mode (Mock/Saved) that supplies a `rightPane`. The shell
  // tab strips remain Client-only; Mock/Saved panes carry their own headers.
  const isSplit = mode === 'client' || rightPane != null;

  return (
    <div className="ws-studio-shell" data-testid="ws-studio-shell">
      <div
        className="ws-studio-modes"
        role="tablist"
        aria-label="Studio mode"
        onKeyDown={handleTabListArrowKeys}
      >
        {(['client', 'mock', 'saved'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`ws-mode-tab-${m}`}
            aria-selected={mode === m}
            aria-controls="ws-studio-split"
            tabIndex={mode === m ? 0 : -1}
            className={`ws-studio-mode ${mode === m ? 'active' : ''}`}
            onClick={() => onModeChange(m)}
            data-testid={`mode-${m}`}
          >
            {MODE_LABELS[m]}
            {m === 'mock' && mockRunning && (
              <span className="ws-studio-tab-badge ws-studio-tab-badge-running" aria-label="Mock server running">●</span>
            )}
            {m === 'saved' && profileCount > 0 && (
              <span className="ws-studio-tab-badge ws-studio-tab-badge-muted">{profileCount}</span>
            )}
          </button>
        ))}
      </div>

      {/*
        The split container is ALWAYS rendered and `children` always live at
        `.ws-studio-split > .ws-studio-left > .ws-studio-left-body`, regardless
        of mode. Only the left-tab strip, divider, and right pane are toggled
        per mode. This keeps the child subtree (the live WsConnectionTabContent
        and its WebSocket connection) mounted across mode switches — switching
        Client↔Mock↔Saved must not drop the connection, matching the legacy
        flag-off behavior where switching views never remounted.
      */}
      {topBar != null && (
        <div className="ws-studio-topbar" data-testid="ws-studio-topbar">{topBar}</div>
      )}

      <div
        className={`ws-studio-split ${isSplit ? '' : 'ws-studio-split-single'}`}
        ref={splitRef}
        id="ws-studio-split"
        data-testid="ws-studio-split"
        data-mode={mode}
      >
        <div className="ws-studio-left" style={isSplit ? { width: leftWidth } : undefined}>
          {mode === 'client' && (
            <div
              className="ws-studio-tabs"
              role="tablist"
              aria-label="Left pane"
              onKeyDown={handleTabListArrowKeys}
            >
              {WS_LEFT_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`ws-left-tab-${t}`}
                  aria-selected={leftTab === t}
                  aria-controls="ws-studio-left-panel"
                  tabIndex={leftTab === t ? 0 : -1}
                  className={`ws-studio-tab ${leftTab === t ? 'active' : ''}`}
                  onClick={() => onLeftTabChange(t)}
                  data-testid={`left-tab-${t}`}
                >
                  {LEFT_TAB_LABELS[t]}
                  {t === 'send' && messageCount > 0 && (
                    <span className="ws-studio-tab-badge">{messageCount}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          <div
            className="ws-studio-left-body"
            id="ws-studio-left-panel"
            role={mode === 'client' ? 'tabpanel' : undefined}
            aria-labelledby={mode === 'client' ? `ws-left-tab-${leftTab}` : undefined}
            tabIndex={mode === 'client' ? 0 : undefined}
          >
            {children}
          </div>
        </div>

        {isSplit && (
          <>
            <div
              className="ws-studio-divider"
              {...dividerProps}
              data-testid="ws-studio-divider"
            />

            <div className="ws-studio-right">
              {mode === 'client' && (
                <div
                  className="ws-studio-tabs"
                  role="tablist"
                  aria-label="Right pane"
                  onKeyDown={handleTabListArrowKeys}
                >
                  {WS_RIGHT_TABS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      id={`ws-right-tab-${t}`}
                      aria-selected={rightTab === t}
                      aria-controls="ws-studio-right-panel"
                      tabIndex={rightTab === t ? 0 : -1}
                      className={`ws-studio-tab ${rightTab === t ? 'active' : ''}`}
                      onClick={() => onRightTabChange(t)}
                      data-testid={`right-tab-${t}`}
                    >
                      {RIGHT_TAB_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
              <div
                className="ws-studio-right-body"
                id="ws-studio-right-panel"
                role={mode === 'client' ? 'tabpanel' : undefined}
                aria-labelledby={mode === 'client' ? `ws-right-tab-${rightTab}` : undefined}
                tabIndex={mode === 'client' ? 0 : undefined}
              >
                {rightPane ?? (
                  <div className="ws-studio-pane-placeholder">
                    <p className="ws-studio-pane-placeholder-title">
                      {RIGHT_TAB_LABELS[rightTab]}
                    </p>
                    <p className="ws-studio-pane-placeholder-hint">
                      This pane is part of the redesigned layout. Events, console, stats,
                      load test, and schema views move here in later phases.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
