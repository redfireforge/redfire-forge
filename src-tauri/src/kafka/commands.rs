//! Public command surface — re-exports all Tauri command handlers so that
//! `lib.rs` continues to use `kafka::commands::kafka_connect` etc. without
//! needing to know which sub-module each command lives in.
//!
//! Tests in this module cover cross-cutting state + envelope integration
//! scenarios that span multiple sub-modules (lifecycle, operations, envelope).

pub use super::lifecycle::{
    kafka_connect, kafka_disconnect, kafka_status, kafka_topics,
};
pub use super::operations::{
    kafka_consume_once, kafka_produce, kafka_subscribe, kafka_subscriptions,
    kafka_unsubscribe,
};
