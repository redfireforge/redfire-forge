use std::collections::HashMap;
use std::sync::atomic::AtomicU64;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use tokio::sync::{broadcast, mpsc};
use tokio_util::sync::CancellationToken;

/// Type alias for connection identifiers (UUID generated on connect).
pub type ConnectionId = String;

/// Outbound message sent from the main thread to the write loop.
pub enum WsOutboundMessage {
    /// Text frame.
    Text(String),
    /// Binary frame (raw bytes).
    Binary(Vec<u8>),
    /// WebSocket ping frame.
    Ping(Vec<u8>),
    /// WebSocket pong frame (auto-reply to server pings).
    Pong(Vec<u8>),
    /// Graceful close request with optional code + reason.
    Close(Option<u16>, Option<String>),
}

/// Inbound message received by the read loop, broadcast to `ws_receive_next` callers.
#[derive(Debug, Clone)]
pub struct WsInboundMessage {
    pub data: String,
    pub message_type: String,
    pub timestamp: u64,
    pub size: usize,
}

/// Per-connection handle stored in `WsState`.
///
/// The WebSocket connection is split into independent read/write halves:
/// - **Write half** — driven via `write_tx` (mpsc channel); receiver consumed by write loop
/// - **Read half** — runs in a `tokio::spawn` loop; emits `ws-message` events and sends
///   to `broadcast_tx` for `ws_receive_next` consumers
pub struct ConnectionHandle {
    /// Original WebSocket URL.
    pub url: String,
    /// `std::time::Instant` when the connection was established (for uptime calculation).
    pub connected_since: Instant,
    /// ISO 8601 timestamp when the connection was established (for API response).
    pub connected_at: String,
    /// Atomic counter of messages sent.
    pub messages_sent: AtomicU64,
    /// Atomic counter of messages received.
    pub messages_received: AtomicU64,
    /// Last send or receive activity epoch millis (for idle GC in Phase 6C).
    pub last_activity_ms: AtomicU64,
    /// Channel sender to the write loop.
    pub write_tx: mpsc::Sender<WsOutboundMessage>,
    /// Broadcast sender for `ws_receive_next` consumers.
    pub broadcast_tx: broadcast::Sender<WsInboundMessage>,
    /// Token to cancel the read loop on disconnect.
    pub cancel_token: CancellationToken,
    /// Negotiated subprotocol (from handshake).
    pub protocol: Option<String>,
    /// Negotiated extensions (from handshake).
    pub extensions: Option<String>,
}

/// Thread-safe WebSocket connection registry.
///
/// Uses `std::sync::Mutex` (not `tokio::sync::Mutex`) for Tauri-thread
/// compatibility — same pattern as `KafkaState` and `ExecutorState`.
pub struct WsState {
    pub inner: Arc<Mutex<HashMap<ConnectionId, ConnectionHandle>>>,
}

impl WsState {
    pub fn new() -> Self {
        WsState {
            inner: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}
