//! WebSocket lifecycle commands: connect, disconnect, status.
//!
//! `ws_connect` establishes a WebSocket connection, splits it into read/write
//! halves, spawns background loops for both, and stores the connection handle.
//! `ws_disconnect` gracefully closes a connection. `ws_status` returns live
//! connection metadata including counters and uptime.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::Engine;
use futures::stream::{SplitSink, SplitStream};
use futures::{SinkExt, StreamExt};
use serde_json::Value;
use tauri::Emitter;
use tokio::sync::{broadcast, mpsc};
use tokio_tungstenite::connect_async_tls_with_config;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http;
use tokio_tungstenite::tungstenite::protocol::CloseFrame;
use tokio_tungstenite::tungstenite::Message;
use tokio_util::sync::CancellationToken;

use super::config::{build_ws_connector, connect_error_code};
use super::envelope::{
    disconnected_status, error_envelope, handle_to_status, now_iso, success_envelope,
};
use super::state::{ConnectionHandle, ConnectionId, WsInboundMessage, WsOutboundMessage, WsState};
use super::types::{
    WsConnectRequest, WsConnectResult, WsConnectionClosedPayload, WsDisconnectRequest,
    WsDisconnectResult, WsMessagePayload, WsStatusRequest,
};

const WRITE_CHANNEL_BUFFER: usize = 256;
const BROADCAST_CHANNEL_CAPACITY: usize = 256;
const DEFAULT_CONNECT_TIMEOUT_MS: u64 = 10_000;

type WsStream = tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
>;
type WsWriter = SplitSink<WsStream, Message>;
type WsReader = SplitStream<WsStream>;
type StateMap = Arc<Mutex<HashMap<ConnectionId, ConnectionHandle>>>;

