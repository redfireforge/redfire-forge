//! WebSocket native transport module.
//!
//! Sub-modules:
//! - `types`      — contract types (input + output, aligned with contracts.ts)
//! - `envelope`   — response envelope helpers
//! - `config`     — TLS connector builder (Phase 6B)
//! - `message`    — frame conversion helpers (Phase 6C)
//! - `lifecycle`  — ws_connect / ws_disconnect / ws_status commands
//! - `operations` — ws_send / ws_ping / ws_receive_next commands
//! - `commands`   — cross-module integration tests
//! - `state`      — `WsState` + `ConnectionHandle`

pub mod commands;
pub mod config;
pub mod envelope;
pub mod lifecycle;
pub mod message;
pub mod operations;
pub mod state;
pub mod types;
