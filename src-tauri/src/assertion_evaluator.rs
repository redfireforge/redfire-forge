use crate::date_helpers::{resolve_date, to_day_string, truncate_to_unit};
use crate::field_operator::evaluate_field_operator;
use crate::http_helpers::{evaluate_header_op, find_header, get_json_type_name, matches_status_pattern};
use crate::json_path::{get_by_path, path_exists};
use crate::subset_match::deep_subset_match;
use crate::validation_types::*;
use regex::Regex;
use serde_json::Value;

/// Compare two f64 values using a ComparisonOperator.
/// Port of JS `compare()` from validator.ts.
pub fn compare(a: f64, op: &ComparisonOperator, b: f64) -> bool {
    match op {
        ComparisonOperator::Eq => a == b,
        ComparisonOperator::Ne => a != b,
        ComparisonOperator::Gt => a > b,
        ComparisonOperator::Gte => a >= b,
        ComparisonOperator::Lt => a < b,
        ComparisonOperator::Lte => a <= b,
    }
}

/// Format a ComparisonOperator for display.
/// Port of JS `formatOp()` from validator.ts.
pub fn format_op(op: &ComparisonOperator) -> &'static str {
    match op {
        ComparisonOperator::Eq => "=",
        ComparisonOperator::Ne => "≠",
        ComparisonOperator::Gt => ">",
        ComparisonOperator::Gte => "≥",
        ComparisonOperator::Lt => "<",
        ComparisonOperator::Lte => "≤",
    }
}

