import { useCallback, useMemo, useState } from 'react';
import type { WsMessageFormat, WsMessageTemplate } from '../../shared/websocket/types';
import type { WsProtocolMode } from '../../shared/websocket/protocols/protocolTypes';
import { isValidJson, isValidBase64 } from './wsMessageUtils';
import { encodeSioEvent } from '../../shared/websocket/protocols/socketIoCodec';
import { encodeStompFrame } from '../../shared/websocket/protocols/stompCodec';
import { encodeGqlWsSubscribe } from '../../shared/websocket/protocols/graphqlWsCodec';
import { useDropdownClose } from './useDropdownClose';

export interface UseWebSocketComposeOptions {
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

export interface UseWebSocketComposeReturn {
  composeBar: React.ReactNode;
  composeText: string;
  composeFormat: WsMessageFormat;
  isJsonValid: boolean;
  isBase64Invalid: boolean;
}

export function useWebSocketCompose({
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
}: UseWebSocketComposeOptions): UseWebSocketComposeReturn {
  const [composeText, setComposeText] = useState('');
  const [composeFormat, setComposeFormat] = useState<WsMessageFormat>('text');
  const [sioEventName, setSioEventName] = useState('');
  const [sioNamespace, setSioNamespace] = useState('/');
  const [stompCommand, setStompCommand] = useState('SEND');
  const [stompDestination, setStompDestination] = useState('');
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
        {isBase64InvalidVal && (
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
                disabled={!composeText.trim() || !isJsonValidVal}
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
          disabled={!isConnected || transportMode === 'direct'}
          title={transportMode !== 'direct' ? 'Send WebSocket ping frame' : 'Ping requires proxy or native transport'}
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

  return {
    composeBar,
    composeText,
    composeFormat,
    isJsonValid: isJsonValidVal,
    isBase64Invalid: isBase64InvalidVal,
  };
}
