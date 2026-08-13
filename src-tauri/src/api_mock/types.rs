//! Serde models for the shared API Mock JSON contract (camelCase, unknown fields ignored).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerDefinition {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_host")]
    pub host: String,
    pub port: u16,
    #[serde(default)]
    pub base_path: String,
    #[serde(default)]
    pub routes: Vec<Route>,
    #[serde(default)]
    pub variables: Vec<Variable>,
    #[serde(default)]
    pub settings: ServerSettings,
}

fn default_true() -> bool {
    true
}
fn default_host() -> String {
    "127.0.0.1".into()
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Variable {
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub value: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ServerSettings {
    #[serde(default)]
    pub selection: SelectionSettings,
    #[serde(default)]
    pub fallback: FallbackSettings,
    #[serde(default)]
    pub cors: CorsSettings,
    #[serde(default)]
    pub limits: LimitSettings,
    #[serde(default)]
    pub journal: JournalSettings,
    #[serde(default)]
    pub redaction: RedactionSettings,
    #[serde(default)]
    pub proxy: Option<ProxySettings>,
    #[serde(default)]
    pub tls: Option<TlsSettings>,
    #[serde(default)]
    pub callbacks: Option<CallbackSettings>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionSettings {
    #[serde(default = "default_multi")]
    pub multiple_match_policy: String,
    #[serde(default = "default_equal")]
    pub equal_priority_policy: String,
    #[serde(default)]
    pub ambiguity_response: StaticResponse,
}

fn default_multi() -> String {
    "highest_priority".into()
}
fn default_equal() -> String {
    "reject".into()
}

impl Default for SelectionSettings {
    fn default() -> Self {
        Self {
            multiple_match_policy: default_multi(),
            equal_priority_policy: default_equal(),
            ambiguity_response: StaticResponse {
                status: 409,
                body: r#"{"error":"ambiguous"}"#.into(),
                content_type: Some("application/json".into()),
                headers: vec![HeaderKV {
                    id: String::new(),
                    key: "Content-Type".into(),
                    value: "application/json".into(),
                    enabled: true,
                }],
            },
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FallbackSettings {
    #[serde(default)]
    pub unmatched_response: StaticResponse,
    #[serde(default = "default_fallback_mode")]
    pub mode: String,
}

fn default_fallback_mode() -> String {
    "default_response".into()
}

impl Default for FallbackSettings {
    fn default() -> Self {
        Self {
            unmatched_response: StaticResponse {
                status: 404,
                body: r#"{"error":"not_found"}"#.into(),
                content_type: Some("application/json".into()),
                headers: vec![HeaderKV {
                    id: String::new(),
                    key: "Content-Type".into(),
                    value: "application/json".into(),
                    enabled: true,
                }],
            },
            mode: default_fallback_mode(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StaticResponse {
    #[serde(default = "default_status")]
    pub status: u16,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub headers: Vec<HeaderKV>,
}

fn default_status() -> u16 {
    200
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HeaderKV {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CorsSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub allow_origins: Vec<String>,
    #[serde(default)]
    pub allow_methods: Vec<String>,
    #[serde(default)]
    pub allow_headers: Vec<String>,
    #[serde(default)]
    pub allow_credentials: bool,
    #[serde(default = "default_cors_max_age")]
    pub max_age: u64,
    #[serde(default)]
    pub expose_headers: Vec<String>,
}

fn default_cors_max_age() -> u64 {
    86_400
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LimitSettings {
    #[serde(default = "default_max_body")]
    pub max_inbound_body_bytes: usize,
    #[serde(default = "default_max_body")]
    pub max_response_body_bytes: usize,
    #[serde(default = "default_max_conn")]
    pub max_concurrent_connections: u32,
    #[serde(default)]
    pub max_delay_ms: u64,
    #[serde(default = "default_drain")]
    pub graceful_drain_ms: u64,
}

fn default_max_body() -> usize {
    1_048_576
}
fn default_max_conn() -> u32 {
    100
}
fn default_drain() -> u64 {
    5_000
}

impl Default for LimitSettings {
    fn default() -> Self {
        Self {
            max_inbound_body_bytes: default_max_body(),
            max_response_body_bytes: default_max_body(),
            max_concurrent_connections: default_max_conn(),
            max_delay_ms: 0,
            graceful_drain_ms: default_drain(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalSettings {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_journal_max")]
    pub max_entries: usize,
    #[serde(default = "default_journal_body")]
    pub max_captured_body_bytes: usize,
    #[serde(default)]
    pub persist_to_disk: bool,
}

fn default_journal_max() -> usize {
    500
}
fn default_journal_body() -> usize {
    262_144
}

impl Default for JournalSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            max_entries: default_journal_max(),
            max_captured_body_bytes: default_journal_body(),
            persist_to_disk: false,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RedactionSettings {
    #[serde(default = "default_redaction_headers")]
    pub header_names: Vec<String>,
    #[serde(default)]
    pub json_paths: Vec<String>,
    #[serde(default = "default_true")]
    pub preserve_scheme: bool,
}

fn default_redaction_headers() -> Vec<String> {
    vec![
        "authorization".into(),
        "proxy-authorization".into(),
        "cookie".into(),
        "set-cookie".into(),
        "x-api-key".into(),
        "api-key".into(),
        "x-auth-token".into(),
    ]
}

impl Default for RedactionSettings {
    fn default() -> Self {
        Self {
            header_names: default_redaction_headers(),
            json_paths: Vec::new(),
            preserve_scheme: true,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxySettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub allowlist: Vec<String>,
    /// Default true — matches Node `proxy?.blockPrivateNetworks ?? true`.
    #[serde(default = "default_true")]
    pub block_private_networks: bool,
    #[serde(default = "default_proxy_redirects")]
    pub max_redirects: u32,
    #[serde(default = "default_true")]
    pub strip_hop_by_hop: bool,
    #[serde(default)]
    pub forward_auth: bool,
    #[serde(default)]
    pub forward_credential_headers: Vec<String>,
    #[serde(default = "default_proxy_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_proxy_max_bytes")]
    pub max_response_bytes: usize,
    #[serde(default = "default_true")]
    pub record_as_drafts: bool,
}

fn default_proxy_redirects() -> u32 {
    5
}
fn default_proxy_timeout() -> u64 {
    10_000
}
fn default_proxy_max_bytes() -> usize {
    1_048_576
}

impl Default for ProxySettings {
    fn default() -> Self {
        Self {
            enabled: false,
            allowlist: Vec::new(),
            block_private_networks: true,
            max_redirects: default_proxy_redirects(),
            strip_hop_by_hop: true,
            forward_auth: false,
            forward_credential_headers: Vec::new(),
            timeout_ms: default_proxy_timeout(),
            max_response_bytes: default_proxy_max_bytes(),
            record_as_drafts: true,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CallbackSettings {
    #[serde(default)]
    pub allowlist: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TlsSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub cert_pem: String,
    #[serde(default)]
    pub key_pem: String,
    #[serde(default)]
    pub passphrase: Option<String>,
    #[serde(default)]
    pub mtls: Option<MtlsSettings>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MtlsSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub client_ca_pem: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Route {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_method")]
    pub method: String,
    pub path: PathMatcher,
    #[serde(default = "default_priority")]
    pub priority: i32,
    #[serde(default)]
    pub predicates: PredicateGroup,
    #[serde(default = "default_mode")]
    pub response_mode: String,
    #[serde(default)]
    pub responses: Vec<Variant>,
}

fn default_method() -> String {
    "GET".into()
}
fn default_priority() -> i32 {
    10
}
fn default_mode() -> String {
    "rules".into()
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathMatcher {
    #[serde(default = "default_path_kind")]
    pub kind: String,
    #[serde(default)]
    pub value: String,
    #[serde(default)]
    pub flags: Option<PathFlags>,
}

fn default_path_kind() -> String {
    "exact".into()
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PathFlags {
    #[serde(default)]
    pub case_insensitive: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PredicateGroup {
    #[serde(default)]
    pub id: String,
    #[serde(default = "default_all")]
    pub combinator: String,
    #[serde(default)]
    pub children: Vec<PredicateNode>,
}

impl Default for PredicateGroup {
    fn default() -> Self {
        Self {
            id: String::new(),
            combinator: default_all(),
            children: Vec::new(),
        }
    }
}

fn default_all() -> String {
    "all".into()
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(untagged)]
pub enum PredicateNode {
    // Leaf must be first: Group fields are all defaulted, so untagged serde
    // would otherwise swallow every predicate object as an empty group.
    Leaf(Predicate),
    Group(PredicateGroup),
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Predicate {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub selector: Option<String>,
    pub operator: String,
    #[serde(default)]
    pub expected: Option<Value>,
    #[serde(default)]
    pub options: Option<PredicateOptions>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PredicateOptions {
    #[serde(default)]
    pub case_sensitive: Option<bool>,
    #[serde(default)]
    pub negate: Option<bool>,
    #[serde(default)]
    pub match_style: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Variant {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub is_default: bool,
    #[serde(default)]
    pub conditions: Option<PredicateGroup>,
    #[serde(default)]
    pub weight: Option<f64>,
    #[serde(default = "default_status")]
    pub status: u16,
    #[serde(default)]
    pub headers: Vec<HeaderKV>,
    #[serde(default)]
    pub cookies: Vec<ResponseCookie>,
    #[serde(default)]
    pub body: ResponseBody,
    #[serde(default)]
    pub behavior: Behavior,
    #[serde(default)]
    pub transition: Option<StateTransition>,
    #[serde(default)]
    pub transforms: Option<Vec<TransformRule>>,
    #[serde(default)]
    pub callbacks: Option<Vec<CallbackRule>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallbackRule {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub url: String,
    #[serde(default = "default_callback_method")]
    pub method: String,
    #[serde(default)]
    pub headers: Vec<HeaderKV>,
    #[serde(default)]
    pub body_template: String,
    #[serde(default = "default_callback_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_callback_retries")]
    pub max_retries: u32,
}

fn default_callback_method() -> String {
    "POST".into()
}
fn default_callback_timeout() -> u64 {
    10_000
}
fn default_callback_retries() -> u32 {
    3
}

impl Default for CallbackRule {
    fn default() -> Self {
        Self {
            id: String::new(),
            enabled: false,
            url: String::new(),
            method: default_callback_method(),
            headers: Vec::new(),
            body_template: String::new(),
            timeout_ms: default_callback_timeout(),
            max_retries: default_callback_retries(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TransformRule {
    #[serde(default)]
    pub id: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub target: String,
    #[serde(default)]
    pub op: String,
    #[serde(default)]
    pub key: Option<String>,
    #[serde(default)]
    pub value: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResponseCookie {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub value: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResponseBody {
    #[serde(default = "default_body_kind")]
    pub kind: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub content_type: Option<String>,
}

fn default_body_kind() -> String {
    "none".into()
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Behavior {
    #[serde(default)]
    pub delay_ms: u64,
    #[serde(default)]
    pub jitter_ms: u64,
    #[serde(default)]
    pub fault: Option<String>,
    #[serde(default)]
    pub chunk_schedule: Option<Vec<Value>>,
    #[serde(default)]
    pub max_matches: Option<u32>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub probability: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StateTransition {
    #[serde(default)]
    pub current_state: Option<String>,
    #[serde(default)]
    pub target_state: String,
    #[serde(default)]
    pub counter_updates: Option<Vec<CounterUpdate>>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CounterUpdate {
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub delta: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedRequest {
    pub method: String,
    pub path: String,
    #[serde(default)]
    pub raw_path: String,
    #[serde(default)]
    pub query: HashMap<String, Vec<String>>,
    #[serde(default)]
    pub headers: HashMap<String, Vec<String>>,
    #[serde(default)]
    pub cookies: HashMap<String, String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub body_truncated: bool,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub remote_address: Option<String>,
    #[serde(default)]
    pub received_at: String,
    #[serde(default)]
    pub client_cert_subject: Option<String>,
    #[serde(default)]
    pub client_cert_fingerprint: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct ScenarioState {
    pub states: HashMap<String, String>,
    pub counters: HashMap<String, i64>,
}

#[derive(Debug, Clone, Default)]
pub struct SequenceState {
    pub positions: HashMap<String, usize>,
}