// ─── ws_connect ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ws_connect(
    app: tauri::AppHandle,
    state: tauri::State<'_, WsState>,
    request: WsConnectRequest,
) -> Result<Value, String> {
    let start = Instant::now();

    // 1. Validate URL scheme (case-insensitive, trimmed)
    let url = request.url.trim().to_string();
    let lower = url.to_lowercase();
    if !lower.starts_with("ws://") && !lower.starts_with("wss://") {
        return Ok(error_envelope(
            "connect",
            "WS_INVALID_URL",
            &format!("URL must start with ws:// or wss://, got: {}", url),
            Some(false),
        ));
    }

    // 2. Generate connection ID
    let connection_id = uuid::Uuid::new_v4().to_string();

    // 3. Build TLS connector (app-level errors → error envelope, not Err)
    let connector = match build_ws_connector(request.tls.as_ref()) {
        Ok(c) => c,
        Err(e) => {
            return Ok(error_envelope(
                "connect",
                "WS_TLS_ERROR",
                &e,
                Some(false),
            ));
        }
    };

    // 4. Build HTTP request with headers + subprotocols
    let mut ws_request = match url.as_str().into_client_request() {
        Ok(r) => r,
        Err(e) => {
            return Ok(error_envelope(
                "connect",
                "WS_INVALID_URL",
                &format!("Invalid WebSocket URL: {}", e),
                Some(false),
            ));
        }
    };

    if let Some(headers) = &request.headers {
        for (key, value) in headers {
            let name: http::header::HeaderName = match key.parse() {
                Ok(n) => n,
                Err(e) => {
                    return Ok(error_envelope(
                        "connect",
                        "WS_INVALID_URL",
                        &format!("Invalid header name '{}': {}", key, e),
                        Some(false),
                    ));
                }
            };
            let val = match http::header::HeaderValue::from_str(value) {
                Ok(v) => v,
                Err(e) => {
                    return Ok(error_envelope(
                        "connect",
                        "WS_INVALID_URL",
                        &format!("Invalid header value for '{}': {}", key, e),
                        Some(false),
                    ));
                }
            };
            ws_request.headers_mut().insert(name, val);
        }
    }

    if let Some(subprotocols) = &request.subprotocols {
        let filtered: Vec<&str> = subprotocols.iter().map(|s| s.as_str()).filter(|s| !s.is_empty()).collect();
        if !filtered.is_empty() {
            if let Ok(val) = http::header::HeaderValue::from_str(&filtered.join(", ")) {
                ws_request
                    .headers_mut()
                    .insert(http::header::SEC_WEBSOCKET_PROTOCOL, val);
            }
        }
    }

    // 5. Connect with timeout (timeout → WS_CONNECT_TIMEOUT envelope, not Err)
    let timeout_ms = request.timeout_ms.unwrap_or(DEFAULT_CONNECT_TIMEOUT_MS);
    let connect_future = connect_async_tls_with_config(ws_request, None, false, connector);

    let connect_result = match tokio::time::timeout(
        Duration::from_millis(timeout_ms),
        connect_future,
    )
    .await
    {
        Ok(result) => result,
        Err(_) => {
            return Ok(error_envelope(
                "connect",
                "WS_CONNECT_TIMEOUT",
                &format!("Connection timed out after {}ms", timeout_ms),
                Some(true),
            ));
        }
    };

    let (ws_stream, response) = match connect_result {
        Ok(pair) => pair,
        Err(e) => {
            let code = connect_error_code(&e);
            return Ok(error_envelope("connect", code, &e.to_string(), Some(true)));
        }
    };

    let latency_ms = start.elapsed().as_millis() as u64;

    // 6. Extract negotiated protocol + extensions from response
    let protocol = response
        .headers()
        .get("sec-websocket-protocol")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let extensions = response
        .headers()
        .get("sec-websocket-extensions")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    // 7. Split into read/write halves
    let (write_half, read_half) = ws_stream.split();

    // 8. Create channels
    let (write_tx, write_rx) = mpsc::channel::<WsOutboundMessage>(WRITE_CHANNEL_BUFFER);
    let (broadcast_tx, _) = broadcast::channel::<WsInboundMessage>(BROADCAST_CHANNEL_CAPACITY);
    let cancel_token = CancellationToken::new();

    // 9. Store connection handle
    let connected_at = now_iso();
    let now_epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let handle = ConnectionHandle {
        url: url.clone(),
        connected_since: Instant::now(),
        connected_at,
        messages_sent: AtomicU64::new(0),
        messages_received: AtomicU64::new(0),
        last_activity_ms: AtomicU64::new(now_epoch),
        write_tx,
        broadcast_tx: broadcast_tx.clone(),
        cancel_token: cancel_token.clone(),
        protocol: if protocol.is_empty() {
            None
        } else {
            Some(protocol.clone())
        },
        extensions: if extensions.is_empty() {
            None
        } else {
            Some(extensions.clone())
        },
    };

    {
        let mut map = state.inner.lock().map_err(|e| e.to_string())?;
        map.insert(connection_id.clone(), handle);
    }

    // 10. Spawn write loop (shares cancel_token so write errors stop the read loop)
    spawn_write_loop(write_rx, write_half, cancel_token.clone());

    // 11. Spawn read loop (needs Arc<Mutex> clone for counter updates + ping forwarding)
    let state_arc = state.inner.clone();
    spawn_read_loop(
        app,
        state_arc,
        connection_id.clone(),
        broadcast_tx,
        cancel_token,
        read_half,
    );

    // 12. Return success
    Ok(success_envelope(
        "connect",
        WsConnectResult {
            connection_id,
            protocol,
            extensions,
            latency_ms,
        },
        Some(latency_ms),
    ))
}

// ─── ws_disconnect ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ws_disconnect(
    app: tauri::AppHandle,
    state: tauri::State<'_, WsState>,
    request: WsDisconnectRequest,
) -> Result<Value, String> {
    let start = Instant::now();

    let handle = {
        let mut map = state.inner.lock().map_err(|e| e.to_string())?;
        map.remove(&request.connection_id)
    };

    let handle = match handle {
        Some(h) => h,
        None => {
            return Ok(error_envelope(
                "disconnect",
                "WS_NOT_FOUND",
                &format!("Connection '{}' not found", request.connection_id),
                Some(false),
            ));
        }
    };

    // Default close code/reason aligned with Express proxy
    let close_code = request.code.or(Some(1000));
    let close_reason = request.reason.clone().or_else(|| Some("Client disconnect".to_string()));

    // Send close frame via write channel (best-effort, non-blocking)
    let close_msg = WsOutboundMessage::Close(close_code, close_reason.clone());
    let _ = handle.write_tx.try_send(close_msg);

    // Cancel the read loop
    handle.cancel_token.cancel();

    // Emit close event so Studio UI updates
    emit_close_event(&app, &request.connection_id, close_code, close_reason);

    Ok(success_envelope(
        "disconnect",
        WsDisconnectResult {
            connection_id: request.connection_id,
            disconnected: true,
        },
        Some(start.elapsed().as_millis() as u64),
    ))
}