/// Evaluate a list of assertions against an HTTP response context.
///
/// Port of JS `evaluateAssertions()` from `validator.ts`.
/// Returns failures and whether any assertion was a status assertion.
pub fn evaluate_assertions(
    assertions: &[Assertion],
    ctx: &AssertionContext,
) -> AssertionEvalResult {
    let mut failures: Vec<FailureDetail> = Vec::new();
    let mut status_asserted = false;

    for (ai, assertion) in assertions.iter().enumerate() {
        let negated = assertion.is_negated();
        let mut assertion_failures: Vec<FailureDetail> = Vec::new();

        match assertion {
            Assertion::Status { expected, .. } => {
                status_asserted = true;
                if !matches_status_pattern(ctx.http_status, expected) {
                    assertion_failures.push(FailureDetail {
                        path: "(status)".into(),
                        expected: expected.clone(),
                        actual: ctx.http_status.to_string(),
                    });
                }
            }

            Assertion::ResponseTime { max_ms, .. } => {
                if ctx.response_time_ms > *max_ms {
                    assertion_failures.push(FailureDetail {
                        path: "(responseTime)".into(),
                        expected: format!("≤ {}ms", max_ms),
                        actual: format!("{}ms", ctx.response_time_ms),
                    });
                }
            }

            Assertion::Header { name, operator, value, .. } => {
                let header_val = find_header(ctx.response_headers, name);
                let op_str = match operator {
                    AssertionOperator::Equals => "equals",
                    AssertionOperator::Contains => "contains",
                    AssertionOperator::Regex => "regex",
                    AssertionOperator::Exists => "exists",
                };
                let op_result = evaluate_header_op(header_val, op_str, value.as_deref());
                if !op_result.pass {
                    assertion_failures.push(FailureDetail {
                        path: format!("(header:{name})"),
                        expected: op_result.expected,
                        actual: op_result.actual,
                    });
                }
            }

            Assertion::Regex { json_path, pattern, .. } => {
                let found = path_exists(ctx.response_body, json_path);
                let val = get_by_path(ctx.response_body, json_path);
                let s = if !found {
                    "undefined".to_string()
                } else {
                    match &val {
                        Value::String(s) => s.clone(),
                        _ => serde_json::to_string(&val).unwrap_or_default(),
                    }
                };
                match Regex::new(pattern) {
                    Ok(re) => {
                        if !re.is_match(&s) {
                            let display = if s.chars().count() > 200 {
                                let truncated: String = s.chars().take(200).collect();
                                format!("{truncated}…")
                            } else {
                                s
                            };
                            assertion_failures.push(FailureDetail {
                                path: format!("(regex:{json_path})"),
                                expected: format!("matches /{pattern}/"),
                                actual: display,
                            });
                        }
                    }
                    Err(_) => {
                        assertion_failures.push(FailureDetail {
                            path: format!("(regex:{json_path})"),
                            expected: format!("valid regex /{pattern}/"),
                            actual: "invalid regex pattern".into(),
                        });
                    }
                }
            }

            Assertion::ArrayLength { json_path, operator, value, .. } => {
                let found = path_exists(ctx.response_body, json_path);
                let val = get_by_path(ctx.response_body, json_path);
                if !found {
                    assertion_failures.push(FailureDetail {
                        path: format!("(arrayLength:{json_path})"),
                        expected: format!("array with length {} {}", format_op(operator), value),
                        actual: "undefined".into(),
                    });
                } else if let Value::Array(arr) = &val {
                    if !compare(arr.len() as f64, operator, *value) {
                        assertion_failures.push(FailureDetail {
                            path: format!("(arrayLength:{json_path})"),
                            expected: format!("length {} {}", format_op(operator), value),
                            actual: format!("length {}", arr.len()),
                        });
                    }
                } else {
                    let type_name = js_typeof_str(&val);
                    assertion_failures.push(FailureDetail {
                        path: format!("(arrayLength:{json_path})"),
                        expected: format!("array with length {} {}", format_op(operator), value),
                        actual: format!("not an array ({type_name})"),
                    });
                }
            }

            Assertion::Numeric { json_path, operator, value, .. } => {
                let found = path_exists(ctx.response_body, json_path);
                let val = get_by_path(ctx.response_body, json_path);
                if !found {
                    assertion_failures.push(FailureDetail {
                        path: format!("(numeric:{json_path})"),
                        expected: format!("numeric value {} {}", format_op(operator), value),
                        actual: "undefined".into(),
                    });
                } else {
                    let num = val_to_f64(&val);
                    match num {
                        Some(n) if n.is_nan() => {
                            assertion_failures.push(FailureDetail {
                                path: format!("(numeric:{json_path})"),
                                expected: format!("numeric value {} {}", format_op(operator), value),
                                actual: format!("not a number: {}", serde_json::to_string(&val).unwrap_or_default()),
                            });
                        }
                        Some(n) => {
                            if !compare(n, operator, *value) {
                                assertion_failures.push(FailureDetail {
                                    path: format!("(numeric:{json_path})"),
                                    expected: format!("{} {}", format_op(operator), value),
                                    actual: n.to_string(),
                                });
                            }
                        }
                        None => {
                            assertion_failures.push(FailureDetail {
                                path: format!("(numeric:{json_path})"),
                                expected: format!("numeric value {} {}", format_op(operator), value),
                                actual: format!("not a number: {}", serde_json::to_string(&val).unwrap_or_default()),
                            });
                        }
                    }
                }
            }

            Assertion::Date { json_path, operator, reference, .. } => {
                let found = path_exists(ctx.response_body, json_path);
                let val = get_by_path(ctx.response_body, json_path);
                let ref_str = resolve_date(reference);
                if !found {
                    assertion_failures.push(FailureDetail {
                        path: format!("(date:{json_path})"),
                        expected: format!("date {} {}", format_op(operator), ref_str),
                        actual: "undefined".into(),
                    });
                } else {
                    match to_day_string(&val) {
                        None => {
                            assertion_failures.push(FailureDetail {
                                path: format!("(date:{json_path})"),
                                expected: format!("date {} {}", format_op(operator), ref_str),
                                actual: format!("not a date: {}", serde_json::to_string(&val).unwrap_or_default()),
                            });
                        }
                        Some(day_str) => {
                            let cmp = day_str.cmp(&ref_str);
                            let cmp_val = match cmp {
                                std::cmp::Ordering::Less => -1.0,
                                std::cmp::Ordering::Equal => 0.0,
                                std::cmp::Ordering::Greater => 1.0,
                            };
                            if !compare(cmp_val, operator, 0.0) {
                                assertion_failures.push(FailureDetail {
                                    path: format!("(date:{json_path})"),
                                    expected: format!("{} {}", format_op(operator), ref_str),
                                    actual: day_str,
                                });
                            }
                        }
                    }
                }
            }

            Assertion::TypeCheck { json_path, expected_type, .. } => {
                let found = path_exists(ctx.response_body, json_path);
                let val = get_by_path(ctx.response_body, json_path);
                if !found {
                    assertion_failures.push(FailureDetail {
                        path: format!("(typeCheck:{json_path})"),
                        expected: format!("type {}", json_type_name_enum(expected_type)),
                        actual: "path not found".into(),
                    });
                } else {
                    let actual_type = get_json_type_name(&val);
                    if actual_type != *expected_type {
                        assertion_failures.push(FailureDetail {
                            path: format!("(typeCheck:{json_path})"),
                            expected: format!("type {}", json_type_name_enum(expected_type)),
                            actual: format!("type {}", json_type_name_enum(&actual_type)),
                        });
                    }
                }
            }

            Assertion::Existence { json_path, expect_exists, .. } => {
                let found = path_exists(ctx.response_body, json_path);
                if found != *expect_exists {
                    assertion_failures.push(FailureDetail {
                        path: format!("(existence:{json_path})"),
                        expected: if *expect_exists { "field exists" } else { "field does not exist" }.into(),
                        actual: if found { "field exists" } else { "field not found" }.into(),
                    });
                }
            }

            Assertion::ArrayContains { json_path, value, mode, .. } => {
                let found = path_exists(ctx.response_body, json_path);
                let val = get_by_path(ctx.response_body, json_path);
                if !found {
                    assertion_failures.push(FailureDetail {
                        path: format!("(arrayContains:{json_path})"),
                        expected: "array containing value".into(),
                        actual: "undefined".into(),
                    });
                } else if let Value::Array(ac_arr) = &val {
                    let parsed_value: Value = serde_json::from_str(value).unwrap_or(Value::String(value.clone()));
                    let item_matches = |item: &Value| -> bool {
                        if parsed_value.is_object() || parsed_value.is_array() {
                            deep_subset_match(item, &parsed_value, "").matched
                        } else {
                            item == &parsed_value
                                || serde_json::to_string(item).ok() == serde_json::to_string(&parsed_value).ok()
                        }
                    };
                    match mode {
                        ArrayContainsMode::Any => {
                            if !ac_arr.iter().any(item_matches) {
                                assertion_failures.push(FailureDetail {
                                    path: format!("(arrayContains:{json_path})"),
                                    expected: format!("array contains {value}"),
                                    actual: format!("no matching item in {} items", ac_arr.len()),
                                });
                            }
                        }
                        ArrayContainsMode::All => {
                            let fail_count = ac_arr.iter().filter(|item| !item_matches(item)).count();
                            if fail_count > 0 {
                                assertion_failures.push(FailureDetail {
                                    path: format!("(arrayContains:{json_path})"),
                                    expected: format!("all {} items match {value}", ac_arr.len()),
                                    actual: format!("{fail_count} of {} items did not match", ac_arr.len()),
                                });
                            }
                        }
                        ArrayContainsMode::Only => {
                            let parsed_arr = if let Value::Array(a) = &parsed_value { a.clone() } else { vec![parsed_value.clone()] };
                            let unmatched: Vec<&Value> = parsed_arr.iter().filter(|exp| {
                                !ac_arr.iter().any(|act| deep_subset_match(act, exp, "").matched)
                            }).collect();
                            let extras: Vec<&Value> = ac_arr.iter().filter(|act| {
                                !parsed_arr.iter().any(|exp| deep_subset_match(act, exp, "").matched)
                            }).collect();
                            if !unmatched.is_empty() || !extras.is_empty() {
                                let mut parts = Vec::new();
                                if !unmatched.is_empty() {
                                    parts.push(format!("missing: {}", serde_json::to_string(&unmatched).unwrap_or_default()));
                                }
                                if !extras.is_empty() {
                                    parts.push(format!("extras: {}", serde_json::to_string(&extras).unwrap_or_default()));
                                }
                                assertion_failures.push(FailureDetail {
                                    path: format!("(arrayContains:{json_path})"),
                                    expected: format!("exactly {} items (unordered)", parsed_arr.len()),
                                    actual: parts.join("; "),
                                });
                            }
                        }
                        ArrayContainsMode::None => {
                            if let Some(idx) = ac_arr.iter().position(item_matches) {
                                assertion_failures.push(FailureDetail {
                                    path: format!("(arrayContains:{json_path})"),
                                    expected: format!("no items match {value}"),
                                    actual: format!("item at index {idx} matched"),
                                });
                            }
                        }
                    }
                } else {
                    let type_name = js_typeof_str(&val);
                    assertion_failures.push(FailureDetail {
                        path: format!("(arrayContains:{json_path})"),
                        expected: "array containing value".into(),
                        actual: format!("not an array ({type_name})"),
                    });
                }
            }

            Assertion::Each { json_path, field_path, operator, value, .. } => {
                let found = path_exists(ctx.response_body, json_path);
                let arr_val = get_by_path(ctx.response_body, json_path);
                if !found {
                    assertion_failures.push(FailureDetail {
                        path: format!("(each:{json_path})"),
                        expected: "array where every element satisfies condition".into(),
                        actual: "undefined".into(),
                    });
                } else if let Value::Array(each_arr) = &arr_val {
                    let mut each_failure_msgs: Vec<String> = Vec::new();
                    for (idx, elem) in each_arr.iter().enumerate() {
                        let ov = value.as_deref();
                        let ev = ov.unwrap_or("");
                        let result = if field_path.is_empty() {
                            evaluate_field_operator(Some(elem), operator, ov, ev)
                        } else {
                            let resolved = get_by_path(elem, field_path);
                            let field_val = if path_exists(elem, field_path) {
                                Some(&resolved)
                            } else {
                                None
                            };
                            evaluate_field_operator(field_val, operator, ov, ev)
                        };
                        if !result.pass {
                            let fp = if field_path.is_empty() { String::new() } else { format!(".{field_path}") };
                            each_failure_msgs.push(format!("[{idx}]{fp}: expected {}, got {}", result.expected, result.actual));
                        }
                    }
                    if !each_failure_msgs.is_empty() {
                        let summary = if each_failure_msgs.len() <= 3 {
                            each_failure_msgs.join("; ")
                        } else {
                            format!("{} … and {} more", each_failure_msgs[..3].join("; "), each_failure_msgs.len() - 3)
                        };
                        let fp_display = if field_path.is_empty() { String::new() } else { format!("{field_path} ") };
                        let val_display = value.as_deref().map_or(String::new(), |v| format!(" {v}"));
                        assertion_failures.push(FailureDetail {
                            path: format!("(each:{json_path})"),
                            expected: format!("all {} items: {fp_display}{}{val_display}", each_arr.len(), field_operator_name(operator)),
                            actual: format!("{} of {} failed — {summary}", each_failure_msgs.len(), each_arr.len()),
                        });
                    }
                } else {
                    let type_name = js_typeof_str(&arr_val);
                    assertion_failures.push(FailureDetail {
                        path: format!("(each:{json_path})"),
                        expected: "array where every element satisfies condition".into(),
                        actual: format!("not an array ({type_name})"),
                    });
                }
            }

            Assertion::ContainsSubset { json_path, expected, .. } => {
                let found = path_exists(ctx.response_body, json_path);
                let val = get_by_path(ctx.response_body, json_path);
                if !found {
                    assertion_failures.push(FailureDetail {
                        path: format!("(containsSubset:{json_path})"),
                        expected: format!("contains subset {expected}"),
                        actual: "undefined".into(),
                    });
                } else {
                    match serde_json::from_str::<Value>(expected) {
                        Err(_) => {
                            assertion_failures.push(FailureDetail {
                                path: format!("(containsSubset:{json_path})"),
                                expected: "valid JSON subset".into(),
                                actual: "invalid JSON in expected".into(),
                            });
                        }
                        Ok(parsed_expected) => {
                            let sub_result = deep_subset_match(&val, &parsed_expected, "");
                            if !sub_result.matched {
                                let sub_path = sub_result.path.unwrap_or_default();
                                let full_path = if sub_path.is_empty() {
                                    format!("(containsSubset:{json_path})")
                                } else {
                                    format!("(containsSubset:{json_path}.{sub_path})")
                                };
                                assertion_failures.push(FailureDetail {
                                    path: full_path,
                                    expected: sub_result.expected.unwrap_or_else(|| expected.clone()),
                                    actual: sub_result.actual.unwrap_or_else(|| serde_json::to_string(&val).unwrap_or_default()),
                                });
                            }
                        }
                    }
                }
            }

            Assertion::JsonSchema { schema, .. } => {
                match serde_json::from_str::<Value>(schema) {
                    Err(e) => {
                        assertion_failures.push(FailureDetail {
                            path: format!("(jsonSchema#{ai})"),
                            expected: "valid JSON Schema".into(),
                            actual: e.to_string(),
                        });
                    }
                    Ok(schema_val) => {
                        match jsonschema::validator_for(&schema_val) {
                            Err(e) => {
                                assertion_failures.push(FailureDetail {
                                    path: format!("(jsonSchema#{ai})"),
                                    expected: "valid JSON Schema".into(),
                                    actual: e.to_string(),
                                });
                            }
                            Ok(validator) => {
                                let errors: Vec<_> = validator.iter_errors(ctx.response_body).take(10).collect();
                                for err in errors {
                                    let instance_path = err.instance_path.to_string();
                                    let ip = if instance_path.is_empty() { "/" } else { &instance_path };
                                    assertion_failures.push(FailureDetail {
                                        path: format!("(jsonSchema#{ai}:{ip})"),
                                        expected: err.to_string(),
                                        actual: format!("violation at {ip}: {:?}", err.kind),
                                    });
                                }
                            }
                        }
                    }
                }
            }

            Assertion::BodySize { operator, value, unit, .. } => {
                // JS: ctx.rawBody ?? (ctx.responseBody != null ? JSON.stringify(ctx.responseBody) : '')
                // Convention: empty raw_body means "not provided" → fall back to serialized body.
                // JS treats null responseBody as '' (the != null guard rejects it).
                let raw = if ctx.raw_body.is_empty() {
                    if ctx.response_body.is_null() {
                        String::new()
                    } else {
                        serde_json::to_string(ctx.response_body).unwrap_or_default()
                    }
                } else {
                    ctx.raw_body.to_string()
                };
                let size_bytes = raw.len() as f64;
                let divisor = match unit {
                    SizeUnit::Bytes => 1.0,
                    SizeUnit::Kb => 1024.0,
                    SizeUnit::Mb => 1_048_576.0,
                };
                let actual_size = size_bytes / divisor;
                if !compare(actual_size, operator, *value) {
                    let unit_label = match unit {
                        SizeUnit::Bytes => "B",
                        SizeUnit::Kb => "KB",
                        SizeUnit::Mb => "MB",
                    };
                    let rounded = (actual_size * 100.0).round() / 100.0;
                    assertion_failures.push(FailureDetail {
                        path: "(bodySize)".into(),
                        expected: format!("body size {} {} {unit_label}", format_op(operator), value),
                        actual: format!("{rounded} {unit_label}"),
                    });
                }
            }

            Assertion::DatePrecise { json_path, operator, reference, precision, .. } => {
                let found = path_exists(ctx.response_body, json_path);
                let val = get_by_path(ctx.response_body, json_path);
                if !found {
                    assertion_failures.push(FailureDetail {
                        path: format!("(datePrecise:{json_path})"),
                        expected: format!("date {} {} ({})", format_op(operator), reference, date_precision_name(precision)),
                        actual: "undefined".into(),
                    });
                } else {
                    let raw_str = match &val {
                        Value::String(s) => s.clone(),
                        _ => serde_json::to_string(&val).unwrap_or_default(),
                    };
                    let actual_millis = parse_date_to_millis(&raw_str);
                    let ref_millis = parse_date_to_millis(reference);
                    match (actual_millis, ref_millis) {
                        (None, _) => {
                            assertion_failures.push(FailureDetail {
                                path: format!("(datePrecise:{json_path})"),
                                expected: "valid date".into(),
                                actual: format!("invalid date: {raw_str}"),
                            });
                        }
                        (_, None) => {
                            assertion_failures.push(FailureDetail {
                                path: format!("(datePrecise:{json_path})"),
                                expected: "valid reference date".into(),
                                actual: format!("invalid reference: {reference}"),
                            });
                        }
                        (Some(a_ms), Some(r_ms)) => {
                            let trunc_actual = truncate_to_unit(a_ms, precision);
                            let trunc_ref = truncate_to_unit(r_ms, precision);
                            if !compare(trunc_actual as f64, operator, trunc_ref as f64) {
                                assertion_failures.push(FailureDetail {
                                    path: format!("(datePrecise:{json_path})"),
                                    expected: format!("date {} {} (precision: {})", format_op(operator), reference, date_precision_name(precision)),
                                    actual: raw_str,
                                });
                            }
                        }
                    }
                }
            }

            Assertion::Custom { .. } => {
                // Skip — JS handles custom assertions post-hoc
                continue;
            }
        }

        // Negate logic (universal post-processing)
        if negated {
            let config_errors: Vec<FailureDetail> = assertion_failures
                .iter()
                .filter(|f| is_config_error(f))
                .cloned()
                .collect();
            if !config_errors.is_empty() {
                failures.extend(config_errors);
            } else if assertion_failures.is_empty() {
                failures.push(FailureDetail {
                    path: format!("({})", assertion_type_name(assertion)),
                    expected: "NOT (assertion to fail)".into(),
                    actual: "assertion passed (negated → fail)".into(),
                });
            }
            // else: assertion failed as expected under negation → drop failures (pass)
        } else {
            failures.extend(assertion_failures);
        }
    }

    AssertionEvalResult {
        failures,
        status_asserted,
    }
}

