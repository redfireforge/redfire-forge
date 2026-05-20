use crate::validation_types::FieldOperator;
use regex::Regex;
use serde_json::Value;

pub struct FieldEvalResult {
    pub pass: bool,
    pub expected: String,
    pub actual: String,
}

/// Convert a JSON value to f64, mirroring JS `toNumber()`.
/// - Number → passthrough
/// - String → trim, empty → None, parse as f64, NaN → None
/// - Everything else → None
pub fn to_number(val: &Value) -> Option<f64> {
    match val {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return None;
            }
            // JS: Number("NaN") → NaN, then isNaN check → null
            let n = trimmed.parse::<f64>().ok()?;
            if n.is_nan() { None } else { Some(n) }
        }
        _ => None,
    }
}

fn to_number_from_str(s: &str) -> Option<f64> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    let n = trimmed.parse::<f64>().ok()?;
    if n.is_nan() { None } else { Some(n) }
}

/// Stringify a JSON value for display, mirroring JS `stringify()`.
/// - String values return raw content (no quotes) — JS line 21
/// - Null → "null"
/// - Others → JSON serialization
pub fn stringify(val: &Value) -> String {
    match val {
        Value::String(s) => s.clone(),
        Value::Null => "null".into(),
        _ => serde_json::to_string(val).unwrap_or_else(|_| format!("{val:?}")),
    }
}

/// Stringify for the `actual` field in the result when value was not found.
/// JS returns "undefined" for undefined values.
fn stringify_or_undefined(val: Option<&Value>) -> String {
    match val {
        Some(v) => stringify(v),
        None => "undefined".into(),
    }
}

fn strip_quotes(s: &str) -> &str {
    let bytes = s.as_bytes();
    if bytes.len() >= 2 {
        let first = bytes[0];
        let last = bytes[bytes.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return &s[1..s.len() - 1];
        }
    }
    s
}

fn parse_list_items(raw: &str) -> Vec<Value> {
    if let Ok(Value::Array(arr)) = serde_json::from_str::<Value>(raw) {
        return arr;
    }
    raw.split(',')
        .map(|s| Value::String(strip_quotes(s.trim()).to_string()))
        .collect()
}

/// JSON-stringify a value for comparison, mirroring JS `JSON.stringify(actualValue)`.
fn json_stringify(val: &Value) -> String {
    serde_json::to_string(val).unwrap_or_else(|_| format!("{val:?}"))
}

/// Stringify the actual value for string operators (contains, starts_with, etc.).
/// JS: `typeof actualValue === 'string' ? actualValue : JSON.stringify(actualValue) ?? ''`
/// When actualValue is undefined, JSON.stringify returns undefined (JS value),
/// and `undefined ?? ''` yields `""`.
fn stringify_for_string_ops(val: Option<&Value>) -> String {
    match val {
        None => String::new(), // JS: JSON.stringify(undefined) ?? '' = ''
        Some(Value::String(s)) => s.clone(),
        Some(v) => serde_json::to_string(v).unwrap_or_default(),
    }
}

