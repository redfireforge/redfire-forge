use std::collections::HashMap;
use std::sync::Mutex;

use rdkafka::config::ClientConfig;

/// Type alias for cluster identifiers (the `clusterId` from the frontend config).
pub type ClusterId = String;

/// Per-cluster connection handle stored in `KafkaState`.
///
/// For Phase 9A (lifecycle baseline), holds the rdkafka `ClientConfig` so that
/// admin operations (e.g. topic listing) can create short-lived clients on demand.
/// Phase 9B extends this with a long-lived `FutureProducer` and per-subscription
/// `CancellationToken` entries.
pub struct ClientHandle {
    /// Cluster ID from the frontend config.
    pub cluster_id: ClusterId,
    /// KafkaJS `clientId` passed in the connection config.
    #[allow(dead_code)] // used in Phase 9B for producer creation
    pub client_id: String,
    /// Bootstrap broker addresses.
    #[allow(dead_code)] // used in Phase 9B for connection display
    pub brokers: Vec<String>,
    /// ISO 8601 timestamp (millis precision) when the connection was established.
    pub connected_at: String,
    /// Stored rdkafka config, used to recreate short-lived clients for admin
    /// operations without keeping a permanent admin connection open.
    pub rdkafka_config: ClientConfig,
    /// Number of active subscriptions on this cluster (Phase 9B+; 0 in Phase 9A).
    pub subscription_count: usize,
}

/// Thread-safe Kafka connection registry.
///
/// Follows the `ExecutorState` pattern from `commands.rs`:
/// - Uses `std::sync::Mutex` (not `tokio::sync::Mutex`) for Tauri-thread compatibility.
/// - Keyed by `ClusterId` to support multi-cluster connections (Phase 9B+).
pub struct KafkaState {
    pub inner: Mutex<HashMap<ClusterId, ClientHandle>>,
}

impl KafkaState {
    pub fn new() -> Self {
        KafkaState {
            inner: Mutex::new(HashMap::new()),
        }
    }
}