fn is_config_error(f: &FailureDetail) -> bool {
    f.actual == "invalid regex pattern"
        || f.actual == "invalid JSON in expected"
        || f.actual == "empty expression"
        || f.actual.starts_with("expression error:")
        || f.actual.starts_with("runtime error:")
        || f.actual.starts_with("invalid date:")
        || f.actual.starts_with("invalid reference:")
        || f.expected == "valid JSON Schema"
        || f.expected == "valid JSON subset"
}

fn assertion_type_name(a: &Assertion) -> &'static str {
    match a {
        Assertion::Status { .. } => "status",
        Assertion::ResponseTime { .. } => "responseTime",
        Assertion::Header { .. } => "header",
        Assertion::Regex { .. } => "regex",
        Assertion::ArrayLength { .. } => "arrayLength",
        Assertion::Numeric { .. } => "numeric",
        Assertion::Date { .. } => "date",
        Assertion::TypeCheck { .. } => "typeCheck",
        Assertion::Existence { .. } => "existence",
        Assertion::ArrayContains { .. } => "arrayContains",
        Assertion::Each { .. } => "each",
        Assertion::ContainsSubset { .. } => "containsSubset",
        Assertion::JsonSchema { .. } => "jsonSchema",
        Assertion::BodySize { .. } => "bodySize",
        Assertion::DatePrecise { .. } => "datePrecise",
        Assertion::Custom { .. } => "custom",
    }
}