/// Evaluate a field operator against an actual value.
///
/// Port of JS `evaluateFieldOperator()` from `fieldOperatorEvaluation.ts`.
///
/// `actual_value`: `Some(&Value)` when the path was found (including explicit null),
///                 `None` when the path was not found (JS `undefined`).
pub fn evaluate_field_operator(
    actual_value: Option<&Value>,
    operator: &FieldOperator,
    operator_value: Option<&str>,
    expected_value: &str,
) -> FieldEvalResult {
    let null_val = Value::Null;
    let val = actual_value.unwrap_or(&null_val);
    let actual_display = stringify_or_undefined(actual_value);

    match operator {
        FieldOperator::Equals => {
            let actual_str = if actual_value.is_some() {
                json_stringify(val)
            } else {
                "undefined".into()
            };
            let raw_expected = operator_value.unwrap_or(expected_value);
            let expected_str = normalize_expected_json(raw_expected);
            FieldEvalResult {
                pass: actual_str == expected_str,
                expected: format!("equals {raw_expected}"),
                actual: actual_str,
            }
        }

        FieldOperator::NotEquals => {
            let actual_str = if actual_value.is_some() {
                json_stringify(val)
            } else {
                "undefined".into()
            };
            let raw_expected = operator_value.unwrap_or(expected_value);
            let expected_str = normalize_expected_json(raw_expected);
            FieldEvalResult {
                pass: actual_str != expected_str,
                expected: format!("not equals {raw_expected}"),
                actual: actual_str,
            }
        }

        FieldOperator::GreaterThan => numeric_compare(val, operator_value, expected_value, ">", &actual_display, |a, b| a > b),
        FieldOperator::GreaterThanOrEqual => numeric_compare(val, operator_value, expected_value, ">=", &actual_display, |a, b| a >= b),
        FieldOperator::LessThan => numeric_compare(val, operator_value, expected_value, "<", &actual_display, |a, b| a < b),
        FieldOperator::LessThanOrEqual => numeric_compare(val, operator_value, expected_value, "<=", &actual_display, |a, b| a <= b),

        FieldOperator::Contains => {
            let target = operator_value.unwrap_or(expected_value);
            let s = stringify_for_string_ops(actual_value);
            FieldEvalResult {
                pass: s.contains(target),
                expected: format!("contains \"{target}\""),
                actual: actual_display,
            }
        }

        FieldOperator::NotContains => {
            let target = operator_value.unwrap_or(expected_value);
            let s = stringify_for_string_ops(actual_value);
            FieldEvalResult {
                pass: !s.contains(target),
                expected: format!("not contains \"{target}\""),
                actual: actual_display,
            }
        }

        FieldOperator::StartsWith => {
            let target = operator_value.unwrap_or(expected_value);
            let s = stringify_for_string_ops(actual_value);
            FieldEvalResult {
                pass: s.starts_with(target),
                expected: format!("starts with \"{target}\""),
                actual: actual_display,
            }
        }

        FieldOperator::EndsWith => {
            let target = operator_value.unwrap_or(expected_value);
            let s = stringify_for_string_ops(actual_value);
            FieldEvalResult {
                pass: s.ends_with(target),
                expected: format!("ends with \"{target}\""),
                actual: actual_display,
            }
        }

        FieldOperator::Regex => {
            let pattern = operator_value.unwrap_or(expected_value);
            if pattern.is_empty() {
                return FieldEvalResult {
                    pass: false,
                    expected: "non-empty regex pattern".into(),
                    actual: "empty pattern".into(),
                };
            }
            let s = stringify_for_string_ops(actual_value);
            match Regex::new(pattern) {
                Ok(re) => FieldEvalResult {
                    pass: re.is_match(&s),
                    expected: format!("matches /{pattern}/"),
                    actual: actual_display,
                },
                Err(_) => FieldEvalResult {
                    pass: false,
                    expected: format!("valid regex /{pattern}/"),
                    actual: "invalid regex pattern".into(),
                },
            }
        }

        FieldOperator::IsTrue => FieldEvalResult {
            pass: val == &Value::Bool(true) || val == &Value::String("true".into()),
            expected: "is true".into(),
            actual: actual_display,
        },

        FieldOperator::IsFalse => FieldEvalResult {
            pass: val == &Value::Bool(false) || val == &Value::String("false".into()),
            expected: "is false".into(),
            actual: actual_display,
        },

        FieldOperator::IsNull => FieldEvalResult {
            pass: actual_value.is_some() && matches!(val, Value::Null),
            expected: "is null".into(),
            actual: actual_display,
        },

        FieldOperator::IsNotNull => FieldEvalResult {
            pass: actual_value.is_some() && !matches!(val, Value::Null),
            expected: "is not null".into(),
            actual: actual_display,
        },

        FieldOperator::IsEmpty => {
            let empty = actual_value.is_none()
                || matches!(val, Value::Null)
                || matches!(val, Value::String(s) if s.is_empty())
                || matches!(val, Value::Array(a) if a.is_empty())
                || matches!(val, Value::Object(m) if m.is_empty());
            FieldEvalResult {
                pass: empty,
                expected: "is empty".into(),
                actual: actual_display,
            }
        }

        FieldOperator::IsNotEmpty => {
            let not_empty = actual_value.is_some()
                && !matches!(val, Value::Null)
                && !matches!(val, Value::String(s) if s.is_empty())
                && !matches!(val, Value::Array(a) if a.is_empty())
                && !matches!(val, Value::Object(m) if m.is_empty());
            FieldEvalResult {
                pass: not_empty,
                expected: "is not empty".into(),
                actual: actual_display,
            }
        }

        FieldOperator::Exists => FieldEvalResult {
            pass: actual_value.is_some(),
            expected: "exists".into(),
            actual: actual_display,
        },

        FieldOperator::NotExists => FieldEvalResult {
            pass: actual_value.is_none(),
            expected: "not exists".into(),
            actual: actual_display,
        },

        FieldOperator::IsType => {
            let expected_type = operator_value
                .unwrap_or(expected_value)
                .to_ascii_lowercase();
            let actual_type = if actual_value.is_none() {
                "undefined".to_string()
            } else {
                json_type_name(val)
            };
            FieldEvalResult {
                pass: actual_type == expected_type,
                expected: format!("is type {expected_type}"),
                actual: format!("type: {actual_type}"),
            }
        }

        FieldOperator::In => {
            let raw = operator_value.unwrap_or(expected_value);
            let items = parse_list_items(raw);
            let display = items.iter().map(json_stringify).collect::<Vec<_>>().join(", ");
            if actual_value.is_none() {
                // JS: JSON.stringify(undefined) === undefined → includes(undefined) is always false
                return FieldEvalResult { pass: false, expected: format!("in [{display}]"), actual: actual_display };
            }
            let actual_str = json_stringify(val);
            let stringified: Vec<String> = items.iter().map(json_stringify).collect();
            FieldEvalResult {
                pass: stringified.contains(&actual_str),
                expected: format!("in [{display}]"),
                actual: actual_display,
            }
        }

        FieldOperator::NotIn => {
            let raw = operator_value.unwrap_or(expected_value);
            let items = parse_list_items(raw);
            let display = items.iter().map(json_stringify).collect::<Vec<_>>().join(", ");
            if actual_value.is_none() {
                // JS: JSON.stringify(undefined) === undefined → includes(undefined) is always false → !false = true
                return FieldEvalResult { pass: true, expected: format!("not in [{display}]"), actual: actual_display };
            }
            let actual_str = json_stringify(val);
            let stringified: Vec<String> = items.iter().map(json_stringify).collect();
            FieldEvalResult {
                pass: !stringified.contains(&actual_str),
                expected: format!("not in [{display}]"),
                actual: actual_display,
            }
        }

        FieldOperator::Between => {
            let raw = operator_value.unwrap_or(expected_value);
            let parts = split_value_parts(raw);
            let lo = parts.first().and_then(|s| s.parse::<f64>().ok());
            let hi = parts.get(1).and_then(|s| s.parse::<f64>().ok());
            let a = to_number(val);
            match (a, lo, hi) {
                (Some(a_val), Some(lo_val), Some(hi_val)) => FieldEvalResult {
                    pass: a_val >= lo_val && a_val <= hi_val,
                    expected: format!("between {lo_val} and {hi_val}"),
                    actual: a_val.to_string(),
                },
                _ => {
                    let lo_display = lo.map_or("NaN".to_string(), |v| v.to_string());
                    let hi_display = hi.map_or("NaN".to_string(), |v| v.to_string());
                    FieldEvalResult {
                        pass: false,
                        expected: format!("between {lo_display} and {hi_display}"),
                        actual: actual_display,
                    }
                }
            }
        }

        FieldOperator::CloseTo => {
            let raw = operator_value.unwrap_or(expected_value);
            let parts = split_value_parts(raw);
            let target = parts.first().and_then(|s| s.parse::<f64>().ok());
            // JS: tolerance = parts.length > 1 ? Number(parts[1]) : 0.01
            // If parts[1] exists but is not a valid number, JS gets NaN and comparison always fails.
            let tolerance: Option<f64> = if parts.len() > 1 {
                parts[1].parse::<f64>().ok()
            } else {
                Some(0.01)
            };
            let a = to_number(val);
            match (a, target, tolerance) {
                (Some(a_val), Some(t_val), Some(tol)) => FieldEvalResult {
                    pass: (a_val - t_val).abs() <= tol,
                    expected: format!("close to {t_val} ±{tol}"),
                    actual: a_val.to_string(),
                },
                _ => {
                    let t_display = target.map_or("NaN".to_string(), |v| v.to_string());
                    let tol_display = tolerance.map_or("NaN".to_string(), |v| v.to_string());
                    FieldEvalResult {
                        pass: false,
                        expected: format!("close to {t_display} ±{tol_display}"),
                        actual: actual_display,
                    }
                }
            }
        }
    }
}

