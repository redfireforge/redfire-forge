//! Restricted template + static response rendering (native subset of templateEngine.ts).

use crate::api_mock::faker::render_faker_helper;
use crate::api_mock::path_match::{match_path, strip_base_path};
use crate::api_mock::transforms::apply_transforms;
use crate::api_mock::types::{CapturedRequest, Route, ScenarioState, ServerDefinition, Variant};
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

pub struct Rendered {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

pub fn render_variant(
    variant: &Variant,
    request: &CapturedRequest,
    route: &Route,
    def: &ServerDefinition,
    scenario: &ScenarioState,
    seed: &str,
) -> Rendered {
    let path_params = match_path(
        &route.path,
        strip_base_path(&request.path, &def.base_path),
    )
    .params;
    let mut headers = Vec::new();
    for h in &variant.headers {
        if h.enabled && !h.key.is_empty() {
            headers.push((
                h.key.clone(),
                apply_template(&h.value, request, &path_params, def, scenario, seed),
            ));
        }
    }
    let mut body = apply_template(
        &variant.body.content,
        request,
        &path_params,
        def,
        scenario,
        seed,
    );
    let max = def.settings.limits.max_response_body_bytes;
    if body.len() > max {
        body.truncate(max);
    }
    if let Some(ct) = &variant.body.content_type {
        if !headers
            .iter()
            .any(|(k, _)| k.eq_ignore_ascii_case("content-type"))
        {
            headers.push(("Content-Type".into(), ct.clone()));
        }
    }
    for cookie in &variant.cookies {
        if !cookie.name.is_empty() {
            headers.push((
                "Set-Cookie".into(),
                format!("{}={}", cookie.name, cookie.value),
            ));
        }
    }
    let mut status = variant.status;
    if let Some(rules) = variant.transforms.as_deref() {
        if !rules.is_empty() {
            apply_transforms(&mut status, &mut headers, &mut body, rules, |raw| {
                apply_template(raw, request, &path_params, def, scenario, seed)
            });
        }
    }
    Rendered {
        status,
        headers,
        body,
    }
}

pub(crate) fn apply_template(
    value: &str,
    request: &CapturedRequest,
    path_params: &HashMap<String, String>,
    def: &ServerDefinition,
    scenario: &ScenarioState,
    seed: &str,
) -> String {
    if !value.contains("{{") {
        return value.to_string();
    }
    let mut ops: u32 = 0;
    let mut out = String::new();
    let mut rest = value;
    while let Some(start) = rest.find("{{") {
        out.push_str(&rest[..start]);
        rest = &rest[start + 2..];
        if let Some(end) = rest.find("}}") {
            let expr = rest[..end].trim();
            out.push_str(&eval_expr(expr, request, path_params, def, scenario, seed, &mut ops));
            rest = &rest[end + 2..];
        } else {
            out.push_str("{{");
            break;
        }
    }
    out.push_str(rest);
    out
}

fn eval_expr(
    expr: &str,
    request: &CapturedRequest,
    path_params: &HashMap<String, String>,
    def: &ServerDefinition,
    scenario: &ScenarioState,
    seed: &str,
    ops: &mut u32,
) -> String {
    *ops = ops.saturating_add(1);
    if let Some(rest) = expr.strip_prefix("faker") {
        let path = unquote(rest.trim());
        let path = path.trim_start_matches('.').trim();
        if path.is_empty() {
            return String::new();
        }
        let draw = seeded_int(&format!("{seed}:{path}:{ops}"), 0, 0x7fff_ffff);
        return render_faker_helper(path, draw);
    }
    if let Some(rest) = expr.strip_prefix("pathParam ") {
        let key = unquote(rest.trim());
        return path_params.get(&key).cloned().unwrap_or_default();
    }
    if let Some(rest) = expr.strip_prefix("query ") {
        let key = unquote(rest.trim());
        return request
            .query
            .get(&key)
            .and_then(|v| v.first())
            .cloned()
            .unwrap_or_default();
    }
    if let Some(rest) = expr.strip_prefix("header ") {
        let key = unquote(rest.trim()).to_ascii_lowercase();
        return request
            .headers
            .get(&key)
            .and_then(|v| v.first())
            .cloned()
            .unwrap_or_default();
    }
    if let Some(rest) = expr.strip_prefix("cookie ") {
        let key = unquote(rest.trim());
        return request.cookies.get(&key).cloned().unwrap_or_default();
    }
    if let Some(rest) = expr.strip_prefix("state ") {
        let key = unquote(rest.trim());
        return scenario.states.get(&key).cloned().unwrap_or_default();
    }
    if let Some(rest) = expr.strip_prefix("counter ") {
        let key = unquote(rest.trim());
        return scenario
            .counters
            .get(&key)
            .map(|n| n.to_string())
            .unwrap_or_else(|| "0".into());
    }
    match expr {
        "uuid" => Uuid::new_v4().to_string(),
        "now" => chrono::Utc::now().to_rfc3339(),
        "request.path" => request.path.clone(),
        "request.method" => request.method.clone(),
        _ if expr.starts_with("request.pathParams.") => {
            let key = &expr["request.pathParams.".len()..];
            path_params.get(key).cloned().unwrap_or_default()
        }
        _ if expr.starts_with("variables.") => {
            let key = &expr["variables.".len()..];
            def.variables
                .iter()
                .find(|v| v.key == key)
                .map(|v| v.value.clone())
                .unwrap_or_default()
        }
        _ if expr.starts_with("randomInt") => {
            let args: Vec<&str> = expr.split_whitespace().skip(1).collect();
            let min: i64 = args.first().and_then(|s| s.parse().ok()).unwrap_or(0);
            let max: i64 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(100);
            seeded_int(seed, min, max).to_string()
        }
        _ => resolve_dot_path(expr, request, path_params),
    }
}

fn unquote(s: &str) -> String {
    s.trim_matches(|c| c == '\'' || c == '"').to_string()
}

fn seeded_int(seed: &str, min: i64, max: i64) -> i64 {
    if max < min {
        return min;
    }
    // Same 32-bit hash as templateEngine.ts `seededRandom`.
    let mut hash: i32 = 0;
    for ch in seed.chars() {
        hash = hash
            .wrapping_shl(5)
            .wrapping_sub(hash)
            .wrapping_add(ch as u32 as i32);
    }
    let span = max - min + 1;
    min + ((hash as u32 & 0x7fff_ffff) as i64 % span)
}

fn resolve_dot_path(
    expr: &str,
    request: &CapturedRequest,
    path_params: &HashMap<String, String>,
) -> String {
    if expr == "request.body" {
        return request.body.clone().unwrap_or_default();
    }
    if let Some(rest) = expr.strip_prefix("request.body.") {
        if let Some(raw) = &request.body {
            if let Ok(v) = serde_json::from_str::<Value>(raw) {
                return crate::json_path::get_by_path_as_string(&v, &format!("$.{rest}"));
            }
        }
        return String::new();
    }
    if expr.starts_with("request.pathParams.") {
        let key = &expr["request.pathParams.".len()..];
        return path_params.get(key).cloned().unwrap_or_default();
    }
    String::new()
}
