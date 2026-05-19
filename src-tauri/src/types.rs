use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::validation_types::{Assertion, FailureDetail, ValidationConfig};

/// A fully-prepared scenario ready for HTTP execution.
/// JS resolves all headers (including auth), URL (including API key query params),
/// and body (including form serialization) BEFORE sending to Rust.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RustScenario {
    pub id: String,
    pub name: String,
    pub url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub feature_group_name: Option<String>,
    pub group_name: Option<String>,
    pub weight: Option<f64>,
    pub data_row_id: Option<String>,
    pub data_row_label: Option<String>,
    #[serde(default)]
    pub validation: ValidationConfig,
    #[serde(default)]
    pub assertions: Vec<Assertion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode")]
pub enum ExecutionPlan {
    #[serde(rename = "pool")]
    Pool {
        scenarios: Vec<RustScenario>,
        concurrency: u32,
        #[serde(rename = "timeoutMs")]
        timeout_ms: u64,
        #[serde(rename = "retryCount")]
        retry_count: u32,
        #[serde(rename = "retryDelayMs")]
        retry_delay_ms: u64,
        #[serde(rename = "thinkTime")]
        think_time: ThinkTimeConfig,
        #[serde(rename = "circuitBreaker")]
        circuit_breaker: CircuitBreakerConfig,
    },
    #[serde(rename = "sequential")]
    Sequential {
        scenarios: Vec<RustScenario>,
        #[serde(rename = "timeoutMs")]
        timeout_ms: u64,
        #[serde(rename = "retryCount")]
        retry_count: u32,
        #[serde(rename = "retryDelayMs")]
        retry_delay_ms: u64,
        #[serde(rename = "thinkTime")]
        think_time: ThinkTimeConfig,
        #[serde(rename = "circuitBreaker")]
        circuit_breaker: CircuitBreakerConfig,
    },
    #[serde(rename = "load-profile")]
    LoadProfile {
        scenarios: Vec<RustScenario>,
        concurrency: u32,
        #[serde(rename = "durationSec")]
        duration_sec: u64,
        #[serde(rename = "timeoutMs")]
        timeout_ms: u64,
        #[serde(rename = "retryCount")]
        retry_count: u32,
        #[serde(rename = "retryDelayMs")]
        retry_delay_ms: u64,
        #[serde(rename = "thinkTime")]
        think_time: ThinkTimeConfig,
        #[serde(rename = "circuitBreaker")]
        circuit_breaker: CircuitBreakerConfig,
        #[serde(rename = "profileType")]
        profile_type: String,
        #[serde(rename = "rampUpSec")]
        ramp_up_sec: Option<u64>,
        #[serde(rename = "spikeConcurrency")]
        spike_concurrency: Option<u32>,
        #[serde(rename = "spikeStartSec")]
        spike_start_sec: Option<u64>,
        #[serde(rename = "spikeDurationSec")]
        spike_duration_sec: Option<u64>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ThinkTimeConfig {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "constant")]
    Constant {
        #[serde(rename = "delayMs")]
        delay_ms: u64,
    },
    #[serde(rename = "uniform")]
    Uniform {
        #[serde(rename = "minMs")]
        min_ms: u64,
        #[serde(rename = "maxMs")]
        max_ms: u64,
    },
    #[serde(rename = "gaussian")]
    Gaussian {
        #[serde(rename = "meanMs")]
        mean_ms: u64,
        #[serde(rename = "stdDevMs")]
        std_dev_ms: u64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "policy")]
pub enum CircuitBreakerConfig {
    #[serde(rename = "continue")]
    Continue,
    #[serde(rename = "stop-first")]
    StopFirst,
    #[serde(rename = "stop-threshold")]
    StopThreshold {
        #[serde(rename = "maxErrors")]
        max_errors: u64,
        #[serde(rename = "maxErrorRate")]
        max_error_rate: f64,
        #[serde(rename = "minSampleSize")]
        min_sample_size: u64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionResult {
    pub id: String,
    pub scenario_id: String,
    pub scenario_name: String,
    pub feature_group_name: Option<String>,
    pub group_name: Option<String>,
    pub url: String,
    pub method: String,
    pub http_status: u16,
    pub response_time_ms: f64,
    pub response_body: String,
    pub response_headers: HashMap<String, String>,
    pub timestamp: u64,
    pub error_message: Option<String>,
    pub data_row_id: Option<String>,
    pub data_row_label: Option<String>,
    pub request_log: RequestLog,
    pub timing: TimingBreakdown,
    pub retry_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passed: Option<bool>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub failure_details: Vec<FailureDetail>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub validation_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestLog {
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimingBreakdown {
    pub dns_lookup: f64,
    pub tcp_connect: f64,
    pub tls_handshake: f64,
    pub ttfb: f64,
    pub download: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressBatch {
    pub completed: u64,
    pub total: i64,
    pub results: Vec<ExecutionResult>,
    pub elapsed_ms: f64,
    pub current_in_flight: u32,
    pub target_concurrency: u32,
    pub breaker_tripped: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionSummary {
    pub total_results: u64,
    pub duration_ms: f64,
    pub breaker_tripped: bool,
}