fn field_operator_name(op: &FieldOperator) -> &'static str {
    match op {
        FieldOperator::Equals => "equals",
        FieldOperator::NotEquals => "not_equals",
        FieldOperator::GreaterThan => "greater_than",
        FieldOperator::GreaterThanOrEqual => "greater_than_or_equal",
        FieldOperator::LessThan => "less_than",
        FieldOperator::LessThanOrEqual => "less_than_or_equal",
        FieldOperator::Contains => "contains",
        FieldOperator::NotContains => "not_contains",
        FieldOperator::StartsWith => "starts_with",
        FieldOperator::EndsWith => "ends_with",
        FieldOperator::Regex => "regex",
        FieldOperator::IsTrue => "is_true",
        FieldOperator::IsFalse => "is_false",
        FieldOperator::IsNull => "is_null",
        FieldOperator::IsNotNull => "is_not_null",
        FieldOperator::IsEmpty => "is_empty",
        FieldOperator::IsNotEmpty => "is_not_empty",
        FieldOperator::Exists => "exists",
        FieldOperator::NotExists => "not_exists",
        FieldOperator::IsType => "is_type",
        FieldOperator::In => "in",
        FieldOperator::NotIn => "not_in",
        FieldOperator::Between => "between",
        FieldOperator::CloseTo => "close_to",
    }
}

