//! gRPC native transport module — Phase 7.
//!
//! Sub-modules are added incrementally across phases:
//!   7A — `types`                               (contract freeze; serde mirrors of TS schemas)
//!   7B — `fingerprint`, `tls`, `channel_pool`  (channel management)
//!   7C — `unary`, `envelope`, `commands`, `state`, `call_registry`, `auth`, `descriptor`
//!   7D — `stream`, `events`                    (streaming lifecycle)
//!   7E — facade wiring in renderer
//!   7G — `dynamic_codec`, descriptor pool + prost-reflect JSON dispatch
//!   7H — `lifecycle` (`grpc_tab_cleanup`, orphan supervisor)

pub mod auth;
pub mod bytes_codec;
pub mod call_registry;
pub mod channel_pool;
pub mod commands;
pub mod descriptor;
pub mod diagnostics;
pub mod dynamic_codec;
pub mod envelope;
pub mod events;
pub mod fingerprint;
pub mod lifecycle;
pub mod mock_server;
pub mod mock_server_dispatch;
pub mod mock_rules;
pub mod state;
pub mod stream;
pub mod stream_registry;
pub mod tls;
pub mod types;
pub mod unary;

#[cfg(test)]
mod stream_unit_test;
#[cfg(test)]
mod lifecycle_test;
#[cfg(test)]
mod descriptor_test;
#[cfg(test)]
mod channel_pool_test;
#[cfg(test)]
mod contract_test;
#[cfg(test)]
mod stream_integration_test;
#[cfg(test)]
mod test_codec_protoset;
#[cfg(test)]
mod test_echo_protoset;
#[cfg(test)]
mod test_pem;
#[cfg(test)]
mod unary_integration_test;
