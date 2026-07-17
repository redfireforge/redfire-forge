//! Native mock rule validation/evaluation (Phase 11M parity slice).

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const GRPC_MOCK_DEFAULT_STATUS_CODE: i32 = 12;
pub const GRPC_MOCK_DEFAULT_STATUS_MESSAGE: &str = "No matching mock rule";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum GrpcMockPredicate {
    MethodEquals { method: String },
    ServiceEquals { service: String },
    MetadataEquals { key: String, value: String },
    MetadataExists { key: String },
    BodyPathEquals { path: String, value: String },
    BodyPathExists { path: String },
    And { predicates: Vec<GrpcMockPredicate> },
    Or { predicates: Vec<GrpcMockPredicate> },
    Not { predicate: Box<GrpcMockPredicate> },
    Expression { expression: String },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcMockRuleResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub messages: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inter_message_delay_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcMockDefaultResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcMockRule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub priority: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallthrough: Option<bool>,
    pub predicate: GrpcMockPredicate,
    pub response: GrpcMockRuleResponse,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcMockRuleSet {
    pub rules: Vec<GrpcMockRule>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_response: Option<GrpcMockDefaultResponse>,
}

#[derive(Clone, Debug)]
pub struct GrpcMockEvaluationContext {
    pub service: String,
    pub method: String,
    pub metadata: std::collections::HashMap<String, String>,
    pub request_body: Value,
}

#[derive(Clone, Debug)]
pub struct GrpcMockRuleEvaluationResult {
    pub matched: bool,
    pub used_default: bool,
    pub rule_id: Option<String>,
    pub rule_name: Option<String>,
    pub fallthrough_chain: Vec<String>,
    pub response: GrpcMockRuleResponse,
}
