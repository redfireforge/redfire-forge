use regex::Regex;
use serde_json::Value;
use std::collections::HashSet;

use crate::deep_compare::deep_compare;
use crate::field_operator::evaluate_field_operator;
use crate::json_path::get_by_path;
use crate::validation_types::{ExpectedField, FailureDetail, ValidationConfig, ValidationMode};

/// Port of `validate()` from `validator.ts` (lines 790–830).
/// Routes to none/full/selective based on config.mode.
pub fn validate(config: &ValidationConfig, response_body: &Value) -> Vec<FailureDetail> {
    match &config.mode {
        ValidationMode::None => vec![],
        ValidationMode::Full => validate_full(config, response_body),
        ValidationMode::Selective => validate_selective(config, response_body),
    }
}

fn validate_full(config: &ValidationConfig, response_body: &Value) -> Vec<FailureDetail> {
    let expected_json = match &config.expected_json {
        Some(s) if !s.is_empty() => s,
        _ => return vec![],
    };

    let expected_obj: Value = match serde_json::from_str(expected_json) {
        Ok(v) => v,
        Err(_) => {
            return vec![FailureDetail {
                path: "(parse)".to_string(),
                expected: "valid JSON".to_string(),
                actual: "parse error in expected JSON".to_string(),
            }];
        }
    };

    let mut failures = Vec::new();
    deep_compare(&expected_obj, response_body, "", &mut failures);
    failures
}

fn validate_selective(config: &ValidationConfig, response_body: &Value) -> Vec<FailureDetail> {
    let fields = match &config.expected_fields {
        Some(f) if !f.is_empty() => f,
        _ => return vec![],
    };

    let unordered = config.unordered_arrays.unwrap_or(false);

    let mut failures = if unordered {
        validate_fields_unordered(fields, response_body)
    } else {
        validate_fields(fields, response_body)
    };

    // If ALL fields resolved to undefined, try smart path remapping
    if !failures.is_empty()
        && failures
            .iter()
            .all(|f| f.actual == "undefined" || f.actual.is_empty())
    {
        if let Some(remapped) = try_remap_paths(fields, response_body, unordered) {
            failures = remapped;
        }
    }

    failures
}

/// Port of `validateFields()` from `validator.ts` (lines 35–70).
pub fn validate_fields(fields: &[ExpectedField], response_body: &Value) -> Vec<FailureDetail> {
    let mut failures = Vec::new();

    for field in fields {
        let actual_value = get_by_path(response_body, &field.json_path);
        let actual_ref = if actual_value.is_null() {
            // Distinguish path-not-found (returns Null) — pass None for
            // exists/not_exists semantics. For other operators, Null is fine.
            if crate::json_path::path_exists(response_body, &field.json_path) {
                Some(&actual_value)
            } else {
                Option::<&Value>::None
            }
        } else {
            Some(&actual_value)
        };
        let negated = field.negate.unwrap_or(false);
        let neg_prefix = if negated { "NOT " } else { "" };

        if let Some(operator) = &field.operator {
            let result = evaluate_field_operator(
                actual_ref,
                operator,
                field.operator_value.as_deref(),
                &field.expected_value,
            );
            let pass = if negated { !result.pass } else { result.pass };
            if !pass {
                failures.push(FailureDetail {
                    path: field.json_path.clone(),
                    expected: format!("{}{}", neg_prefix, result.expected),
                    actual: result.actual,
                });
            }
            continue;
        }

        // No operator — plain equality check via JSON stringify comparison
        // JS: actualStr ?? 'undefined' — when path not found, display "undefined"
        let path_found = crate::json_path::path_exists(response_body, &field.json_path);
        let actual_str = if path_found {
            serde_json::to_string(&actual_value).unwrap_or_else(|_| "null".into())
        } else {
            "undefined".to_string()
        };

        // JS: JSON.stringify(JSON.parse(expected)) → normalize; fallback to JSON.stringify(expected)
        let expected_str = match serde_json::from_str::<Value>(&field.expected_value) {
            Ok(parsed) => serde_json::to_string(&parsed).unwrap_or_else(|_| "null".into()),
            Err(_) => serde_json::to_string(&field.expected_value)
                .unwrap_or_else(|_| format!("\"{}\"", field.expected_value)),
        };

        let matched = actual_str == expected_str;
        let pass = if negated { !matched } else { matched };
        if pass {
            continue;
        }

        let expected_display = if negated {
            format!("NOT equals {}", field.expected_value)
        } else {
            field.expected_value.clone()
        };

        failures.push(FailureDetail {
            path: field.json_path.clone(),
            expected: expected_display,
            actual: actual_str,
        });
    }

    failures
}

