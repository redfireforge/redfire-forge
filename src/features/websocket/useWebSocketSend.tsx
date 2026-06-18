import { useCallback, useMemo, useState } from 'react';
import type { WsMessageFormat, WsMessageTemplate } from '../../shared/websocket/types';
import type { WsProtocolMode } from '../../shared/websocket/protocols/protocolTypes';
import { isValidJson, isValidBase64 } from './wsMessageUtils';
import { encodeSioEvent } from '../../shared/websocket/protocols/socketIoCodec';
import { encodeStompFrame } from '../../shared/websocket/protocols/stompCodec';
import { encodeGqlWsSubscribe } from '../../shared/websocket/protocols/graphqlWsCodec';
import { useDropdownClose } from './useDropdownClose';

export interface UseWebSocketSendOptions {
  isConnected: boolean;
  effectiveProtocol?: Exclude<WsProtocolMode, 'auto'>;
  onSend: (data: string, format?: WsMessageFormat) => void;
  onPing?: () => void;
  templates: WsMessageTemplate[];
  onSaveTemplate: (name: string, body: string, format: WsMessageFormat) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onLoadTemplate: (id: string) => { body: string; format: WsMessageFormat } | null;
  transportMode?: 'direct' | 'proxy' | 'native';
  totalCount: number;
  maxMessages: number;
}

export interface UseWebSocketSendReturn {
  composeBar: React.ReactNode;
  composeText: string;
  composeFormat: WsMessageFormat;
  isJsonValid: boolean;
  isBase64Invalid: boolean;
}

