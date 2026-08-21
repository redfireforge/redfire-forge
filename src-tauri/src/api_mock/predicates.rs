//! Predicate evaluation — native subset with fail-closed NOT on unevaluated operators.

use crate::api_mock::matchers::{
    match_multipart_field, match_multipart_file, match_xml_schema, match_xpath_equals, match_xpath_exists,
};
use crate::api_mock::path_match::{match_path, strip_base_path};
use crate::api_mock::types::{
    CapturedRequest, Predicate, PredicateGroup, PredicateNode, PredicateOptions, Route,
};
use crate::json_path::{get_by_path, path_exists};
use crate::subset_match::deep_subset_match;
use base64::Engine as _;
use regex::RegexBuilder;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;

pub const NATIVE_UNAVAILABLE_OPERATORS: &[&str] = &[];

#[derive(Debug, Clone)]
pub struct PredicateResult {
    pub predicate_id: String,
    pub source: String,
    pub operator: String,
    pub passed: bool,
    pub evaluated: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RouteEvaluation {
    pub route_id: String,
    pub route_name: String,
    pub priority: i32,
    pub enabled: bool,
    pub method_match: bool,
    pub path_match: bool,
    pub path_params: HashMap<String, String>,
    pub predicate_results: Vec<PredicateResult>,
    pub overall_match: bool,
}

pub fn evaluate_route(route: &Route, request: &CapturedRequest, base_path: &str) -> RouteEvaluation {
    let method_match = match_method(&route.method, &request.method);
    let full_path = strip_base_path(&request.path, base_path);
    let path_result = match_path(&route.path, full_path);
    let mut predicate_results = Vec::new();
    let predicates_match = if method_match && path_result.matched {
        evaluate_group(
            &route.predicates,
            request,
            &path_result.params,
            &mut predicate_results,
        )
    } else {
        false
    };
    RouteEvaluation {
        route_id: route.id.clone(),
        route_name: route.name.clone(),
        priority: route.priority,
        enabled: route.enabled,
        method_match,
        path_match: path_result.matched,
        path_params: path_result.params,
        predicate_results,
        overall_match: route.enabled && method_match && path_result.matched && predicates_match,
    }
}

pub fn evaluate_predicate_group(
    group: &PredicateGroup,
    request: &CapturedRequest,
    path_params: &HashMap<String, String>,
) -> bool {
    let mut results = Vec::new();
    evaluate_group(group, request, path_params, &mut results)
}

fn match_method(route_method: &str, request_method: &str) -> bool {
    route_method.eq_ignore_ascii_case("ANY")
        || route_method.eq_ignore_ascii_case(request_method)
}

fn evaluate_group(
    group: &PredicateGroup,
    request: &CapturedRequest,
    path_params: &HashMap<String, String>,
    results: &mut Vec<PredicateResult>,
) -> bool {
    let mut eval_child = |child: &PredicateNode| {
        let before = results.len();
        let matched = match child {
            PredicateNode::Group(g) => evaluate_group(g, request, path_params, results),
            PredicateNode::Leaf(p) => evaluate_single(p, request, path_params, results),
        };
        let unevaluated = results[before..].iter().any(|r| !r.evaluated);
        (matched, unevaluated)
    };

    match group.combinator.as_str() {
        "all" => group.children.iter().all(|c| eval_child(c).0),
        "any" => group.children.iter().any(|c| eval_child(c).0),
        "not" => {
            let mut unevaluated = false;
            let any_matched = group.children.iter().any(|c| {
                let (matched, uneval) = eval_child(c);
                if uneval {
                    unevaluated = true;
                }
                matched
            });
            !unevaluated && !any_matched
        }
        _ => false,
    }
}

fn evaluate_single(
    pred: &Predicate,
    request: &CapturedRequest,
    path_params: &HashMap<String, String>,
    results: &mut Vec<PredicateResult>,
) -> bool {
    let values = extract_values(pred, request, path_params);
    let mut passed = if values.is_empty() {
        evaluate_operator(
            &pred.operator,
            &None,
            pred.expected.as_ref(),
            pred.options.as_ref(),
            request.content_type.as_deref(),
        )
    } else {
        values.iter().any(|v| {
            evaluate_operator(
                &pred.operator,
                &Some(v.clone()),
                pred.expected.as_ref(),
                pred.options.as_ref(),
                request.content_type.as_deref(),
            )
        })
    };
    if pred.options.as_ref().and_then(|o| o.negate).unwrap_or(false) {
        passed = !passed;
    }
    results.push(PredicateResult {
        predicate_id: pred.id.clone(),
        source: pred.source.clone(),
        operator: pred.operator.clone(),
        passed,
        evaluated: true,
        reason: if passed {
            None
        } else {
            Some(format!("{} {} failed", pred.source, pred.operator))
        },
    });
    passed
}

fn extract_values(
    pred: &Predicate,
    request: &CapturedRequest,
    path_params: &HashMap<String, String>,
) -> Vec<String> {
    let sel = pred.selector.as_deref();
    match pred.source.as_str() {
        "query" => sel
            .and_then(|s| request.query.get(s))
            .cloned()
            .unwrap_or_default(),
        "header" => sel
            .and_then(|s| request.headers.get(&s.to_ascii_lowercase()))
            .cloned()
            .unwrap_or_default(),
        _ => extract_value(pred, request, path_params)
            .into_iter()
            .collect(),
    }
}

fn extract_value(
    pred: &Predicate,
    request: &CapturedRequest,
    path_params: &HashMap<String, String>,
) -> Option<String> {
    let sel = pred.selector.as_deref();
    match pred.source.as_str() {
        "pathParam" => sel.and_then(|s| path_params.get(s).cloned()),
        "query" => sel.and_then(|s| request.query.get(s).and_then(|v| v.first()).cloned()),
        "header" => sel.and_then(|s| {
            request
                .headers
                .get(&s.to_ascii_lowercase())
                .and_then(|v| v.first())
                .cloned()
        }),
        "cookie" => sel.and_then(|s| request.cookies.get(s).cloned()),
        "body" => request.body.clone(),
        "security" => extract_security(sel, request),
        _ => None,
    }
}

fn extract_security(selector: Option<&str>, request: &CapturedRequest) -> Option<String> {
    let auth = request
        .headers
        .get("authorization")
        .and_then(|v| v.first())
        .cloned();
    match selector.unwrap_or("") {
        "scheme" => auth.as_ref().map(|h| {
            h.split_once(' ')
                .map(|(s, _)| s.to_string())
                .unwrap_or_else(|| h.clone())
        }),
        "username" => {
            let h = auth?;
            if !h.to_ascii_lowercase().starts_with("basic ") {
                return None;
            }
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(h.get(6..).unwrap_or(""))
                .ok()?;
            let text = String::from_utf8_lossy(&decoded);
            let user = text.split(':').next()?.to_string();
            if user.is_empty() {
                None
            } else {
                Some(user)
            }
        }
        "tokenClaim" => auth
            .filter(|h| h.starts_with("Bearer "))
            .map(|h| h[7..].to_string()),
        "apiKeyName" => {
            for name in ["x-api-key", "api-key", "x-auth-token"] {
                if request.headers.contains_key(name) {
                    return Some(name.to_string());
                }
            }
            None
        }
        "apiKeyLocation" => {
            for name in ["x-api-key", "api-key", "x-auth-token"] {
                if request.headers.contains_key(name) {
                    return Some("header".into());
                }
            }
            None
        }
        "certSubject" => request.client_cert_subject.clone(),
        _ => None,
    }
}

fn expected_str(expected: Option<&Value>) -> String {
    match expected {
        Some(Value::String(s)) => s.clone(),
        Some(v) => v.to_string().trim_matches('"').to_string(),
        None => String::new(),
    }
}

fn evaluate_operator(
    operator: &str,
    value: &Option<String>,
    expected: Option<&Value>,
    options: Option<&PredicateOptions>,
    content_type: Option<&str>,
) -> bool {
    let ci = !options.and_then(|o| o.case_sensitive).unwrap_or(true);
    match operator {
        "present" => value.as_ref().is_some_and(|v| !v.is_empty()),
        "absent" => value.as_ref().is_none_or(|v| v.is_empty()),
        "exact" => {
            let exp = expected_str(expected);
            match value {
                Some(v) if ci => v.eq_ignore_ascii_case(&exp),
                Some(v) => v == &exp,
                None => false,
            }
        }
        // TypeScript ignores caseSensitive for contains/prefix/suffix.
        "contains" => value
            .as_ref()
            .is_some_and(|v| v.contains(&expected_str(expected))),
        "prefix" => value
            .as_ref()
            .is_some_and(|v| v.starts_with(&expected_str(expected))),
        "suffix" => value
            .as_ref()
            .is_some_and(|v| v.ends_with(&expected_str(expected))),
        "regex" => value.as_ref().is_some_and(|v| {
            RegexBuilder::new(&expected_str(expected))
                .case_insensitive(ci)
                .build()
                .map(|re| re.is_match(v))
                .unwrap_or(false)
        }),
        "glob" => value.as_ref().is_some_and(|v| {
            let glob = glob_to_regex(&expected_str(expected));
            RegexBuilder::new(&glob)
                .case_insensitive(ci)
                .build()
                .map(|re| re.is_match(v))
                .unwrap_or(false)
        }),
        "json_strict" => match (value, expected) {
            (Some(raw), Some(exp)) => {
                let Some(want) = coerce_json_expected(exp) else {
                    return false;
                };
                serde_json::from_str::<Value>(raw)
                    .ok()
                    .is_some_and(|parsed| parsed == want)
            }
            _ => false,
        },
        "json_subset" => match (value, expected) {
            (Some(raw), Some(exp)) => {
                let Some(want) = coerce_json_expected(exp) else {
                    return false;
                };
                serde_json::from_str::<Value>(raw)
                    .ok()
                    .is_some_and(|parsed| deep_subset_match(&parsed, &want, "").matched)
            }
            _ => false,
        },
        "jsonPath_exists" => json_path_exists(value, expected),
        "jsonPath_equals" => json_path_equals(value, expected, options),
        "jsonSchema" => json_schema_ok(value, expected),
        "xmlSchema" => match_xml_schema(value.as_deref(), expected),
        "xpath_exists" => match_xpath_exists(value.as_deref(), expected),
        "xpath_equals" => match_xpath_equals(
            value.as_deref(),
            expected,
            options.and_then(|o| o.match_style.as_deref()),
        ),
        "multipart_field" => match_multipart_field(value.as_deref(), expected, content_type),
        "multipart_file" => match_multipart_file(value.as_deref(), expected, content_type),
        "binary_sha256" => value.as_ref().is_some_and(|v| {
            let digest = hex::encode(Sha256::digest(v.as_bytes()));
            digest.eq_ignore_ascii_case(&expected_str(expected))
        }),
        "binary_exact" => value.as_ref().is_some_and(|v| v == &expected_str(expected)),
        "form_field_exact" | "form_field_regex" | "form_field_present" => {
            match_form(operator, value, expected)
        }
        _ => false,
    }
}

fn glob_to_regex(glob: &str) -> String {
    let mut out = String::from("^");
    for ch in glob.chars() {
        match ch {
            '*' => out.push_str(".*"),
            '?' => out.push('.'),
            c if ".+*^${}()|[]\\".contains(c) => {
                out.push('\\');
                out.push(c);
            }
            c => out.push(c),
        }
    }
    out.push('$');
    out
}

fn json_path_exists(value: &Option<String>, expected: Option<&Value>) -> bool {
    let Some(raw) = value else { return false };
    let Some(Value::String(path)) = expected else {
        return false;
    };
    let Ok(parsed) = serde_json::from_str::<Value>(raw) else {
        return false;
    };
    path_exists(&parsed, path)
}

fn json_path_equals(
    value: &Option<String>,
    expected: Option<&Value>,
    options: Option<&PredicateOptions>,
) -> bool {
    let Some(raw) = value else { return false };
    let Ok(parsed) = serde_json::from_str::<Value>(raw) else {
        return false;
    };
    let Some((path, want)) = json_path_equals_args(expected) else {
        return false;
    };
    if path.is_empty() || !path_exists(&parsed, &path) {
        return false;
    }
    let actual = get_by_path(&parsed, &path);
    let subset = options
        .and_then(|o| o.match_style.as_deref())
        .unwrap_or("exact")
        == "subset";
    let actual_s = format_json_path_value(&actual);
    let want_s = format_json_path_value(&want);
    if subset && !want_s.is_empty() && actual_s.contains(&want_s) {
        return true;
    }
    if actual_s == want_s {
        return true;
    }
    if actual.is_object() || actual.is_array() {
        let exp = if let Value::String(s) = &want {
            match serde_json::from_str::<Value>(s) {
                Ok(parsed) => parsed,
                Err(_) => return false,
            }
        } else {
            want
        };
        return actual == exp;
    }
    false
}

fn json_path_equals_args(expected: Option<&Value>) -> Option<(String, Value)> {
    let exp = expected?;
    if let Value::Array(arr) = exp {
        let path = arr.first()?.as_str()?.to_string();
        let want = arr.get(1)?.clone();
        return Some((path, want));
    }
    if let Some(path) = exp.get("path").and_then(|p| p.as_str()) {
        let want = exp.get("value").cloned().unwrap_or(Value::Null);
        return Some((path.to_string(), want));
    }
    None
}

fn format_json_path_value(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        other => other.to_string(),
    }
}

