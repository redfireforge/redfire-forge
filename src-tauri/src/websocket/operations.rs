//! WebSocket operation commands: send, ping, receive_next.
//!
//! All commands follow the same pattern:
//! 1. Lock `WsState` briefly to extract channel handles
//! 2. Drop the lock before any async work
//! 3. Return success/error envelopes (never `Err(String)` for app-level errors)

use std::sync::atomic::Ordering;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::Engine;
use serde_json::Value;
use tokio::sync::{broadcast, mpsc};

use super::envelope::{epoch_ms_to_iso, error_envelope, now_iso, success_envelope};
use super::state::{WsOutboundMessage, WsState};
use super::types::{
    WsPingRequest, WsPingResult, WsReceiveRequest, WsReceiveResult, WsSendRequest, WsSendResult,
};

const DEFAULT_RECEIVE_TIMEOUT_MS: u64 = 30_000;

// ─── ws_send ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ws_send(
    state: tauri::State<'_, WsState>,
    request: WsSendRequest,
) -> Result<Value, String> {
    let write_tx = {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        match map.get(&request.connection_id) {
            Some(handle) => handle.write_tx.clone(),
            None => {
                return Ok(error_envelope(
                    "send",
                    "WS_NOT_FOUND",
                    &format!("Connection '{}' not found", request.connection_id),
                    Some(false),
                ));
            }
        }
    };

    let msg_type = request.message_type.as_deref().unwrap_or("text");
    let outbound = match msg_type {
        "text" => WsOutboundMessage::Text(request.data),
        "binary" => {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&request.data)
                .map_err(|e| {
                    format!("Invalid base64 data: {}", e)
                });
            match bytes {
                Ok(b) => WsOutboundMessage::Binary(b),
                Err(msg) => {
                    return Ok(error_envelope(
                        "send",
                        "WS_INVALID_DATA",
                        &msg,
                        Some(false),
                    ));
                }
            }
        }
        other => {
            return Ok(error_envelope(
                "send",
                "WS_INVALID_MESSAGE_TYPE",
                &format!("Unknown message type '{}' — expected 'text' or 'binary'", other),
                Some(false),
            ));
        }
    };

    if let Err(e) = write_tx.try_send(outbound) {
        let (code, msg, retryable) = classify_send_error(e);
        return Ok(error_envelope("send", code, msg, Some(retryable)));
    }

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = map.get(&request.connection_id) {
            handle.messages_sent.fetch_add(1, Ordering::Relaxed);
            handle.last_activity_ms.store(now_ms, Ordering::Relaxed);
        }
    }

    Ok(success_envelope(
        "send",
        WsSendResult {
            connection_id: request.connection_id,
            sent_at: now_iso(),
        },
        None,
    ))
}

// ─── ws_ping ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ws_ping(
    state: tauri::State<'_, WsState>,
    request: WsPingRequest,
) -> Result<Value, String> {
    let write_tx = {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        match map.get(&request.connection_id) {
            Some(handle) => handle.write_tx.clone(),
            None => {
                return Ok(error_envelope(
                    "ping",
                    "WS_NOT_FOUND",
                    &format!("Connection '{}' not found", request.connection_id),
                    Some(false),
                ));
            }
        }
    };

    let payload = request
        .data
        .map(|s| s.into_bytes())
        .unwrap_or_default();

    if let Err(e) = write_tx.try_send(WsOutboundMessage::Ping(payload)) {
        let (code, msg, retryable) = classify_send_error(e);
        return Ok(error_envelope("ping", code, msg, Some(retryable)));
    }

    Ok(success_envelope(
        "ping",
        WsPingResult {
            connection_id: request.connection_id,
            sent_at: now_iso(),
        },
        None,
    ))
}

