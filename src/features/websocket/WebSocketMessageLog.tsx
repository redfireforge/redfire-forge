import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WsFrame } from '../../shared/websocket/types';
import type { WsMessageFormat, WsMessageTemplate } from '../../shared/websocket/types';
import { formatBytes, formatUptime } from '../../shared/websocket/types';
import type { WsDirectionFilter } from './useWebSocketStudio';
import { WebSocketMessageDetail } from './WebSocketMessageDetail';
import { isValidJson, prettyJson, isValidBase64, tokenizeJson, buildBinaryPreview, formatWsTimestamp } from './wsMessageUtils';
import { useDropdownClose } from './useDropdownClose';
import type { WsProtocolMode } from '../../shared/websocket/protocols/protocolTypes';
import { encodeSioEvent } from '../../shared/websocket/protocols/socketIoCodec';
import { encodeStompFrame } from '../../shared/websocket/protocols/stompCodec';
import { encodeGqlWsSubscribe } from '../../shared/websocket/protocols/graphqlWsCodec';

const CONTROL_FRAME_TYPES = new Set(['ping', 'pong', 'close']);

interface WebSocketMessageLogProps {
  messages: WsFrame[];
  totalCount: number;
  maxMessages: number;
  isMaxReached: boolean;
  searchText: string;
  setSearchText: (v: string) => void;
  directionFilter: WsDirectionFilter;
  setDirectionFilter: (v: WsDirectionFilter) => void;
  onClear: () => void;
  onSend: (data: string, format?: WsMessageFormat) => void;
  onPing?: () => void;
  isConnected: boolean;
  templates: WsMessageTemplate[];
  onSaveTemplate: (name: string, body: string, format: WsMessageFormat) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onLoadTemplate: (id: string) => { body: string; format: WsMessageFormat } | null;
  effectiveProtocol?: Exclude<WsProtocolMode, 'auto'>;
  allMessages?: WsFrame[];
  transportMode?: 'direct' | 'proxy';
  showStatusBar?: boolean;
  connectionUrl?: string;
  uptime?: number | null;
  sentCount?: number;
  receivedCount?: number;
}

function renderInlineJson(json: string): React.ReactNode {
  const tokens = tokenizeJson(prettyJson(json));
  return tokens.map((t, i) => {
    const cls = t.type === 'punct' ? undefined : `ws-json-${t.type}`;
    return cls ? <span key={i} className={cls}>{t.text}</span> : t.text;
  });
}