/// Port of `validateFieldsUnordered()` from `validator.ts` (lines 81–227).
/// Groups fields by array row prefix and matches rows at any index.
pub fn validate_fields_unordered(
    fields: &[ExpectedField],
    response_body: &Value,
) -> Vec<FailureDetail> {
    let index_pattern = Regex::new(r"\[(\d+)\]").unwrap();
    let row_prefix_pattern = Regex::new(r"^(.*\[\d+\])").unwrap();

    // Separate array vs non-array fields
    let mut row_groups: Vec<(String, Vec<&ExpectedField>)> = Vec::new();
    let mut non_array_fields: Vec<ExpectedField> = Vec::new();

    for field in fields {
        if let Some(caps) = row_prefix_pattern.captures(&field.json_path) {
            let row_prefix = caps.get(1).unwrap().as_str().to_string();
            if let Some(group) = row_groups.iter_mut().find(|(k, _)| k == &row_prefix) {
                group.1.push(field);
            } else {
                row_groups.push((row_prefix, vec![field]));
            }
        } else {
            non_array_fields.push(field.clone());
        }
    }

    let mut failures = Vec::new();

    // Validate non-array fields normally
    failures.extend(validate_fields(&non_array_fields, response_body));

    // Group row prefixes by their array pattern (replace [N] with [*])
    let mut array_groups: Vec<(String, Vec<(String, Vec<&ExpectedField>)>)> = Vec::new();

    for (row_prefix, row_fields) in &row_groups {
        let pattern = index_pattern.replace_all(row_prefix, "[*]").to_string();
        if let Some(group) = array_groups.iter_mut().find(|(k, _)| k == &pattern) {
            group.1.push((row_prefix.clone(), row_fields.clone()));
        } else {
            array_groups.push((pattern, vec![(row_prefix.clone(), row_fields.clone())]));
        }
    }

    for (pattern, row_map) in &array_groups {
        // Strip trailing [*] to get array path
        let array_path = if pattern.ends_with("[*]") {
            &pattern[..pattern.len() - 3]
        } else {
            pattern.as_str()
        };

        let response_array = if array_path.is_empty() {
            response_body.clone()
        } else {
            get_by_path(response_body, array_path)
        };
        let array_len = match &response_array {
            Value::Array(arr) => arr.len(),
            _ => 0,
        };

        if array_len == 0 {
            // Array not found — validate all row fields normally (they'll fail)
            for (_, row_fields) in row_map {
                let owned: Vec<ExpectedField> = row_fields.iter().map(|f| (*f).clone()).collect();
                failures.extend(validate_fields(&owned, response_body));
            }
            continue;
        }

        let mut used_indices: HashSet<usize> = HashSet::new();

        for (row_prefix, row_fields) in row_map {
            let field_suffixes: Vec<FieldSuffix> = row_fields
                .iter()
                .map(|f| FieldSuffix {
                    suffix: f.json_path[row_prefix.len()..].to_string(),
                    expected_value: f.expected_value.clone(),
                    original_path: f.json_path.clone(),
                    operator: f.operator.clone(),
                    operator_value: f.operator_value.clone(),
                    negate: f.negate.unwrap_or(false),
                })
                .collect();

            let mut matched_index: Option<usize> = Option::None;
            let mut best_partial_index: Option<usize> = Option::None;
            let mut best_partial_count: usize = 0;
            let mut best_partial_mismatches: Vec<Mismatch> = Vec::new();
            let mut best_partial_matches: Vec<PartialMatch> = Vec::new();

            for i in 0..array_len {
                if used_indices.contains(&i) {
                    continue;
                }

                let base_index = index_pattern
                    .replace_all(row_prefix, format!("[{}]", i).as_str())
                    .to_string();
                let mut all_match = true;
                let mut match_count: usize = 0;
                let mut mismatches: Vec<Mismatch> = Vec::new();
                let mut matches: Vec<PartialMatch> = Vec::new();

                for fs in &field_suffixes {
                    let candidate_path = format!("{}{}", base_index, fs.suffix);
                    let actual_value = get_by_path(response_body, &candidate_path);

                    let (field_passed, actual_display) = if let Some(operator) = &fs.operator {
                        let actual_ref = if actual_value.is_null() {
                            if crate::json_path::path_exists(response_body, &candidate_path) {
                                Some(&actual_value)
                            } else {
                                Option::<&Value>::None
                            }
                        } else {
                            Some(&actual_value)
                        };
                        let result = evaluate_field_operator(
                            actual_ref,
                            operator,
                            fs.operator_value.as_deref(),
                            &fs.expected_value,
                        );
                        let pass = if fs.negate { !result.pass } else { result.pass };
                        (pass, result.actual)
                    } else {
                        let candidate_exists =
                            crate::json_path::path_exists(response_body, &candidate_path);
                        let actual_str = if candidate_exists {
                            serde_json::to_string(&actual_value)
                                .unwrap_or_else(|_| "null".into())
                        } else {
                            "undefined".to_string()
                        };
                        let expected_str =
                            match serde_json::from_str::<Value>(&fs.expected_value) {
                                Ok(parsed) => serde_json::to_string(&parsed)
                                    .unwrap_or_else(|_| "null".into()),
                                Err(_) => serde_json::to_string(&fs.expected_value)
                                    .unwrap_or_else(|_| format!("\"{}\"", fs.expected_value)),
                            };
                        let matched_eq = actual_str == expected_str;
                        let pass = if fs.negate { !matched_eq } else { matched_eq };
                        (pass, actual_str)
                    };

                    if !field_passed {
                        all_match = false;
                        mismatches.push(Mismatch {
                            original_path: fs.original_path.clone(),
                            expected_value: fs.expected_value.clone(),
                            actual_value: actual_display,
                        });
                    } else {
                        match_count += 1;
                        let suffix_display = fs.suffix.strip_prefix('.').unwrap_or(&fs.suffix);
                        matches.push(PartialMatch {
                            suffix: suffix_display.to_string(),
                            value: fs.expected_value.clone(),
                        });
                    }
                }

                if all_match {
                    matched_index = Some(i);
                    break;
                }

                if match_count > best_partial_count {
                    best_partial_count = match_count;
                    best_partial_index = Some(i);
                    best_partial_mismatches = mismatches;
                    best_partial_matches = matches;
                }
            }

            if let Some(idx) = matched_index {
                used_indices.insert(idx);
            } else if let Some(partial_idx) = best_partial_index {
                if best_partial_count > 0 {
                    let matched_context = best_partial_matches
                        .iter()
                        .map(|m| format!("{}={}", m.suffix, m.value))
                        .collect::<Vec<_>>()
                        .join(", ");
                    for m in &best_partial_mismatches {
                        // JS: m.actualValue.replace(/^"|"$/g, '')
                        let actual = if m.actual_value == "undefined" {
                            "undefined".to_string()
                        } else {
                            strip_outer_quotes(&m.actual_value)
                        };
                        failures.push(FailureDetail {
                            path: m.original_path.clone(),
                            expected: m.expected_value.clone(),
                            actual: format!(
                                "{} (matched by {} at [{}])",
                                actual, matched_context, partial_idx
                            ),
                        });
                    }
                } else {
                    // No partial match at all
                    for fs in &field_suffixes {
                        failures.push(FailureDetail {
                            path: fs.original_path.clone(),
                            expected: fs.expected_value.clone(),
                            actual: "no matching item found in array".to_string(),
                        });
                    }
                }
            } else {
                // No match at all
                for fs in &field_suffixes {
                    failures.push(FailureDetail {
                        path: fs.original_path.clone(),
                        expected: fs.expected_value.clone(),
                        actual: "no matching item found in array".to_string(),
                    });
                }
            }
        }
    }

    failures
}