export function useWebSocketSend({
  isConnected,
  effectiveProtocol,
  onSend,
  onPing,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onLoadTemplate,
  transportMode,
  totalCount,
  maxMessages,
}: UseWebSocketSendOptions): UseWebSocketSendReturn {
  const [composeText, setComposeText] = useState('');
  const [composeFormat, setComposeFormat] = useState<WsMessageFormat>('text');
  const [sioEventName, setSioEventName] = useState('');
  const [sioNamespace, setSioNamespace] = useState('/');
  const [stompCommand, setStompCommand] = useState('SEND');
  const [stompDestination, setStompDestination] = useState('');
  const [stompLogin, setStompLogin] = useState('');
  const [stompPasscode, setStompPasscode] = useState('');
  const [gqlVariables, setGqlVariables] = useState('');
  const [gqlOperationName, setGqlOperationName] = useState('');
  const [gqlOperationId, setGqlOperationId] = useState(1);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState('');

  const isSioMode = effectiveProtocol === 'socket-io';
  const isStompMode = effectiveProtocol === 'stomp';
  const isGqlMode = effectiveProtocol === 'graphql-ws';

  const templateDropdownRef = useDropdownClose(
    templateDropdownOpen,
    useCallback(() => setTemplateDropdownOpen(false), []),
  );

  const canSend = useMemo(() => {
    if (!isConnected) return false;
    if (isSioMode) return sioEventName.trim().length > 0;
    if (isStompMode) {
      const needsInput = stompCommand === 'SEND' || stompCommand === 'SUBSCRIBE'
        || stompCommand === 'UNSUBSCRIBE' || stompCommand === 'ACK' || stompCommand === 'NACK';
      if (needsInput && stompDestination.trim().length === 0) return false;
      return true;
    }
    if (isGqlMode) return composeText.trim().length > 0;
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
        // Negotiate heartbeats: keeps connection alive during long reading pauses.
        // Format: "<send-interval-ms>,<receive-interval-ms>" — 10s each.
        headers['heart-beat'] = '10000,10000';
        if (input) headers['host'] = input;
        // Include broker credentials when supplied in the CONNECT-only fields
        if (stompLogin.trim()) headers['login'] = stompLogin.trim();
        if (stompPasscode.trim()) headers['passcode'] = stompPasscode.trim();
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
  }, [composeText, composeFormat, canSend, onSend, isSioMode, sioEventName, sioNamespace, isStompMode, stompCommand, stompDestination, stompLogin, stompPasscode, isGqlMode, gqlVariables, gqlOperationName, gqlOperationId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handlePrettyFormat = useCallback(() => {
    if (composeFormat !== 'json') return;
    try {
      const parsed = JSON.parse(composeText);
      setComposeText(JSON.stringify(parsed, null, 2));
    } catch { /* leave as-is */ }
  }, [composeText, composeFormat]);

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

  const isJsonValidVal = composeFormat === 'json' && composeText.trim().length > 0 && isValidJson(composeText);
  const isBase64InvalidVal = composeFormat === 'binary' && composeText.trim().length > 0 && !isValidBase64(composeText);

  const composeBar = (
    <div className="ws-compose-bar">
      {isSioMode && (
        <div className="ws-sio-compose-fields" data-testid="sio-compose-fields">
          <div className="ws-sio-field-group">
            <label className="ws-sio-field-label" htmlFor="sio-event-name-input">
              Event Name
              <span className="ws-sio-field-hint">e.g. message, chat, ping</span>
            </label>
            <input
              id="sio-event-name-input"
              className="ws-sio-event-input"
              type="text"
              value={sioEventName}
              onChange={(e) => setSioEventName(e.target.value)}
              placeholder="message"
              disabled={!isConnected}
              aria-label="Socket.IO event name"
              data-testid="sio-event-name"
            />
          </div>
          <div className="ws-sio-field-group ws-sio-field-group--narrow">
            <label className="ws-sio-field-label" htmlFor="sio-namespace-input">
              Namespace
              <span className="ws-sio-field-hint">/ = root channel</span>
            </label>
            <input
              id="sio-namespace-input"
              className="ws-sio-namespace-input"
              type="text"
              value={sioNamespace}
              onChange={(e) => setSioNamespace(e.target.value)}
              placeholder="/"
              disabled={!isConnected}
              aria-label="Socket.IO namespace"
              data-testid="sio-namespace"
            />
          </div>
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
              stompCommand === 'CONNECT' ? 'Virtual host (e.g. /)'
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
          {(stompCommand === 'CONNECT' || stompCommand === 'STOMP') && (
            <>
              <input
                className="ws-stomp-auth-input"
                type="text"
                value={stompLogin}
                onChange={(e) => setStompLogin(e.target.value)}
                placeholder="Login (e.g. guest)"
                disabled={!isConnected}
                aria-label="STOMP login"
                data-testid="stomp-login"
              />
              <input
                className="ws-stomp-auth-input ws-stomp-passcode-input"
                type="password"
                value={stompPasscode}
                onChange={(e) => setStompPasscode(e.target.value)}
                placeholder="Passcode"
                disabled={!isConnected}
                aria-label="STOMP passcode"
                data-testid="stomp-passcode"
              />
            </>
          )}
        </div>
      )}
      {isGqlMode && (
        <div className="ws-gql-compose-fields" data-testid="gql-compose-fields">
          <div className="ws-gql-meta-row">
            <div className="ws-gql-field ws-gql-field--op-name">
              <span className="ws-gql-field-icon" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              </span>
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
            </div>
            <div className="ws-gql-field ws-gql-field--vars">
              <span className="ws-gql-field-icon" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              </span>
              <input
                className="ws-gql-variables-input ws-gql-variables-input--inline"
                type="text"
                value={gqlVariables}
                onChange={(e) => setGqlVariables(e.target.value)}
                placeholder='Variables JSON — {"id": "1"}'
                disabled={!isConnected}
                aria-label="GraphQL variables"
                data-testid="gql-variables"
              />
              {gqlVariables.trim() && (() => {
                try { JSON.parse(gqlVariables); return <span className="ws-gql-vars-valid" title="Valid JSON" aria-label="Valid JSON">✓</span>; }
                catch { return <span className="ws-gql-vars-invalid" title="Invalid JSON" aria-label="Invalid JSON">!</span>; }
              })()}
            </div>
            <span className="ws-gql-op-id-badge" data-testid="gql-op-id">#{gqlOperationId}</span>
          </div>
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
              ? 'Connect to send messages…'
              : isSioMode
                ? 'Event data (JSON or text)\u2026'
                : isStompMode
                  ? 'Message body (optional)\u2026'
                  : isGqlMode
                    ? 'subscription { countdown(from: 5) }'
                    : 'Type a message\u2026'
          }
          disabled={!isConnected}
          rows={6}
          aria-label="Message input"
        />
        {composeText.length > 0 && isConnected && (
          <button
            className="ws-compose-clear-btn"
            onClick={() => setComposeText('')}
            title="Clear"
            aria-label="Clear message"
            data-testid="compose-clear-btn"
            type="button"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
        {composeText.length > 0 && (
          <span className="ws-compose-char-count" aria-label={`${composeText.length} characters`}>
            {composeText.split('\n').length}L · {composeText.length}c
          </span>
        )}
        {isBase64InvalidVal && (
          <span className="ws-compose-hint" data-testid="base64-hint">Invalid Base64</span>
        )}
      </div>
      <div className="ws-compose-controls">
        {/* ── Left zone: format pills or protocol badge ── */}
        <div className="ws-compose-controls-left">
          {!isSioMode && !isStompMode && !isGqlMode && (
            <div className="ws-format-pills" role="group" aria-label="Message format" data-testid="format-pills">
              {(['text', 'json', 'binary'] as WsMessageFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className={`ws-format-pill ${composeFormat === fmt ? 'ws-format-pill--active' : ''}`}
                  onClick={() => setComposeFormat(fmt)}
                  aria-pressed={composeFormat === fmt}
                  data-testid={`format-pill-${fmt}`}
                >
                  {fmt === 'text' ? 'Text' : fmt === 'json' ? 'JSON' : 'Base64'}
                </button>
              ))}
            </div>
          )}
          {isSioMode && <span className="ws-protocol-badge ws-protocol-badge--sio" data-testid="sio-mode-badge">Socket.IO</span>}
          {isStompMode && <span className="ws-protocol-badge ws-protocol-badge--stomp" data-testid="stomp-mode-badge">STOMP</span>}
          {isGqlMode && <span className="ws-protocol-badge ws-protocol-badge--gql" data-testid="gql-mode-badge">GraphQL-WS</span>}
        </div>

        {/* ── Right zone: utility actions + primary actions ── */}
        <div className="ws-compose-controls-right">
          {composeFormat === 'json' && !isSioMode && !isStompMode && !isGqlMode && (
            <button
              className="ws-pretty-format-btn"
              onClick={handlePrettyFormat}
              disabled={!composeText.trim() || !isJsonValidVal}
              title="Pretty-print JSON"
              data-testid="pretty-format-btn"
              type="button"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
              Format
            </button>
          )}
          <div className="ws-compose-controls-divider" aria-hidden="true" />
          <div className="ws-template-wrapper" ref={templateDropdownRef}>
            <button
              className="ws-template-trigger"
              onClick={() => setTemplateDropdownOpen((v) => !v)}
              data-testid="template-trigger"
              type="button"
              title={templates.length > 0 ? `${templates.length} saved template${templates.length !== 1 ? 's' : ''}` : 'Message templates'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              {templates.length > 0 && <span className="ws-template-count">{templates.length}</span>}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ws-template-chevron" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {templateDropdownOpen && (
              <div className="ws-template-dropdown" data-testid="template-dropdown">
                <div className="ws-template-dropdown-header">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  Saved Templates
                </div>
                {templates.length === 0 ? (
                  <div className="ws-template-empty" data-testid="template-empty">
                    No templates yet. Type a message and save it below.
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
                          <span className="ws-template-item-head">
                            <span className="ws-template-item-name">{tpl.name}</span>
                            <span className={`ws-template-item-format ws-template-item-format-${tpl.format}`}>
                              {tpl.format}
                            </span>
                          </span>
                          <span className="ws-template-item-preview">
                            {tpl.body.length > 60 ? tpl.body.slice(0, 60) + '\u2026' : tpl.body}
                          </span>
                        </button>
                        <button
                          className="ws-template-item-delete"
                          onClick={() => handleTemplateDelete(tpl.id)}
                          title="Delete template"
                          data-testid={`template-delete-${tpl.id}`}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
                    placeholder="Template name…"
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
            className="ws-compose-ping-btn"
            onClick={onPing}
            disabled={!isConnected || transportMode === 'direct'}
            title={transportMode !== 'direct' ? 'Send WebSocket ping frame' : 'Ping requires proxy or native transport'}
            data-testid="ping-btn"
            type="button"
          >
            Ping
          </button>

          <button
            className="ws-compose-send-btn"
            onClick={handleSend}
            disabled={!canSend}
            title="Send (Cmd+Enter / Ctrl+Enter)"
            data-testid="send-btn"
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send
            <kbd className="ws-send-kbd">⌘↵</kbd>
          </button>
        </div>
      </div>
      <div className="ws-compose-footer" data-testid="compose-footer">
        <span className="ws-compose-msg-count">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          {totalCount.toLocaleString()} / {maxMessages.toLocaleString()}
        </span>
        <div
          className="ws-compose-msg-bar"
          style={{ width: `${Math.min(100, (totalCount / maxMessages) * 100)}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );

  return {
    composeBar,
    composeText,
    composeFormat,
    isJsonValid: isJsonValidVal,
    isBase64Invalid: isBase64InvalidVal,
  };
}