/// Normalize expected value for equals/not_equals comparison.
/// JS: try JSON.parse then JSON.stringify; on failure JSON.stringify the raw string.
fn normalize_expected_json(raw: &str) -> String {
    if let Ok(parsed) = serde_json::from_str::<Value>(raw) {
        json_stringify(&parsed)
    } else {
        json_stringify(&Value::String(raw.to_string()))
    }
}

/// Helper for numeric comparison operators.
fn numeric_compare(
    val: &Value,
    operator_value: Option<&str>,
    expected_value: &str,
    op_symbol: &str,
    actual_display: &str,
    cmp: fn(f64, f64) -> bool,
) -> FieldEvalResult {
    let raw = operator_value.unwrap_or(expected_value);
    let a = to_number(val);
    let b = to_number_from_str(raw);
    match (a, b) {
        (Some(a_val), Some(b_val)) => FieldEvalResult {
            pass: cmp(a_val, b_val),
            expected: format!("{op_symbol} {b_val}"),
            actual: a_val.to_string(),
        },
        _ => FieldEvalResult {
            pass: false,
            expected: format!("{op_symbol} {raw}"),
            actual: actual_display.to_string(),
        },
    }
}

/// Split a value string by comma (preferred) or whitespace.
/// JS: `raw.includes(',') ? raw.split(',').map(s => s.trim()) : raw.trim().split(/\s+/)`
fn split_value_parts(raw: &str) -> Vec<String> {
    if raw.contains(',') {
        raw.split(',').map(|s| s.trim().to_string()).collect()
    } else {
        raw.split_whitespace().map(|s| s.to_string()).collect()
    }
}

/// Map a serde_json::Value to its type name string.
/// Matches JS: null → "null", array → "array" (before typeof check), else typeof.
fn json_type_name(val: &Value) -> String {
    match val {
        Value::Null => "null".into(),
        Value::Bool(_) => "boolean".into(),
        Value::Number(_) => "number".into(),
        Value::String(_) => "string".into(),
        Value::Array(_) => "array".into(),
        Value::Object(_) => "object".into(),
    }
}