/// Port of `tryRemapPaths()` from `validator.ts` (lines 235–282).
/// Called when ALL selective failures have actual == "undefined".
fn try_remap_paths(
    fields: &[ExpectedField],
    response_body: &Value,
    unordered: bool,
) -> Option<Vec<FailureDetail>> {
    // JS: if (responseBody == null || typeof responseBody !== 'object') return null;
    // In JS, typeof null === 'object' so the null check is separate.
    // Arrays and objects are both 'object' in JS — both pass through.
    if !response_body.is_object() && !response_body.is_array() {
        return Option::None;
    }

    let do_validate = |f: &[ExpectedField], body: &Value| -> Vec<FailureDetail> {
        if unordered {
            validate_fields_unordered(f, body)
        } else {
            validate_fields(f, body)
        }
    };

    // Strategy 1: paths have a wrapper key but response is an array → strip first segment
    if response_body.is_array() {
        let first_path = fields.first().map(|f| f.json_path.as_str()).unwrap_or("");
        // JS: firstPath.split(/[[.]/)[0] — split on '[' or '.'
        let first_segment = split_first_segment(first_path);
        if !first_segment.is_empty()
            && fields
                .iter()
                .all(|f| f.json_path.starts_with(first_segment))
        {
            let stripped: Vec<ExpectedField> = fields
                .iter()
                .map(|f| {
                    let new_path = f.json_path[first_segment.len()..].to_string();
                    // Strip leading '.' if present
                    let new_path = if new_path.starts_with('.') {
                        new_path[1..].to_string()
                    } else {
                        new_path
                    };
                    ExpectedField {
                        json_path: new_path,
                        ..f.clone()
                    }
                })
                .collect();

            let result = do_validate(&stripped, response_body);
            if has_improvement(&result) {
                return Some(result);
            }
        }
    }

    // Strategy 2: paths start with "[0]" but response wraps array in a key → try each root key
    if let Value::Object(root_obj) = response_body {
        for (key, val) in root_obj {
            if val.is_null() || (!val.is_object() && !val.is_array()) {
                continue;
            }

            // Try prefixing all paths with key.
            let prefixed: Vec<ExpectedField> = fields
                .iter()
                .map(|f| {
                    let new_path = format!("{}.{}", key, f.json_path).replace(".[", "[");
                    ExpectedField {
                        json_path: new_path,
                        ..f.clone()
                    }
                })
                .collect();

            let result = do_validate(&prefixed, response_body);
            if has_improvement(&result) {
                return Some(result);
            }

            // Strategy 2b: also try resolving directly against the nested value
            let direct = do_validate(fields, val);
            if has_improvement(&direct) {
                return Some(direct);
            }
        }
    }

    Option::None
}

