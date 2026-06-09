//! WebSocket frame conversion helpers.
//!
//! Converts between `tokio_tungstenite::tungstenite::Message` and the
//! application-level `WsInboundMessage` / `WsOutboundMessage` types.
//! Text stays as-is; binary data is base64-encoded for the frontend.
//!
//! Phase 6C will extend this with additional conversion utilities as
//! the operations module is implemented.
