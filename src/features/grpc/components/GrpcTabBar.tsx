import { useCallback, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { GRPC } from '../../../shared/selectors/grpc';
import { isGrpcLifecycleInFlight, type GrpcStudioTabState } from '../grpcStudioTypes';
import type { GrpcCallType } from '../../../shared/grpc/contracts';
import { isGrpcStreamLifecycleInFlight } from '../../../shared/grpc/streamLifecycle';
import { formatGrpcCallTypeBadge } from '../utils/grpcExplorerUtils';

function tabMethodSubtitle(tab: GrpcStudioTabState): string | null {
  if (!tab.service || !tab.method) return null;
  const shortService = tab.service.split('.').at(-1) ?? tab.service;
  return `${shortService}/${tab.method}`;
}

export interface GrpcTabBarProps {
  tabs: GrpcStudioTabState[];
  activeTabId: string;
  canAddTab: boolean;
  maxTabs?: number;
  tabCallTypes?: Record<string, GrpcCallType | undefined>;
  tabCallCounts?: Record<string, number | undefined>;
  onSelect: (tabId: string) => void;
  onAdd: () => void;
  onClose: (tabId: string) => void;
  onDuplicate: (tabId: string) => void;
  onRename: (tabId: string, title: string) => void;
}

export function GrpcTabBar({
  tabs,
  activeTabId,
  canAddTab,
  maxTabs,
  tabCallTypes = {},
  tabCallCounts = {},
  onSelect,
  onAdd,
  onClose,
  onDuplicate,
  onRename,
}: GrpcTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback((tabId: string, title: string) => {
    setEditingTabId(tabId);
    setEditValue(title);
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);

  const commitEdit = useCallback(() => {
    if (editingTabId && editValue.trim()) {
      onRename(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  }, [editingTabId, editValue, onRename]);

  const handleEditKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commitEdit();
    if (event.key === 'Escape') setEditingTabId(null);
  }, [commitEdit]);

  const handleCloseClick = useCallback((event: MouseEvent, tabId: string) => {
    event.stopPropagation();
    onClose(tabId);
  }, [onClose]);

  const handleDuplicateClick = useCallback((event: MouseEvent, tabId: string) => {
    event.stopPropagation();
    onDuplicate(tabId);
  }, [onDuplicate]);

  return (
    <div className="grpc-tab-bar" data-testid="grpc-tab-bar">
      <div className="grpc-tab-bar__scroll">
        <div className="grpc-tab-list" role="tablist" aria-label="gRPC studio tabs">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const inFlight = isGrpcLifecycleInFlight(tab.lifecycle)
              || isGrpcStreamLifecycleInFlight(tab.streamLifecycle);
            const callType = tabCallTypes[tab.id];
            const callCount = tabCallCounts[tab.id] ?? 0;
            const closeDisabled = tabs.length <= 1 || inFlight;
            const methodSubtitle = tabMethodSubtitle(tab);
            const tabTitle = [
              tab.title,
              methodSubtitle,
              inFlight ? 'Call in progress' : null,
              callCount > 0 ? `Calls: ${callCount}` : null,
            ].filter(Boolean).join(' · ');
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`grpc-tab-pane-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                className={`grpc-tab${isActive ? ' grpc-tab--active' : ''}${inFlight ? ' grpc-tab--in-flight' : ''}`}
                data-testid={tab.id}
                title={tabTitle}
                aria-label={tabTitle}
                onClick={() => onSelect(tab.id)}
                onDoubleClick={() => startEditing(tab.id, tab.title)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(tab.id);
                  }
                }}
              >
                {editingTabId === tab.id ? (
                  <input
                    ref={inputRef}
                    className="grpc-tab-rename-input"
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleEditKeyDown}
                    aria-label="Rename tab"
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="grpc-tab-labels">
                      <span className="grpc-tab-label">{tab.title}</span>
                      {methodSubtitle && (
                        <span className="grpc-tab-method-subtitle" data-testid={`grpc-tab-method-${tab.id}`}>
                          {methodSubtitle}
                        </span>
                      )}
                    </span>
                    {callType && tab.service && tab.method && (
                      <span
                        className="grpc-tab-call-type-pill"
                        data-testid={`grpc-tab-call-type-pill-${tab.id}`}
                        title={callType}
                      >
                        {formatGrpcCallTypeBadge(callType)}
                      </span>
                    )}
                    {callCount > 0 && (
                      <span
                        className="grpc-tab-call-count-badge"
                        data-testid={`grpc-tab-call-count-${tab.id}`}
                        title={`${callCount} call${callCount === 1 ? '' : 's'} in this tab`}
                      >
                        ={callCount}
                      </span>
                    )}
                    {inFlight && (
                      <span className="grpc-tab-in-flight-dot" aria-label="Call in progress" title="Call in progress" />
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="grpc-tab-action"
                  aria-label={`Duplicate ${tab.title}`}
                  data-testid={`grpc-tab-duplicate-${tab.id}`}
                  onClick={(event) => handleDuplicateClick(event, tab.id)}
                  disabled={!canAddTab}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="grpc-tab-action grpc-tab-action--close"
                  aria-label={`Close ${tab.title}`}
                  data-testid={`grpc-tab-close-${tab.id}`}
                  onClick={(event) => handleCloseClick(event, tab.id)}
                  disabled={closeDisabled}
                  title={inFlight ? 'Cannot close tab while a call is in progress' : undefined}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        className="grpc-add-tab-btn"
        data-testid="grpc-add-tab"
        onClick={onAdd}
        disabled={!canAddTab}
        aria-label="New tab"
        title={maxTabs ? `${tabs.length} of ${maxTabs} tabs` : undefined}
      >
        + New tab
        {maxTabs ? (
          <span className="grpc-add-tab-count" aria-hidden="true">
            {tabs.length}/{maxTabs}
          </span>
        ) : null}
      </button>
    </div>
  );
}

/** Exported for tests that assert selector parity. */
export { GRPC };