export function WebSocketMessageLog({
  messages,
  totalCount,
  maxMessages,
  isMaxReached,
  searchText,
  setSearchText,
  directionFilter,
  setDirectionFilter,
  onClear,
  onSend,
  onPing,
  isConnected,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onLoadTemplate,
  effectiveProtocol = 'raw',
  allMessages = messages,
  transportMode = 'direct',
  showStatusBar = false,
  connectionUrl,
  uptime = null,
  sentCount = 0,
  receivedCount = 0,
}: WebSocketMessageLogProps) {
  const [composeText, setComposeText] = useState('');
  const [composeFormat, setComposeFormat] = useState<WsMessageFormat>('text');
  const [sioEventName, setSioEventName] = useState('');
  const [sioNamespace, setSioNamespace] = useState('/');
  const [stompCommand, setStompCommand] = useState('SEND');
  const [stompDestination, setStompDestination] = useState('');
  const [gqlVariables, setGqlVariables] = useState('');
  const [gqlOperationName, setGqlOperationName] = useState('');
  const [gqlOperationId, setGqlOperationId] = useState(1);
  const isSioMode = effectiveProtocol === 'socket-io';
  const isStompMode = effectiveProtocol === 'stomp';
  const isGqlMode = effectiveProtocol === 'graphql-ws';
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState('');
  const [showControlFrames, setShowControlFrames] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const templateDropdownRef = useDropdownClose(
    templateDropdownOpen,
    useCallback(() => setTemplateDropdownOpen(false), []),
  );

  const canSend = useMemo(() => {
    if (!isConnected) return false;
    if (isSioMode) {
      return sioEventName.trim().length > 0;
    }
    if (isStompMode) {
      const needsInput = stompCommand === 'SEND' || stompCommand === 'SUBSCRIBE'
        || stompCommand === 'UNSUBSCRIBE' || stompCommand === 'ACK' || stompCommand === 'NACK';
      if (needsInput && stompDestination.trim().length === 0) return false;
      return true;
    }
    if (isGqlMode) {
      return composeText.trim().length > 0;
    }
    const trimmed = composeText.trim();
    if (trimmed.length === 0) return false;
    if (composeFormat === 'binary' && !isValidBase64(trimmed)) return false;
    return true;
  }, [isConnected, composeText, composeFormat, isSioMode, sioEventName, isStompMode, stompCommand, stompDestination, isGqlMode]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    if (isSioMode) {
      let payload: unknown;
      const trimmed = composeText.trim();
      if (trimmed.length > 0) {
        try { payload = JSON.parse(trimmed); } catch { payload = trimmed; }
      }
      const ns = sioNamespace.trim() || '/';
      const encoded = encodeSioEvent(sioEventName.trim(), payload, ns);
      onSend(encoded, 'text');
      setComposeText('');
      return;
    }
    if (isStompMode) {
      const headers: Record<string, string> = {};
      const input = stompDestination.trim();
      if (stompCommand === 'CONNECT' || stompCommand === 'STOMP') {
        headers['accept-version'] = '1.2';
        if (input) headers['host'] = input;
      } else if (stompCommand === 'UNSUBSCRIBE' || stompCommand === 'ACK' || stompCommand === 'NACK') {
        if (input) headers['id'] = input;
      } else {
        if (input) headers['destination'] = input;
      }
      if (stompCommand === 'SUBSCRIBE') {
        headers['id'] = `sub-${Date.now()}`;
      }
      const body = composeText.trim() || undefined;
      if (body) headers['content-length'] = String(new TextEncoder().encode(body).length);
      const encoded = encodeStompFrame(stompCommand, headers, body);
      onSend(encoded, 'text');
      setComposeText('');
      return;
    }
    if (isGqlMode) {
      const query = composeText.trim();
      let variables: Record<string, unknown> | undefined;
      const varsTrimmed = gqlVariables.trim();
      if (varsTrimmed.length > 0) {
        try { variables = JSON.parse(varsTrimmed); } catch { /* invalid JSON ignored */ }
      }
      const opName = gqlOperationName.trim() || undefined;
      const id = String(gqlOperationId);
      const encoded = encodeGqlWsSubscribe(id, query, variables, opName);
      onSend(encoded, 'text');
      setGqlOperationId((prev) => prev + 1);
      setComposeText('');
      return;
    }
    onSend(composeText.trim(), composeFormat);
    setComposeText('');
  }, [composeText, composeFormat, canSend, onSend, isSioMode, sioEventName, sioNamespace, isStompMode, stompCommand, stompDestination, isGqlMode, gqlVariables, gqlOperationName, gqlOperationId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleBeautify = useCallback(() => {
    if (composeFormat !== 'json') return;
    try {
      const parsed = JSON.parse(composeText);
      setComposeText(JSON.stringify(parsed, null, 2));
    } catch {
      // leave as-is if invalid JSON
    }
  }, [composeText, composeFormat]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledUpRef.current = !isAtBottom;
  }, []);

  useEffect(() => {
    if (!userScrolledUpRef.current && logEndRef.current && typeof logEndRef.current.scrollIntoView === 'function') {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleRowClick = useCallback((id: string) => {
    setSelectedMessageId((prev) => (prev === id ? null : id));
  }, []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value),
    [setSearchText],
  );

  const visibleMessages = useMemo(
    () => showControlFrames
      ? messages
      : messages.filter((f) => !CONTROL_FRAME_TYPES.has(f.type) && !f.protocolMeta?.isSystemPacket && !(f as WsFrame & { isSystem?: boolean }).isSystem),
    [messages, showControlFrames],
  );

  const handleExportMessages = useCallback(() => {
    const exportData = allMessages.map((f) => ({
      id: f.id,
      direction: f.direction,
      type: f.type,
      data: f.data,
      size: f.size,
      timestamp: f.timestamp,
      protocolMeta: f.protocolMeta ?? undefined,
    }));
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ws-messages-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allMessages]);

  // Template dropdown handlers
  const handleTemplateLoad = useCallback(
    (id: string) => {
      const tpl = onLoadTemplate(id);
      if (tpl) {
        setComposeText(tpl.body);
        setComposeFormat(tpl.format);
        setTemplateDropdownOpen(false);
      }
    },
    [onLoadTemplate],
  );

  const handleTemplateSave = useCallback(async () => {
    const name = templateSaveName.trim();
    if (!name || !composeText.trim()) return;
    await onSaveTemplate(name, composeText, composeFormat);
    setTemplateSaveName('');
  }, [templateSaveName, composeText, composeFormat, onSaveTemplate]);

  const handleTemplateDelete = useCallback(
    async (id: string) => {
      await onDeleteTemplate(id);
    },
    [onDeleteTemplate],
  );

  // Detail panel navigation
  const selectedFrame = useMemo(
    () => (selectedMessageId ? messages.find((m) => m.id === selectedMessageId) ?? null : null),
    [selectedMessageId, messages],
  );

  const selectedIndex = useMemo(
    () => (selectedMessageId ? messages.findIndex((m) => m.id === selectedMessageId) : -1),
    [selectedMessageId, messages],
  );

  const handleDetailClose = useCallback(() => {
    setSelectedMessageId(null);
  }, []);

  const handleDetailPrev = useCallback(() => {
    if (selectedIndex > 0) {
      setSelectedMessageId(messages[selectedIndex - 1].id);
    }
  }, [selectedIndex, messages]);

  const handleDetailNext = useCallback(() => {
    if (selectedIndex < messages.length - 1) {
      setSelectedMessageId(messages[selectedIndex + 1].id);
    }
  }, [selectedIndex, messages]);

  // Keyboard navigation in the message list
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedIndex < messages.length - 1) {
          setSelectedMessageId(messages[selectedIndex + 1].id);
        } else if (selectedIndex === -1 && messages.length > 0) {
          setSelectedMessageId(messages[0].id);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedIndex > 0) {
          setSelectedMessageId(messages[selectedIndex - 1].id);
        }
      } else if (e.key === 'Escape') {
        setSelectedMessageId(null);
      }
    },
    [selectedIndex, messages],
  );

  const isJsonValid = composeFormat === 'json' && composeText.trim().length > 0 && isValidJson(composeText);
  const isBase64Invalid = composeFormat === 'binary' && composeText.trim().length > 0 && !isValidBase64(composeText);

  const statusDotClass = isConnected ? 'connected' : 'disconnected';

  const composeBar = (
    <div className="ws-compose-bar">
      {isSioMode && (
        <div className="ws-sio-compose-fields" data-testid="sio-compose-fields">
          <input
            className="ws-sio-event-input"
            type="text"
            value={sioEventName}
            onChange={(e) => setSioEventName(e.target.value)}
            placeholder="Event name"
            disabled={!isConnected}
            aria-label="Socket.IO event name"
            data-testid="sio-event-name"
          />
          <input
            className="ws-sio-namespace-input"
            type="text"
            value={sioNamespace}
            onChange={(e) => setSioNamespace(e.target.value)}
            placeholder="Namespace (/)"
            disabled={!isConnected}
            aria-label="Socket.IO namespace"
            data-testid="sio-namespace"
          />
        </div>
      )}
      {isStompMode && (
        <div className="ws-stomp-compose-fields" data-testid="stomp-compose-fields">
          <select
            className="ws-stomp-command-select"
            value={stompCommand}
            onChange={(e) => setStompCommand(e.target.value)}
            disabled={!isConnected}
            aria-label="STOMP command"
            data-testid="stomp-command"
          >
            <option value="SEND">SEND</option>
            <option value="SUBSCRIBE">SUBSCRIBE</option>
            <option value="UNSUBSCRIBE">UNSUBSCRIBE</option>
            <option value="CONNECT">CONNECT</option>
            <option value="DISCONNECT">DISCONNECT</option>
            <option value="ACK">ACK</option>
            <option value="NACK">NACK</option>
          </select>
          <input
            className="ws-stomp-destination-input"
            type="text"
            value={stompDestination}
            onChange={(e) => setStompDestination(e.target.value)}
            placeholder={
              stompCommand === 'CONNECT' ? 'Host (e.g. broker.local)'
              : (stompCommand === 'UNSUBSCRIBE' || stompCommand === 'ACK' || stompCommand === 'NACK') ? 'ID (e.g. sub-0 or msg-42)'
              : 'Destination (e.g. /topic/chat)'
            }
            disabled={!isConnected}
            aria-label={
              stompCommand === 'CONNECT' ? 'STOMP host'
              : (stompCommand === 'UNSUBSCRIBE' || stompCommand === 'ACK' || stompCommand === 'NACK') ? 'STOMP ID'
              : 'STOMP destination'
            }
            data-testid="stomp-destination"
          />
        </div>
      )}
      {isGqlMode && (
        <div className="ws-gql-compose-fields" data-testid="gql-compose-fields">
          <input
            className="ws-gql-operation-name-input"
            type="text"
            value={gqlOperationName}
            onChange={(e) => setGqlOperationName(e.target.value)}
            placeholder="Operation name (optional)"
            disabled={!isConnected}
            aria-label="GraphQL operation name"
            data-testid="gql-operation-name"
          />
          <textarea
            className="ws-gql-variables-input"
            value={gqlVariables}
            onChange={(e) => setGqlVariables(e.target.value)}
            placeholder='Variables (JSON) e.g. {"id": "1"}'
            disabled={!isConnected}
            aria-label="GraphQL variables"
            data-testid="gql-variables"
            rows={2}
          />
          <span className="ws-gql-op-id" data-testid="gql-op-id">Op #{gqlOperationId}</span>
        </div>
      )}
      <div className="ws-compose-input-wrapper">
        <textarea
          className={`ws-compose-input ${composeFormat === 'binary' ? 'ws-compose-mono' : ''}`}
          value={composeText}
          onChange={(e) => setComposeText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !isConnected
              ? 'Connect to send messages'
              : isSioMode
                ? 'Event data (JSON or text)\u2026'
                : isStompMode
                  ? 'Message body (optional)\u2026'
                  : isGqlMode
                    ? 'subscription { onMessage { id text } }'
                    : 'Type a message\u2026'
          }
          disabled={!isConnected}
          rows={2}
          aria-label="Message input"
        />
        {isBase64Invalid && (
          <span className="ws-compose-hint" data-testid="base64-hint">Invalid Base64</span>
        )}
      </div>
      <div className="ws-compose-controls">
        {!isSioMode && !isStompMode && !isGqlMode && (
          <>
            <label className="ws-format-label" htmlFor="ws-format-select">Format:</label>
            <select
              id="ws-format-select"
              className="ws-format-select"
              value={composeFormat}
              onChange={(e) => setComposeFormat(e.target.value as WsMessageFormat)}
              aria-label="Message format"
              data-testid="format-select"
            >
              <option value="text">Text</option>
              <option value="json">JSON</option>
              <option value="binary">Binary (Base64)</option>
            </select>
            {composeFormat === 'json' && (
              <button
                className="ws-beautify-btn"
                onClick={handleBeautify}
                disabled={!composeText.trim() || !isJsonValid}
                title="Beautify JSON"
                data-testid="beautify-btn"
              >
                {'{ } Beautify'}
              </button>
            )}
          </>
        )}
        {isSioMode && (
          <span className="ws-sio-mode-badge" data-testid="sio-mode-badge">Socket.IO</span>
        )}
        {isStompMode && (
          <span className="ws-stomp-mode-badge" data-testid="stomp-mode-badge">STOMP</span>
        )}
        {isGqlMode && (
          <span className="ws-gql-mode-badge" data-testid="gql-mode-badge">GraphQL</span>
        )}
        <div className="ws-template-wrapper" ref={templateDropdownRef}>
          <button
            className="ws-template-trigger"
            onClick={() => setTemplateDropdownOpen((v) => !v)}
            data-testid="template-trigger"
          >
            Templates ▾
          </button>
          {templateDropdownOpen && (
            <div className="ws-template-dropdown" data-testid="template-dropdown">
              <div className="ws-template-dropdown-header">Saved Templates</div>
              {templates.length === 0 ? (
                <div className="ws-template-empty" data-testid="template-empty">
                  No saved templates. Type a message and save it.
                </div>
              ) : (
                <div className="ws-template-list" data-testid="template-list">
                  {templates.map((tpl) => (
                    <div className="ws-template-item" key={tpl.id} data-testid={`template-item-${tpl.id}`}>
                      <button
                        className="ws-template-item-load"
                        onClick={() => handleTemplateLoad(tpl.id)}
                        title={`Load: ${tpl.name}`}
                      >
                        <span className="ws-template-item-name">{tpl.name}</span>
                        <span className="ws-template-item-preview">
                          {tpl.body.length > 60 ? tpl.body.slice(0, 60) + '\u2026' : tpl.body}
                        </span>
                        <span className="ws-template-item-format">{tpl.format}</span>
                      </button>
                      <button
                        className="ws-template-item-delete"
                        onClick={() => handleTemplateDelete(tpl.id)}
                        title="Delete template"
                        data-testid={`template-delete-${tpl.id}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="ws-template-save-row">
                <input
                  className="ws-template-save-input"
                  type="text"
                  value={templateSaveName}
                  onChange={(e) => setTemplateSaveName(e.target.value)}
                  placeholder="Template name..."
                  maxLength={100}
                  data-testid="template-save-name"
                />
                <button
                  className="ws-template-save-btn"
                  onClick={handleTemplateSave}
                  disabled={!templateSaveName.trim() || !composeText.trim()}
                  data-testid="template-save-btn"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          className="ws-compose-send-btn"
          onClick={handleSend}
          disabled={!canSend}
          title="Send (Cmd+Enter / Ctrl+Enter)"
          data-testid="send-btn"
        >
          Send
        </button>
        <button
          className="ws-compose-ping-btn"
          onClick={onPing}
          disabled={!isConnected || transportMode !== 'proxy'}
          title={transportMode === 'proxy' ? 'Send WebSocket ping frame' : 'Ping requires proxy transport (add a custom header to enable)'}
          data-testid="ping-btn"
        >
          Ping
        </button>
      </div>
      <div className="ws-compose-footer" data-testid="compose-footer">
        {totalCount} / {maxMessages} messages
      </div>
    </div>
  );

  return (
    <div className="ws-message-log-container">
      {showStatusBar && (
        <div className="ws-messages-status-bar" data-testid="messages-status-bar">
          <span className={`ws-status-dot ${statusDotClass}`} aria-hidden="true" />
          <span className="ws-messages-status-label">{isConnected ? 'Connected' : 'Disconnected'}</span>
          {connectionUrl && (
            <span className="ws-messages-status-url" title={connectionUrl}>{connectionUrl}</span>
          )}
          {uptime != null && (
            <span className="ws-messages-status-metric">Uptime: {formatUptime(uptime)}</span>
          )}
          <span className="ws-messages-status-metric">↑ {sentCount} &nbsp; ↓ {receivedCount}</span>
          <span className="ws-messages-status-hints">↑↓ navigate · Esc close detail</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="ws-message-log-toolbar">
        <input
          className="ws-message-search"
          type="text"
          value={searchText}
          onChange={handleSearchChange}
          placeholder="Search messages\u2026"
          aria-label="Search messages"
        />
        <select
          className="ws-message-direction-filter"
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value as WsDirectionFilter)}
          aria-label="Direction filter"
        >
          <option value="all">All</option>
          <option value="sent">Sent</option>
          <option value="received">Received</option>
        </select>
        <button
          className="ws-message-clear-btn"
          onClick={onClear}
          disabled={totalCount === 0}
          data-testid="clear-btn"
        >
          Clear
        </button>
        <button
          className="ws-message-export-btn"
          onClick={handleExportMessages}
          disabled={allMessages.length === 0}
          data-testid="export-messages-btn"
        >
          Export
        </button>
        <label className="ws-control-frame-toggle" data-testid="control-frame-toggle" title="Show/hide ping, pong, close, heartbeat, and protocol system packets">
          <input
            type="checkbox"
            checked={showControlFrames}
            onChange={(e) => setShowControlFrames(e.target.checked)}
            data-testid="control-frame-checkbox"
          />
          System Frames
        </label>
        {isMaxReached && (
          <span className="ws-message-max-reached" data-testid="max-reached">
            {totalCount}/{maxMessages} — max reached
          </span>
        )}
      </div>

      {/* Message list */}
      <div
        className="ws-message-list"
        ref={listRef}
        onScroll={handleScroll}
        onKeyDown={handleListKeyDown}
        tabIndex={0}
        data-testid="message-list"
      >
        {visibleMessages.length === 0 && (
          <div className="ws-message-empty" data-testid="empty-state">
            {totalCount === 0 ? 'No messages yet' : 'No messages match filters'}
          </div>
        )}
        {visibleMessages.map((frame) => {
          const meta = frame.protocolMeta;
          const isSystem = frame.type === 'close' || meta?.isSystemPacket || !!(frame as WsFrame & { isSystem?: boolean }).isSystem;
          const isCloseSent = frame.data.startsWith('CLOSE SENT');
          const isCloseAck = frame.data.startsWith('CLOSE ACK');
          const isJson = frame.type !== 'binary' && isValidJson(frame.data);
          const isBinary = frame.type === 'binary';
          const typeLabel = meta ? meta.packetType : frame.type;

          let contentDisplay: React.ReactNode;
          if (meta?.summary) {
            contentDisplay = meta.summary;
          } else if (isBinary) {
            contentDisplay = buildBinaryPreview(frame.data, frame.size);
          } else if (isJson && frame.data.length <= 500) {
            const pretty = prettyJson(frame.data);
            const display = pretty.length > 500 ? pretty.slice(0, 500) + '\u2026' : pretty;
            contentDisplay = renderInlineJson(display);
          } else {
            const preview = frame.data.length > 500 ? frame.data.slice(0, 500) + '\u2026' : frame.data;
            contentDisplay = preview;
          }

          const rowClasses = [
            'ws-message-row',
            isSystem ? '' : (frame.direction === 'sent' ? 'ws-message-sent' : 'ws-message-received'),
            isSystem ? 'ws-message-system' : '',
            meta ? 'ws-message-protocol' : '',
            selectedMessageId === frame.id ? 'ws-msg-selected selected' : '',
            isCloseSent ? 'ws-message-close-sent' : '',
            isCloseAck ? 'ws-message-close-ack' : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={frame.id}
              className={rowClasses}
              onClick={() => handleRowClick(frame.id)}
              role="button"
              tabIndex={-1}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(frame.id); }}
              aria-label={isSystem ? 'system message' : `${frame.direction} message`}
              data-testid={`message-row-${frame.id}`}
            >
              <span className="ws-message-direction">
                {isSystem ? '◆' : frame.direction === 'sent' ? '↑' : '↓'}
              </span>
              <span className="ws-message-timestamp">
                {formatWsTimestamp(frame.timestamp)}
              </span>
              <span className={`ws-message-type ${meta ? 'ws-message-type-protocol' : ''}`} data-type={typeLabel}>{typeLabel}</span>
              <span className="ws-message-content">{contentDisplay}</span>
              <span className="ws-message-size">{formatBytes(frame.size)}</span>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>

      {/* Detail panel */}
      {selectedFrame && (
        <WebSocketMessageDetail
          frame={selectedFrame}
          onClose={handleDetailClose}
          onPrev={handleDetailPrev}
          onNext={handleDetailNext}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < messages.length - 1}
        />
      )}

      {composeBar}
    </div>
  );
}
