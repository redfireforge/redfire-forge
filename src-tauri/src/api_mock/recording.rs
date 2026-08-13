//! Queue of proxied exchanges waiting for Studio to merge as inactive drafts.
//! Conversion to routes happens in TypeScript (`nativeCaptureToDraft`) so we
//! do not port `convertSourceToRule`.

use crate::api_mock::types::{CapturedRequest, RedactionSettings};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

pub const MAX_RECORDED_DRAFTS: usize = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedCaptureResponse {
    pub status: u16,
    pub headers: HashMap<String, Vec<String>>,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedCapture {
    pub id: String,
    pub fingerprint: String,
    pub recorded_at: String,
    pub request: CapturedRequest,
    pub response: RecordedCaptureResponse,
    pub redaction: RedactionSettings,
}

pub fn draft_fingerprint(method: &str, path: &str, status: u16) -> String {
    format!("{} {} → {}", method.to_uppercase(), path, status)
}

pub fn new_capture_id() -> String {
    let hex = uuid::Uuid::new_v4().as_simple().to_string();
    format!("rec-{}", &hex[..10])
}

pub fn capture_from_proxy(
    request: &CapturedRequest,
    status: u16,
    headers: &[(String, String)],
    body: &str,
    redaction: RedactionSettings,
) -> RecordedCapture {
    let mut header_map: HashMap<String, Vec<String>> = HashMap::new();
    for (k, v) in headers {
        header_map.entry(k.clone()).or_default().push(v.clone());
    }
    let mut request = request.clone();
    redact_captured_request(&mut request, &redaction);
    redact_header_map(&mut header_map, &redaction);
    RecordedCapture {
        id: new_capture_id(),
        fingerprint: draft_fingerprint(&request.method, &request.path, status),
        recorded_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        request,
        response: RecordedCaptureResponse {
            status,
            headers: header_map,
            body: body.to_string(),
        },
        redaction,
    }
}

/// Match TypeScript `redactHeaderMap` so IPC/poll never carries raw secrets.
fn redact_captured_request(request: &mut CapturedRequest, redaction: &RedactionSettings) {
    redact_header_map(&mut request.headers, redaction);
    let names: HashSet<String> = redaction
        .header_names
        .iter()
        .map(|h| h.to_ascii_lowercase())
        .collect();
    if names.contains("cookie") {
        for value in request.cookies.values_mut() {
            *value = "[REDACTED]".into();
        }
    }
}

fn redact_header_map(headers: &mut HashMap<String, Vec<String>>, redaction: &RedactionSettings) {
    let names: HashSet<String> = redaction
        .header_names
        .iter()
        .map(|h| h.to_ascii_lowercase())
        .collect();
    for (key, values) in headers.iter_mut() {
        if !names.contains(&key.to_ascii_lowercase()) {
            continue;
        }
        let joined = values.join(", ");
        *values = vec![redact_header_value(&joined, redaction.preserve_scheme)];
    }
}

fn redact_header_value(value: &str, preserve_scheme: bool) -> String {
    if preserve_scheme {
        if let Some(idx) = value.find(char::is_whitespace) {
            let scheme = &value[..idx];
            if !scheme.is_empty() {
                return format!("{scheme} [REDACTED]");
            }
        }
    }
    "[REDACTED]".into()
}

pub fn push_recorded_draft(queue: &mut Vec<RecordedCapture>, capture: RecordedCapture) {
    if queue.iter().any(|d| d.fingerprint == capture.fingerprint) {
        return;
    }
    queue.push(capture);
    while queue.len() > MAX_RECORDED_DRAFTS {
        queue.remove(0);
    }
}

pub fn ack_recorded_drafts(queue: &mut Vec<RecordedCapture>, ids: &[String]) -> usize {
    let drop: HashSet<&str> = ids.iter().map(String::as_str).collect();
    let before = queue.len();
    queue.retain(|d| !drop.contains(d.id.as_str()));
    before - queue.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cap(id: &str, fingerprint: &str) -> RecordedCapture {
        RecordedCapture {
            id: id.into(),
            fingerprint: fingerprint.into(),
            recorded_at: "2026-08-13T00:00:00.000Z".into(),
            request: CapturedRequest {
                method: "GET".into(),
                path: "/x".into(),
                ..Default::default()
            },
            response: RecordedCaptureResponse {
                status: 200,
                headers: HashMap::new(),
                body: "{}".into(),
            },
            redaction: RedactionSettings::default(),
        }
    }

    #[test]
    fn fingerprint_matches_typescript() {
        assert_eq!(draft_fingerprint("get", "/users", 200), "GET /users → 200");
    }

    #[test]
    fn capture_id_has_rec_prefix() {
        let id = new_capture_id();
        assert!(id.starts_with("rec-"));
        assert_eq!(id.len(), 14);
    }

    #[test]
    fn capture_serializes_camel_case_for_studio() {
        let req = CapturedRequest {
            method: "GET".into(),
            path: "/x".into(),
            raw_path: "/x?q=1".into(),
            ..Default::default()
        };
        let c = capture_from_proxy(&req, 200, &[], "{}", RedactionSettings::default());
        let v = serde_json::to_value(&c).unwrap();
        assert!(v.get("recordedAt").is_some(), "{v}");
        assert!(v.get("recorded_at").is_none());
        assert!(v["request"].get("rawPath").is_some());
        assert!(v["redaction"].get("headerNames").is_some());
    }

    #[test]
    fn capture_from_proxy_redacts_secrets_before_queue() {
        let req = CapturedRequest {
            method: "GET".into(),
            path: "/x".into(),
            headers: HashMap::from([
                ("authorization".into(), vec!["Bearer super-secret".into()]),
                ("cookie".into(), vec!["session=abc".into()]),
                ("accept".into(), vec!["application/json".into()]),
            ]),
            cookies: HashMap::from([("session".into(), "abc".into())]),
            ..Default::default()
        };
        let c = capture_from_proxy(
            &req,
            200,
            &[
                ("content-type".into(), "application/json".into()),
                ("set-cookie".into(), "session=abc".into()),
            ],
            "{}",
            RedactionSettings::default(),
        );
        assert_eq!(
            c.request.headers.get("authorization").unwrap(),
            &vec!["Bearer [REDACTED]".to_string()]
        );
        assert_eq!(
            c.request.headers.get("cookie").unwrap(),
            &vec!["[REDACTED]".to_string()]
        );
        assert_eq!(c.request.headers.get("accept").unwrap(), &vec!["application/json".to_string()]);
        assert_eq!(c.request.cookies.get("session").map(String::as_str), Some("[REDACTED]"));
        assert_eq!(
            c.response.headers.get("set-cookie").unwrap(),
            &vec!["[REDACTED]".to_string()]
        );
        assert_eq!(req.headers.get("authorization").unwrap()[0], "Bearer super-secret");
    }

    #[test]
    fn capture_from_proxy_groups_headers() {
        let req = CapturedRequest {
            method: "POST".into(),
            path: "/items".into(),
            ..Default::default()
        };
        let c = capture_from_proxy(
            &req,
            201,
            &[
                ("Content-Type".into(), "application/json".into()),
                ("X-A".into(), "1".into()),
                ("X-A".into(), "2".into()),
            ],
            "{\"ok\":true}",
            RedactionSettings::default(),
        );
        assert_eq!(c.fingerprint, "POST /items → 201");
        assert_eq!(c.response.status, 201);
        assert_eq!(c.response.headers.get("X-A").unwrap(), &vec!["1".to_string(), "2".to_string()]);
        assert!(c.recorded_at.contains('T'));
    }

    #[test]
    fn push_skips_duplicate_fingerprint() {
        let mut q = Vec::new();
        push_recorded_draft(&mut q, cap("a", "GET /x → 200"));
        push_recorded_draft(&mut q, cap("b", "GET /x → 200"));
        assert_eq!(q.len(), 1);
        assert_eq!(q[0].id, "a");
    }

    #[test]
    fn push_drops_oldest_over_cap() {
        let mut q = Vec::new();
        for i in 0..(MAX_RECORDED_DRAFTS + 2) {
            push_recorded_draft(&mut q, cap(&format!("id-{i}"), &format!("GET /p{i} → 200")));
        }
        assert_eq!(q.len(), MAX_RECORDED_DRAFTS);
        assert_eq!(q[0].id, "id-2");
        assert_eq!(q.last().unwrap().id, format!("id-{}", MAX_RECORDED_DRAFTS + 1));
    }

    #[test]
    fn ack_removes_matching_ids() {
        let mut q = vec![cap("a", "GET /a → 200"), cap("b", "GET /b → 200"), cap("c", "GET /c → 200")];
        assert_eq!(ack_recorded_drafts(&mut q, &["b".into(), "missing".into()]), 1);
        assert_eq!(q.iter().map(|d| d.id.as_str()).collect::<Vec<_>>(), vec!["a", "c"]);
        assert_eq!(ack_recorded_drafts(&mut q, &[]), 0);
    }
}