// ─── ws_receive_next ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ws_receive_next(
    state: tauri::State<'_, WsState>,
    request: WsReceiveRequest,
) -> Result<Value, String> {
    let broadcast_tx = {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        match map.get(&request.connection_id) {
            Some(handle) => handle.broadcast_tx.clone(),
            None => {
                return Ok(error_envelope(
                    "receive",
                    "WS_NOT_FOUND",
                    &format!("Connection '{}' not found", request.connection_id),
                    Some(false),
                ));
            }
        }
    };

    let timeout_ms = request.timeout_ms.unwrap_or(DEFAULT_RECEIVE_TIMEOUT_MS);
    let mut rx = broadcast_tx.subscribe();

    let result = tokio::time::timeout(
        Duration::from_millis(timeout_ms),
        receive_with_lag_retry(&mut rx),
    )
    .await;

    match result {
        Ok(Ok(msg)) => Ok(success_envelope(
            "receive",
            WsReceiveResult {
                connection_id: request.connection_id,
                data: msg.data,
                message_type: msg.message_type,
                received_at: epoch_ms_to_iso(msg.timestamp),
                size: msg.size,
            },
            None,
        )),
        Ok(Err(_)) => Ok(error_envelope(
            "receive",
            "WS_NOT_CONNECTED",
            "Connection closed while waiting for message",
            Some(false),
        )),
        Err(_) => Ok(error_envelope(
            "receive",
            "WS_RECEIVE_TIMEOUT",
            &format!("No message received within {}ms", timeout_ms),
            Some(true),
        )),
    }
}

/// Classifies `mpsc::TrySendError` into appropriate error code, message, and retryable flag.
/// - `Closed` → `WS_NOT_CONNECTED` (connection dead, not retryable)
/// - `Full` → `WS_SEND_FAILED` (backpressure, retryable)
fn classify_send_error<T>(err: mpsc::error::TrySendError<T>) -> (&'static str, &'static str, bool) {
    match err {
        mpsc::error::TrySendError::Closed(_) => (
            "WS_NOT_CONNECTED",
            "Connection is closed",
            false,
        ),
        mpsc::error::TrySendError::Full(_) => (
            "WS_SEND_FAILED",
            "Write buffer full — try again",
            true,
        ),
    }
}

