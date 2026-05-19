use crate::validation_types::JsonTypeName;
use regex::Regex;
use std::collections::HashMap;

/// Match an HTTP status code against a flexible pattern.
///
/// Port of JS `matchesStatusPattern()` from `validatorHttpHelpers.ts`.
/// Supported patterns:
/// - Exact: `"200"`, `"404"`
/// - Range: `"200-299"`, `"400 - 499"`
/// - Class: `"2xx"`, `"4xx"` (case-insensitive)
/// - Comma-separated: `"200,201,204"`
pub fn matches_status_pattern(http_status: u16, pattern: &str) -> bool {
    let p = pattern.trim();

    // Exact number — JS uses Number(p) which handles any size; we parse as u32
    // to avoid u16 overflow silently mapping large values to 0
    if !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()) {
        return p.parse::<u32>().ok() == Some(http_status as u32);
    }

    // Range: digits-digits (JS regex: /^\d+\s*-\s*\d+$/ requires non-empty digit runs)
    if let Some((lo_s, hi_s)) = p.split_once('-') {
        let lo_trimmed = lo_s.trim();
        let hi_trimmed = hi_s.trim();
        if !lo_trimmed.is_empty()
            && !hi_trimmed.is_empty()
            && lo_trimmed.chars().all(|c| c.is_ascii_digit())
            && hi_trimmed.chars().all(|c| c.is_ascii_digit())
        {
            let lo = lo_trimmed.parse::<u32>().unwrap_or(0);
            let hi = hi_trimmed.parse::<u32>().unwrap_or(0);
            let status = http_status as u32;
            return status >= lo && status <= hi;
        }
    }

    // Class: Nxx
    if p.len() == 3 {
        let lower = p.to_ascii_lowercase();
        let bytes = lower.as_bytes();
        if bytes[0].is_ascii_digit() && bytes[1] == b'x' && bytes[2] == b'x' {
            let class_digit = (bytes[0] - b'0') as u16;
            return http_status / 100 == class_digit;
        }
    }

    // Comma-separated (recursive)
    if p.contains(',') {
        return p.split(',').any(|s| matches_status_pattern(http_status, s));
    }

    false
}

/// Map a serde_json::Value to a JsonTypeName.
///
/// Port of JS `getJsonTypeName()`.
pub fn get_json_type_name(val: &serde_json::Value) -> JsonTypeName {
    match val {
        serde_json::Value::Null => JsonTypeName::Null,
        serde_json::Value::Bool(_) => JsonTypeName::Boolean,
        serde_json::Value::Number(_) => JsonTypeName::Number,
        serde_json::Value::String(_) => JsonTypeName::String,
        serde_json::Value::Array(_) => JsonTypeName::Array,
        serde_json::Value::Object(_) => JsonTypeName::Object,
    }
}

/// Case-insensitive header lookup.
///
/// Port of JS `findHeader()`.
pub fn find_header<'a>(headers: &'a HashMap<String, String>, name: &str) -> Option<&'a str> {
    let lower = name.to_ascii_lowercase();
    for (k, v) in headers {
        if k.to_ascii_lowercase() == lower {
            return Some(v.as_str());
        }
    }
    None
}

/// Evaluate a header operator.
///
/// Port of JS `evaluateHeaderOp()`.
/// Returns (pass, expected_desc, actual_desc).
pub fn evaluate_header_op(
    header_val: Option<&str>,
    operator: &str,
    expected: Option<&str>,
) -> HeaderOpResult {
    let actual = header_val.unwrap_or("(not present)").to_string();
    match operator {
        "exists" => HeaderOpResult {
            pass: header_val.is_some(),
            expected: "header exists".into(),
            actual,
        },
        "equals" => HeaderOpResult {
            pass: header_val == expected,
            expected: expected.unwrap_or("").into(),
            actual,
        },
        "contains" => {
            let needle = expected.unwrap_or("");
            HeaderOpResult {
                pass: header_val.is_some_and(|v| v.contains(needle)),
                expected: format!("contains \"{needle}\""),
                actual,
            }
        }
        "regex" => {
            let pat = expected.unwrap_or("");
            match Regex::new(pat) {
                Ok(re) => HeaderOpResult {
                    pass: header_val.is_some_and(|v| re.is_match(v)),
                    expected: format!("matches /{pat}/"),
                    actual,
                },
                Err(_) => HeaderOpResult {
                    pass: false,
                    expected: format!("valid regex /{pat}/"),
                    actual: "invalid regex pattern".into(),
                },
            }
        }
        _ => HeaderOpResult {
            pass: false,
            expected: format!("operator \"{operator}\""),
            actual: "unknown operator".into(),
        },
    }
}

pub struct HeaderOpResult {
    pub pass: bool,
    pub expected: String,
    pub actual: String,
}