/// Maps a JSON value to JS `typeof` result for parity in failure messages.
/// In JS: `typeof null === 'object'`, `typeof [] === 'object'`.
fn js_typeof_str(val: &Value) -> &'static str {
    match val {
        Value::Null => "object",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "object",
        Value::Object(_) => "object",
    }
}

fn date_precision_name(p: &DatePrecision) -> &'static str {
    match p {
        DatePrecision::Day => "day",
        DatePrecision::Hour => "hour",
        DatePrecision::Minute => "minute",
        DatePrecision::Second => "second",
        DatePrecision::Millisecond => "millisecond",
    }
}

fn json_type_name_enum(t: &JsonTypeName) -> &'static str {
    match t {
        JsonTypeName::String => "string",
        JsonTypeName::Number => "number",
        JsonTypeName::Boolean => "boolean",
        JsonTypeName::Array => "array",
        JsonTypeName::Object => "object",
        JsonTypeName::Null => "null",
    }
}

/// Convert a JSON value to f64, mirroring JS `Number(raw)`.
/// JS: Number(true)=1, Number(false)=0, Number(null)=0, Number("3.14")=3.14,
/// Number([])=0, Number([3])=3, Number([1,2])=NaN, Number({})=NaN
fn val_to_f64(val: &Value) -> Option<f64> {
    match val {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return Some(0.0); // JS: Number("") === 0
            }
            trimmed.parse::<f64>().ok()
        }
        Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        Value::Null => Some(0.0),
        Value::Array(arr) => {
            // JS: Number([]) → 0, Number([3]) → 3, Number([1,2]) → NaN
            if arr.is_empty() {
                return Some(0.0);
            }
            if arr.len() == 1 {
                return val_to_f64(&arr[0]);
            }
            None
        }
        _ => None, // objects → NaN in JS → None here triggers "not a number"
    }
}

/// Parse a date string to epoch milliseconds.
/// Tries ISO 8601 with chrono, then epoch millis as number string.
fn parse_date_to_millis(s: &str) -> Option<i64> {
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
        return Some(dt.timestamp_millis());
    }
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S") {
        return Some(dt.and_utc().timestamp_millis());
    }
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f") {
        return Some(dt.and_utc().timestamp_millis());
    }
    if let Ok(dt) = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return Some(dt.and_hms_opt(0, 0, 0)?.and_utc().timestamp_millis());
    }
    s.parse::<f64>().ok().map(|f| f as i64)
}