// ─── ws_status ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ws_status(
    state: tauri::State<'_, WsState>,
    request: WsStatusRequest,
) -> Result<Value, String> {
    let map = state.inner.lock().map_err(|e| e.to_string())?;

    let status = match map.get(&request.connection_id) {
        Some(handle) => {
            if handle.cancel_token.is_cancelled() {
                disconnected_status(&request.connection_id)
            } else {
                handle_to_status(&request.connection_id, handle)
            }
        }
        None => disconnected_status(&request.connection_id),
    };

    Ok(success_envelope("status", status, None))
}

// ─── Background loops ─────────────────────────────────────────────────────────

fn spawn_write_loop(
    mut rx: mpsc::Receiver<WsOutboundMessage>,
    mut write: WsWriter,
    cancel_token: CancellationToken,
) {
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let frame: Message = match msg {
                WsOutboundMessage::Text(t) => Message::Text(t.into()),
                WsOutboundMessage::Binary(b) => Message::Binary(b.into()),
                WsOutboundMessage::Ping(p) => Message::Ping(p.into()),
                WsOutboundMessage::Pong(p) => Message::Pong(p.into()),
                WsOutboundMessage::Close(code, reason) => {
                    let close_frame = code.map(|c| CloseFrame {
                        code: c.into(),
                        reason: reason.unwrap_or_default().into(),
                    });
                    Message::Close(close_frame)
                }
            };
            if write.send(frame).await.is_err() {
                break;
            }
        }
        let _ = write.close().await;
        cancel_token.cancel();
    });
}

fn spawn_read_loop(
    app: tauri::AppHandle,
    state_map: StateMap,
    connection_id: String,
    broadcast_tx: broadcast::Sender<WsInboundMessage>,
    cancel_token: CancellationToken,
    mut read: WsReader,
) {
    tokio::spawn(async move {
        let was_cancelled;
        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    was_cancelled = true;
                    break;
                }
                frame = read.next() => {
                    match frame {
                        Some(Ok(msg)) => {
                            let should_break = handle_incoming_message(
                                &app, &state_map, &connection_id, &broadcast_tx, msg,
                            );
                            if should_break {
                                was_cancelled = cancel_token.is_cancelled();
                                break;
                            }
                        }
                        Some(Err(_)) | None => {
                            was_cancelled = cancel_token.is_cancelled();
                            if !was_cancelled {
                                emit_close_event(&app, &connection_id, None, None);
                            }
                            break;
                        }
                    }
                }
            }
        }

        // Clean up: remove handle from state if still present
        if let Ok(mut map) = state_map.lock() {
            map.remove(&connection_id);
        }

        // If was_cancelled, ws_disconnect already emitted the close event.
        let _ = was_cancelled;
    });
}

/// Returns `true` if the read loop should break (server close received).
fn handle_incoming_message(
    app: &tauri::AppHandle,
    state_map: &StateMap,
    connection_id: &str,
    broadcast_tx: &broadcast::Sender<WsInboundMessage>,
    msg: Message,
) -> bool {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let (data, msg_type, size) = match &msg {
        Message::Text(text) => {
            let s = text.to_string();
            let len = s.len();
            (s, "text", len)
        }
        Message::Binary(bytes) => {
            let encoded = base64::engine::general_purpose::STANDARD.encode(bytes.as_ref());
            let len = bytes.len();
            (encoded, "binary", len)
        }
        Message::Ping(payload) => {
            // Reply with pong via write channel (required for split-stream mode
            // where tungstenite can't auto-pong without write-half access)
            if let Ok(map) = state_map.lock() {
                if let Some(handle) = map.get(connection_id) {
                    let _ = handle.write_tx.try_send(
                        WsOutboundMessage::Pong(payload.to_vec()),
                    );
                }
            }
            return false;
        }
        Message::Pong(_) => return false,
        Message::Close(frame) => {
            let (code, reason) = match frame {
                Some(cf) => (Some(u16::from(cf.code)), Some(cf.reason.to_string())),
                None => (None, None),
            };
            emit_close_event(app, connection_id, code, reason);
            return true; // Break the read loop
        }
        Message::Frame(_) => return false,
    };

    // Update counters
    if let Ok(map) = state_map.lock() {
        if let Some(handle) = map.get(connection_id) {
            handle.messages_received.fetch_add(1, Ordering::Relaxed);
            handle.last_activity_ms.store(now_ms, Ordering::Relaxed);
        }
    }

    // Broadcast to ws_receive_next consumers
    let inbound = WsInboundMessage {
        data: data.clone(),
        message_type: msg_type.to_string(),
        timestamp: now_ms,
        size,
    };
    let _ = broadcast_tx.send(inbound);

    // Emit Tauri event for Studio UI
    let payload = WsMessagePayload {
        connection_id: connection_id.to_string(),
        data,
        message_type: msg_type.to_string(),
        timestamp: now_ms,
    };
    let _ = app.emit("ws-message", payload);

    false
}