/// JS: `result.length === 0 || !result.every(f => f.actual === 'undefined' || f.actual === undefined)`
/// "At least one failure has a non-undefined actual, OR no failures at all"
fn has_improvement(result: &[FailureDetail]) -> bool {
    result.is_empty() || !result.iter().all(|f| f.actual == "undefined")
}

/// Split path on '[' or '.' to get first segment.
/// JS: `firstPath.split(/[[.]/)[0]`
fn split_first_segment(path: &str) -> &str {
    let idx = path.find(|c: char| c == '[' || c == '.');
    match idx {
        Some(i) => &path[..i],
        None => path,
    }
}

/// JS: `m.actualValue.replace(/^"|"$/g, '')`
fn strip_outer_quotes(s: &str) -> String {
    let s = s.strip_prefix('"').unwrap_or(s);
    let s = s.strip_suffix('"').unwrap_or(s);
    s.to_string()
}

// ── Internal helper types ──────────────────────────────────

struct FieldSuffix {
    suffix: String,
    expected_value: String,
    original_path: String,
    operator: Option<crate::validation_types::FieldOperator>,
    operator_value: Option<String>,
    negate: bool,
}

struct Mismatch {
    original_path: String,
    expected_value: String,
    actual_value: String,
}

struct PartialMatch {
    suffix: String,
    value: String,
}
