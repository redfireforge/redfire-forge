#![cfg(test)]

use crate::validation_types::AssertionContext;
use std::collections::HashMap;

pub(crate) fn make_ctx<'a>(
    status: u16,
    time_ms: f64,
    headers: &'a HashMap<String, String>,
    body: &'a serde_json::Value,
    raw: &'a str,
) -> AssertionContext<'a> {
    AssertionContext {
        http_status: status,
        response_time_ms: time_ms,
        response_headers: headers,
        response_body: body,
        raw_body: raw,
    }
}

pub(crate) fn default_headers() -> HashMap<String, String> {
    let mut h = HashMap::new();
    h.insert("Content-Type".into(), "application/json".into());
    h.insert("X-Request-Id".into(), "abc-123".into());
    h
}
