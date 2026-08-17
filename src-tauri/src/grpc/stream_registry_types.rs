//! Types for the active gRPC stream registry.

use std::collections::VecDeque;
use std::time::Instant;

use bytes::Bytes;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::grpc::types::{GrpcTauriDescriptorPayload, GrpcTauriStreamingCallType};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamRegistryStatus {
    Active,
    Ended,
    Cancelled,
    Error,
}

pub enum StreamOutbound {
    Message(Bytes),
    EndWrites,
}

pub struct StreamRegistryEntry {
    pub stream_id: String,
    pub tab_id: String,
    pub request_id: String,
    pub call_type: GrpcTauriStreamingCallType,
    pub service_name: String,
    pub method_name: String,
    pub descriptor: GrpcTauriDescriptorPayload,
    pub status: StreamRegistryStatus,
    pub cancel_token: CancellationToken,
    pub outbound_tx: Option<mpsc::Sender<StreamOutbound>>,
    pub sequence: u64,
    pub terminal_emitted: bool,
    pub client_writes_ended: bool,
    pub last_activity_at: Instant,
    pub terminal_at: Option<Instant>,
    pub pending_events: VecDeque<crate::grpc::types::GrpcTauriEvent>,
}

pub enum TryRegisterStreamOutcome {
    Registered {
        cancel_token: CancellationToken,
        outbound_tx: Option<mpsc::Sender<StreamOutbound>>,
    },
    DuplicateActiveRequest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamControlOutcome {
    Acknowledged,
    AlreadyTerminal,
    NotFound,
    TabMismatch,
    ClientWritesEnded,
}

#[derive(Debug, Clone, Copy)]
pub struct StreamRegistryStats {
    pub total: usize,
    pub active: usize,
    pub ended: usize,
    pub cancelled: usize,
    pub error: usize,
}