fn emit_close_event(
    app: &tauri::AppHandle,
    connection_id: &str,
    code: Option<u16>,
    reason: Option<String>,
) {
    let payload = WsConnectionClosedPayload {
        connection_id: connection_id.to_string(),
        code,
        reason,
    };
    let _ = app.emit("ws-connection-closed", payload);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::websocket::state::WsState;

    #[test]
    fn ws_state_new_is_empty() {
        let state = WsState::new();
        assert!(state.inner.lock().unwrap().is_empty());
    }

    #[test]
    fn disconnected_status_for_unknown_id() {
        let status = disconnected_status("unknown-id");
        let json = serde_json::to_value(&status).unwrap();
        assert_eq!(json["state"], "disconnected");
        assert_eq!(json["connectionId"], "unknown-id");
        assert_eq!(json["sentCount"], 0);
        assert_eq!(json["receivedCount"], 0);
    }

    #[test]
    fn handle_to_status_computes_uptime() {
        let (tx, _rx) = mpsc::channel(1);
        let (btx, _) = broadcast::channel(1);
        let handle = ConnectionHandle {
            url: "wss://example.com".to_string(),
            connected_since: Instant::now() - Duration::from_secs(5),
            connected_at: "2026-01-01T00:00:00.000Z".to_string(),
            messages_sent: AtomicU64::new(3),
            messages_received: AtomicU64::new(7),
            last_activity_ms: AtomicU64::new(0),
            write_tx: tx,
            broadcast_tx: btx,
            cancel_token: CancellationToken::new(),
            protocol: Some("graphql-ws".to_string()),
            extensions: None,
        };
        let status = handle_to_status("c1", &handle);
        assert_eq!(status.state, "connected");
        assert_eq!(status.sent_count, 3);
        assert_eq!(status.received_count, 7);
        assert!(status.uptime_ms.unwrap() >= 4000);
        assert_eq!(status.protocol, Some("graphql-ws".to_string()));
    }

    #[test]
    fn state_insert_and_remove() {
        let state = WsState::new();
        let (tx, _rx) = mpsc::channel(1);
        let (btx, _) = broadcast::channel(1);
        let handle = ConnectionHandle {
            url: "ws://localhost".to_string(),
            connected_since: Instant::now(),
            connected_at: now_iso(),
            messages_sent: AtomicU64::new(0),
            messages_received: AtomicU64::new(0),
            last_activity_ms: AtomicU64::new(0),
            write_tx: tx,
            broadcast_tx: btx,
            cancel_token: CancellationToken::new(),
            protocol: None,
            extensions: None,
        };
        {
            let mut map = state.inner.lock().unwrap();
            map.insert("c1".to_string(), handle);
        }
        assert_eq!(state.inner.lock().unwrap().len(), 1);
        state.inner.lock().unwrap().remove("c1");
        assert!(state.inner.lock().unwrap().is_empty());
    }

    #[test]
    fn cancel_token_reflects_cancelled_state() {
        let token = CancellationToken::new();
        assert!(!token.is_cancelled());
        token.cancel();
        assert!(token.is_cancelled());
    }

    #[test]
    fn url_validation_rejects_http() {
        let url = "http://example.com";
        let lower = url.to_lowercase();
        assert!(!(lower.starts_with("ws://") || lower.starts_with("wss://")));
    }

    #[test]
    fn url_validation_accepts_ws() {
        let url = "ws://example.com";
        let lower = url.to_lowercase();
        assert!(lower.starts_with("ws://") || lower.starts_with("wss://"));
    }

    #[test]
    fn url_validation_accepts_wss() {
        let url = "wss://example.com";
        let lower = url.to_lowercase();
        assert!(lower.starts_with("ws://") || lower.starts_with("wss://"));
    }

    #[test]
    fn url_validation_case_insensitive() {
        let url = "WS://example.com";
        let lower = url.to_lowercase();
        assert!(lower.starts_with("ws://") || lower.starts_with("wss://"));
    }

    #[test]
    fn url_validation_trimmed() {
        let url = "  ws://example.com  ";
        let trimmed = url.trim();
        let lower = trimmed.to_lowercase();
        assert!(lower.starts_with("ws://") || lower.starts_with("wss://"));
    }

    #[test]
    fn default_close_code_is_1000() {
        let code = None::<u16>.or(Some(1000));
        assert_eq!(code, Some(1000));
    }
}