fn coerce_json_expected(exp: &Value) -> Option<Value> {
    match exp {
        Value::String(s) => serde_json::from_str(s).ok(),
        other => Some(other.clone()),
    }
}

fn json_schema_ok(value: &Option<String>, expected: Option<&Value>) -> bool {
    let Some(raw) = value else { return false };
    let Ok(instance) = serde_json::from_str::<Value>(raw) else {
        return false;
    };
    let Some(schema) = expected.and_then(coerce_json_expected) else {
        return false;
    };
    jsonschema::validator_for(&schema)
        .map(|v| v.is_valid(&instance))
        .unwrap_or(false)
}

fn match_form(operator: &str, value: &Option<String>, expected: Option<&Value>) -> bool {
    let Some(raw) = value else { return false };
    let Some((field, field_value)) = form_field_args(expected) else {
        return false;
    };
    let map = parse_form(raw);
    match operator {
        "form_field_present" => map.contains_key(&field),
        "form_field_exact" => map
            .get(&field)
            .is_some_and(|v| v == &expected_str(field_value.as_ref())),
        "form_field_regex" => map.get(&field).is_some_and(|v| {
            RegexBuilder::new(&expected_str(field_value.as_ref()))
                .build()
                .map(|re| re.is_match(v))
                .unwrap_or(false)
        }),
        _ => false,
    }
}

/// Studio stores `[fieldName, fieldValue]`; object `{ name, value }` is also accepted.
fn form_field_args(expected: Option<&Value>) -> Option<(String, Option<Value>)> {
    let exp = expected?;
    if let Value::Array(arr) = exp {
        let name = arr.first()?.as_str()?.to_string();
        return Some((name, arr.get(1).cloned()));
    }
    let name = exp
        .get("name")
        .or_else(|| exp.get("field"))
        .and_then(|v| v.as_str())?;
    Some((name.to_string(), exp.get("value").cloned()))
}

fn parse_form(raw: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for pair in raw.split('&') {
        if pair.is_empty() {
            continue;
        }
        let mut parts = pair.splitn(2, '=');
        let k = percent_decode(parts.next().unwrap_or(""));
        let v = percent_decode(parts.next().unwrap_or(""));
        map.insert(k, v);
    }
    map
}

fn percent_decode(s: &str) -> String {
    let replaced = s.replace('+', " ");
    urlencoding_lite(&replaced)
}

fn urlencoding_lite(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (from_hex(bytes[i + 1]), from_hex(bytes[i + 2])) {
                out.push((h << 4) | l);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn from_hex(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}