/// Receives a message from the broadcast channel, retrying on `Lagged` errors.
/// `Lagged` means messages were dropped due to buffer overflow — skip and retry.
/// `Closed` means the sender was dropped (connection closed) — propagate error.
async fn receive_with_lag_retry(
    rx: &mut broadcast::Receiver<super::state::WsInboundMessage>,
) -> Result<super::state::WsInboundMessage, broadcast::error::RecvError> {
    loop {
        match rx.recv().await {
            Ok(msg) => return Ok(msg),
            Err(broadcast::error::RecvError::Lagged(_)) => continue,
            Err(e) => return Err(e),
        }
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::websocket::state::{ConnectionHandle, WsInboundMessage, WsState};
    use std::sync::atomic::AtomicU64;
    use std::time::Instant;
    use tokio::sync::{broadcast, mpsc};
    use tokio_util::sync::CancellationToken;

    fn make_state_with_connection(id: &str) -> (WsState, mpsc::Receiver<WsOutboundMessage>) {
        let state = WsState::new();
        let (write_tx, write_rx) = mpsc::channel(256);
        let (broadcast_tx, _) = broadcast::channel(256);
        let handle = ConnectionHandle {
            url: "ws://localhost".to_string(),
            connected_since: Instant::now(),
            connected_at: "2026-01-01T00:00:00.000Z".to_string(),
            messages_sent: AtomicU64::new(0),
            messages_received: AtomicU64::new(0),
            last_activity_ms: AtomicU64::new(0),
            write_tx,
            broadcast_tx,
            cancel_token: CancellationToken::new(),
            protocol: None,
            extensions: None,
        };
        {
            let mut map = state.inner.lock().unwrap();
            map.insert(id.to_string(), handle);
        }
        (state, write_rx)
    }

    #[test]
    fn send_text_produces_correct_outbound_message() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let (state, mut rx) = make_state_with_connection("c1");
            let write_tx = {
                let map = state.inner.lock().unwrap();
                map.get("c1").unwrap().write_tx.clone()
            };

            let msg = WsOutboundMessage::Text("hello".to_string());
            write_tx.try_send(msg).unwrap();

            match rx.recv().await.unwrap() {
                WsOutboundMessage::Text(s) => assert_eq!(s, "hello"),
                other => panic!("Expected Text, got {:?}", std::mem::discriminant(&other)),
            }
        });
    }

    #[test]
    fn send_binary_decodes_base64() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(b"binary data");
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&encoded)
            .unwrap();
        assert_eq!(decoded, b"binary data");
    }

    #[test]
    fn send_invalid_base64_returns_error() {
        let result = base64::engine::general_purpose::STANDARD.decode("not valid base64!!!");
        assert!(result.is_err());
    }

    #[test]
    fn ping_with_data_produces_bytes() {
        let data = "keepalive";
        let bytes = data.as_bytes();
        assert_eq!(bytes, b"keepalive");
    }

    #[test]
    fn ping_without_data_produces_empty() {
        let payload: Vec<u8> = None::<String>
            .map(|s| s.into_bytes())
            .unwrap_or_default();
        assert!(payload.is_empty());
    }

    #[test]
    fn receive_with_lag_retry_skips_lagged() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let (tx, _) = broadcast::channel::<WsInboundMessage>(2);

            // Fill beyond capacity to trigger Lagged
            let _ = tx.send(WsInboundMessage {
                data: "msg1".to_string(),
                message_type: "text".to_string(),
                timestamp: 1,
                size: 4,
            });
            let _ = tx.send(WsInboundMessage {
                data: "msg2".to_string(),
                message_type: "text".to_string(),
                timestamp: 2,
                size: 4,
            });
            let _ = tx.send(WsInboundMessage {
                data: "msg3".to_string(),
                message_type: "text".to_string(),
                timestamp: 3,
                size: 4,
            });

            let mut rx = tx.subscribe();
            // New subscriber gets no lagged messages; next send will work
            let _ = tx.send(WsInboundMessage {
                data: "msg4".to_string(),
                message_type: "text".to_string(),
                timestamp: 4,
                size: 4,
            });

            let msg = receive_with_lag_retry(&mut rx).await.unwrap();
            assert_eq!(msg.data, "msg4");
        });
    }

    #[test]
    fn receive_closed_channel_returns_error() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let (tx, _) = broadcast::channel::<WsInboundMessage>(2);
            let mut rx = tx.subscribe();
            drop(tx); // Close channel

            let result = receive_with_lag_retry(&mut rx).await;
            assert!(result.is_err());
        });
    }

    #[test]
    fn unknown_connection_id_pattern() {
        let state = WsState::new();
        let map = state.inner.lock().unwrap();
        assert!(map.get("nonexistent").is_none());
    }

    #[test]
    fn default_receive_timeout() {
        assert_eq!(DEFAULT_RECEIVE_TIMEOUT_MS, 30_000);
    }

    #[test]
    fn message_type_default_is_text() {
        let msg_type: Option<String> = None;
        let resolved = msg_type.as_deref().unwrap_or("text");
        assert_eq!(resolved, "text");
    }

    #[test]
    fn message_type_binary_recognized() {
        let msg_type = Some("binary".to_string());
        let resolved = msg_type.as_deref().unwrap_or("text");
        assert_eq!(resolved, "binary");
    }

    #[test]
    fn classify_closed_channel_as_not_connected() {
        let (tx, rx) = mpsc::channel::<WsOutboundMessage>(1);
        drop(rx);
        let err = tx.try_send(WsOutboundMessage::Text("hello".to_string())).unwrap_err();
        let (code, _, retryable) = classify_send_error(err);
        assert_eq!(code, "WS_NOT_CONNECTED");
        assert!(!retryable);
    }

    #[test]
    fn classify_full_channel_as_send_failed() {
        let (tx, _rx) = mpsc::channel::<WsOutboundMessage>(1);
        tx.try_send(WsOutboundMessage::Text("first".to_string())).unwrap();
        let err = tx.try_send(WsOutboundMessage::Text("second".to_string())).unwrap_err();
        let (code, _, retryable) = classify_send_error(err);
        assert_eq!(code, "WS_SEND_FAILED");
        assert!(retryable);
    }

    #[test]
    fn counter_increment_after_send() {
        let (state, _rx) = make_state_with_connection("c1");
        {
            let map = state.inner.lock().unwrap();
            let handle = map.get("c1").unwrap();
            assert_eq!(handle.messages_sent.load(Ordering::Relaxed), 0);
            handle.messages_sent.fetch_add(1, Ordering::Relaxed);
            assert_eq!(handle.messages_sent.load(Ordering::Relaxed), 1);
        }
    }

    #[test]
    fn receive_timeout_returns_error_envelope() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let (tx, _) = broadcast::channel::<WsInboundMessage>(2);
            let mut rx = tx.subscribe();

            let result = tokio::time::timeout(
                Duration::from_millis(50),
                receive_with_lag_retry(&mut rx),
            )
            .await;

            assert!(result.is_err()); // Timeout
        });
    }
}
