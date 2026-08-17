//! HTTP helpers for the native API Mock listener (CORS, capture normalize, body clip).

use crate::api_mock::outbound::ANTI_RECURSION_HEADER;
use crate::api_mock::types::{CapturedRequest, CorsSettings};
use http::{HeaderMap, HeaderValue, Method};
use serde_json::json;
use std::collections::HashMap;

pub(crate) fn apply_cors(headers: Option<&mut HeaderMap>, cors: &CorsSettings, request_headers: &HeaderMap) {
    let Some(headers) = headers else { return };
    if !cors.enabled {
        return;
    }
    let origin = request_headers
        .get(http::header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("*");
    let has_wildcard = cors.allow_origins.iter().any(|o| o == "*");
    let allowed = cors.allow_origins.is_empty()
        || has_wildcard
        || cors.allow_origins.iter().any(|o| o == origin);
    if allowed {
        // Browsers reject Access-Control-Allow-Origin: * with credentials.
        if cors.allow_credentials && origin != "*" {
            if let Ok(val) = HeaderValue::from_str(origin) {
                let _ = headers.insert(http::header::ACCESS_CONTROL_ALLOW_ORIGIN, val);
            }
            let _ = headers.insert(
                http::header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
                HeaderValue::from_static("true"),
            );
            let _ = headers.insert(http::header::VARY, HeaderValue::from_static("Origin"));
        } else if !cors.allow_credentials {
            let allow_origin = if has_wildcard || cors.allow_origins.is_empty() {
                "*"
            } else {
                origin
            };
            let _ = headers.insert(
                http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
                HeaderValue::from_str(allow_origin).unwrap_or_else(|_| HeaderValue::from_static("*")),
            );
        }
    }
    let methods = if cors.allow_methods.is_empty() {
        "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS".into()
    } else {
        cors.allow_methods.join(",")
    };
    let _ = headers.insert(
        http::header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_str(&methods).unwrap_or_else(|_| HeaderValue::from_static("GET")),
    );
    let allow_headers = if cors.allow_headers.is_empty() {
        "Content-Type,Authorization,Accept".into()
    } else {
        cors.allow_headers.join(",")
    };
    let _ = headers.insert(
        http::header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_str(&allow_headers).unwrap_or_else(|_| HeaderValue::from_static("*")),
    );
    if !cors.expose_headers.is_empty() {
        let expose = cors.expose_headers.join(",");
        if let Ok(val) = HeaderValue::from_str(&expose) {
            let _ = headers.insert(http::header::ACCESS_CONTROL_EXPOSE_HEADERS, val);
        }
    }
}

pub(crate) fn has_anti_recursion(headers: &HeaderMap) -> bool {
    headers
        .get(ANTI_RECURSION_HEADER)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.split(',').any(|p| p.trim() == "true"))
}

pub(crate) fn overwrite_tx_response(
    tx: &mut serde_json::Value,
    status: u16,
    headers: &[(String, String)],
    body: &str,
    outcome: &str,
    max_body: usize,
) {
    let mut resp_headers: HashMap<String, Vec<String>> = HashMap::new();
    for (k, v) in headers {
        resp_headers.entry(k.clone()).or_default().push(v.clone());
    }
    tx["outcome"] = json!(outcome);
    if let Some(resp) = tx.get_mut("response") {
        resp["status"] = json!(status);
        resp["headers"] = json!(resp_headers);
        resp["body"] = json!(clip_utf8(body, max_body));
        resp["bodyTruncated"] = json!(body.len() > max_body);
    }
}

pub(crate) fn normalize(
    method: &Method,
    path: &str,
    query: Option<&str>,
    headers: &HeaderMap,
    body: Option<String>,
    authority: Option<&str>,
) -> CapturedRequest {
    let mut header_map: HashMap<String, Vec<String>> = HashMap::new();
    for (k, v) in headers.iter() {
        let key = k.as_str().to_ascii_lowercase();
        if key.starts_with(':') {
            if key == ":authority" && !header_map.contains_key("host") {
                header_map
                    .entry("host".into())
                    .or_default()
                    .push(v.to_str().unwrap_or("").to_string());
            }
            continue;
        }
        header_map
            .entry(key)
            .or_default()
            .push(v.to_str().unwrap_or("").to_string());
    }
    if !header_map.contains_key("host") {
        if let Some(auth) = authority.filter(|a| !a.is_empty()) {
            header_map.insert("host".into(), vec![auth.to_string()]);
        }
    }
    let cookies = parse_cookies(header_map.get("cookie").map(|v| v.join("; ")).as_deref());
    let content_type = header_map.get("content-type").and_then(|v| v.first()).cloned();
    CapturedRequest {
        method: method.as_str().to_ascii_uppercase(),
        path: path.to_string(),
        raw_path: if let Some(q) = query {
            format!("{path}?{q}")
        } else {
            path.to_string()
        },
        query: parse_query(query),
        headers: header_map,
        cookies,
        body,
        body_truncated: false,
        content_type,
        remote_address: None,
        received_at: chrono::Utc::now().to_rfc3339(),
        client_cert_subject: None,
        client_cert_fingerprint: None,
    }
}

pub(crate) fn clip_utf8(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    let mut end = max;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].to_string()
}

fn parse_query(query: Option<&str>) -> HashMap<String, Vec<String>> {
    let mut out = HashMap::new();
    let Some(q) = query else { return out };
    for pair in q.split('&') {
        if pair.is_empty() {
            continue;
        }
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        let key = urlencoding::decode_or_plain(k);
        let val = urlencoding::decode_or_plain(v);
        out.entry(key).or_default().push(val);
    }
    out
}

fn parse_cookies(header: Option<&str>) -> HashMap<String, String> {
    let mut out = HashMap::new();
    let Some(h) = header else { return out };
    for pair in h.split(';') {
        let Some((k, v)) = pair.split_once('=') else { continue };
        let name = k.trim();
        if !name.is_empty() {
            out.insert(name.to_string(), v.trim().to_string());
        }
    }
    out
}

mod urlencoding {
    pub fn decode_or_plain(s: &str) -> String {
        let bytes = s.as_bytes();
        let mut out = Vec::with_capacity(bytes.len());
        let mut i = 0;
        while i < bytes.len() {
            if bytes[i] == b'%' && i + 2 < bytes.len() {
                if let Ok(b) = u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16)
                {
                    out.push(b);
                    i += 3;
                    continue;
                }
            }
            if bytes[i] == b'+' {
                out.push(b' ');
            } else {
                out.push(bytes[i]);
            }
            i += 1;
        }
        String::from_utf8_lossy(&out).into_owned()
    }
}
