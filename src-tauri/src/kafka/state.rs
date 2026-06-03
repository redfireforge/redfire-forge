use std::collections::HashMap;
use std::sync::Mutex;

use rdkafka::config::ClientConfig;
use tokio_util::sync::CancellationToken;

/// Type alias for cluster identifiers (the `clusterId` from the frontend config).
pub type ClusterId = String;

/// Per-subscription handle stored inside `ClientHandle.subscriptions`.
///
/// Owns the `CancellationToken` used to stop the background streaming task.
pub struct SubscriptionHandle {
    /// UUID for this subscription.
    pub subscription_id: String,
    /// Topic being consumed.
    pub topic: String,
    /// Kafka consumer group ID.
    pub group_id: String,
    /// ISO 8601 timestamp when the subscription was created.
    pub created_at: String,
    /// Token used to cancel the background streaming task.
    pub cancel_token: CancellationToken,
}

/// Per-cluster connection handle stored in `KafkaState`.
///
/// Stores the rdkafka `ClientConfig` so that short-lived producers and
/// one-shot consumers can be created on demand. Long-lived streaming
/// subscriptions are tracked separately via `subscriptions`.
pub struct ClientHandle {
    /// Cluster ID from the frontend config.
    pub cluster_id: ClusterId,
    /// KafkaJS `clientId` passed in the connection config.
    #[allow(dead_code)]
    pub client_id: String,
    /// Bootstrap broker addresses (retained for connection display in future phases).
    #[allow(dead_code)]
    pub brokers: Vec<String>,
    /// ISO 8601 timestamp (millis precision) when the connection was established.
    pub connected_at: String,
    /// Stored rdkafka config, used to recreate short-lived clients for admin
    /// operations without keeping a permanent admin connection open.
    pub rdkafka_config: ClientConfig,
    /// Active streaming subscriptions keyed by subscription ID.
    pub subscriptions: HashMap<String, SubscriptionHandle>,
}

impl ClientHandle {
    /// Live-computed subscription count (used when building `KafkaServiceStatus`).
    pub fn subscription_count(&self) -> u32 {
        self.subscriptions.len() as u32
    }
}

/// Thread-safe Kafka connection registry.
///
/// Follows the `ExecutorState` pattern from `commands.rs`:
/// - Uses `std::sync::Mutex` (not `tokio::sync::Mutex`) for Tauri-thread compatibility.
/// - Keyed by `ClusterId` to support multi-cluster connections.
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
