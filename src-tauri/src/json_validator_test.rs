use serde_json::json;

use crate::json_validator::{validate, validate_fields, validate_fields_unordered};
use crate::validation_types::{
    ExpectedField, FieldOperator, ValidationConfig, ValidationMode,
};

fn cfg(mode: ValidationMode) -> ValidationConfig {
    ValidationConfig {
        mode,
        expected_json: None,
        expected_fields: None,
        unordered_arrays: None,
    }
}

fn field(path: &str, expected: &str) -> ExpectedField {
    ExpectedField {
        json_path: path.to_string(),
        expected_value: expected.to_string(),
        operator: None,
        operator_value: None,
        negate: None,
        expression: None,
    }
}

fn field_with_op(
    path: &str,
    expected: &str,
    op: FieldOperator,
    op_val: Option<&str>,
) -> ExpectedField {
    ExpectedField {
        json_path: path.to_string(),
        expected_value: expected.to_string(),
        operator: Some(op),
        operator_value: op_val.map(String::from),
        negate: None,
        expression: None,
    }
}

fn field_negated(path: &str, expected: &str) -> ExpectedField {
    ExpectedField {
        json_path: path.to_string(),
        expected_value: expected.to_string(),
        operator: None,
        operator_value: None,
        negate: Some(true),
        expression: None,
    }
}

fn field_with_op_negated(
    path: &str,
    expected: &str,
    op: FieldOperator,
    op_val: Option<&str>,
) -> ExpectedField {
    ExpectedField {
        json_path: path.to_string(),
        expected_value: expected.to_string(),
        operator: Some(op),
        operator_value: op_val.map(String::from),
        negate: Some(true),
        expression: None,
    }
}

// ── 9.1 validate() — mode routing ──────────────────────────

#[test]
fn validate_mode_none_returns_empty() {
    let config = cfg(ValidationMode::None);
    let body = json!({"a": 1});
    assert!(validate(&config, &body).is_empty());
}

#[test]
fn validate_mode_full_valid_expected_json() {
    let config = ValidationConfig {
        mode: ValidationMode::Full,
        expected_json: Some(r#"{"a":1}"#.to_string()),
        expected_fields: None,
        unordered_arrays: None,
    };
    let body = json!({"a": 1});
    assert!(validate(&config, &body).is_empty());
}

#[test]
fn validate_mode_full_mismatch() {
    let config = ValidationConfig {
        mode: ValidationMode::Full,
        expected_json: Some(r#"{"a":1}"#.to_string()),
        expected_fields: None,
        unordered_arrays: None,
    };
    let body = json!({"a": 2});
    let failures = validate(&config, &body);
    assert_eq!(failures.len(), 1);
    assert_eq!(failures[0].path, "a");
}

#[test]
fn validate_mode_full_empty_expected_json() {
    let config = ValidationConfig {
        mode: ValidationMode::Full,
        expected_json: Some(String::new()),
        expected_fields: None,
        unordered_arrays: None,
    };
    assert!(validate(&config, &json!({})).is_empty());
}

#[test]
fn validate_mode_full_none_expected_json() {
    let config = ValidationConfig {
        mode: ValidationMode::Full,
        expected_json: None,
        expected_fields: None,
        unordered_arrays: None,
    };
    assert!(validate(&config, &json!({})).is_empty());
}

#[test]
fn validate_mode_full_invalid_json_string() {
    let config = ValidationConfig {
        mode: ValidationMode::Full,
        expected_json: Some("{invalid}".to_string()),
        expected_fields: None,
        unordered_arrays: None,
    };
    let failures = validate(&config, &json!({}));
    assert_eq!(failures.len(), 1);
    assert_eq!(failures[0].path, "(parse)");
    assert_eq!(failures[0].expected, "valid JSON");
    assert_eq!(failures[0].actual, "parse error in expected JSON");
}

#[test]
fn validate_mode_selective_empty_fields() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![]),
        unordered_arrays: None,
    };
    assert!(validate(&config, &json!({})).is_empty());
}

#[test]
fn validate_mode_selective_calls_validate_fields() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![field("a", "1")]),
        unordered_arrays: None,
    };
    let body = json!({"a": 1});
    assert!(validate(&config, &body).is_empty());
}

#[test]
fn validate_mode_selective_calls_unordered_when_flag_set() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![field("arr[0].name", "Alice")]),
        unordered_arrays: Some(true),
    };
    let body = json!({"arr": [{"name": "Bob"}, {"name": "Alice"}]});
    // Unordered should find "Alice" at index 1
    assert!(validate(&config, &body).is_empty());
}

// ── 9.2 validate_fields() — ordered field validation ────────

#[test]
fn validate_fields_with_operator() {
    let fields = vec![field_with_op("a", "5", FieldOperator::GreaterThan, None)];
    let body = json!({"a": 10});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn validate_fields_with_operator_failure() {
    let fields = vec![field_with_op("a", "5", FieldOperator::GreaterThan, None)];
    let body = json!({"a": 3});
    let failures = validate_fields(&fields, &body);
    assert_eq!(failures.len(), 1);
    assert_eq!(failures[0].path, "a");
}

#[test]
fn validate_fields_with_operator_negate() {
    let fields = vec![field_with_op_negated(
        "a",
        "5",
        FieldOperator::GreaterThan,
        None,
    )];
    // a=3 > 5 fails; negated → pass
    let body = json!({"a": 3});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn validate_fields_with_operator_negate_prepends_not() {
    let fields = vec![field_with_op_negated(
        "a",
        "5",
        FieldOperator::GreaterThan,
        None,
    )];
    // a=10 > 5 passes; negated → fail
    let body = json!({"a": 10});
    let failures = validate_fields(&fields, &body);
    assert_eq!(failures.len(), 1);
    assert!(failures[0].expected.starts_with("NOT "));
}

#[test]
fn validate_fields_no_operator_equality() {
    let fields = vec![field("name", "\"hello\"")];
    let body = json!({"name": "hello"});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn validate_fields_no_operator_json_parse_normalization() {
    // JS: JSON.stringify(JSON.parse(expected)) normalizes
    let fields = vec![field("obj", r#"{"b":2,"a":1}"#)];
    // serde_json normalizes key order differently, but the important thing is
    // that we parse then stringify. serde preserves insertion order, so this
    // tests that the parse→stringify normalization happens.
    let body = json!({"obj": {"b": 2, "a": 1}});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn validate_fields_no_operator_expected_not_valid_json() {
    // Expected "hello world" is not valid JSON → JSON.stringify("hello world") = '"hello world"'
    let fields = vec![field("name", "hello world")];
    let body = json!({"name": "hello world"});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn validate_fields_no_operator_mismatch() {
    let fields = vec![field("a", "1")];
    let body = json!({"a": 2});
    let failures = validate_fields(&fields, &body);
    assert_eq!(failures.len(), 1);
    assert_eq!(failures[0].expected, "1");
    assert_eq!(failures[0].actual, "2");
}

#[test]
fn validate_fields_no_operator_negated() {
    let fields = vec![field_negated("a", "1")];
    // a=1 matches → negated → fail
    let body = json!({"a": 1});
    let failures = validate_fields(&fields, &body);
    assert_eq!(failures.len(), 1);
    assert_eq!(failures[0].expected, "NOT equals 1");
}

#[test]
fn validate_fields_no_operator_negated_mismatch_passes() {
    let fields = vec![field_negated("a", "1")];
    // a=2 doesn't match → negated → pass
    let body = json!({"a": 2});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn validate_fields_missing_field() {
    let fields = vec![field("nonexistent", "1")];
    let body = json!({"a": 1});
    let failures = validate_fields(&fields, &body);
    assert_eq!(failures.len(), 1);
    assert_eq!(failures[0].actual, "undefined");
}

#[test]
fn validate_fields_multiple_fields_all_collected() {
    let fields = vec![field("a", "1"), field("b", "2")];
    let body = json!({"a": 99, "b": 99});
    let failures = validate_fields(&fields, &body);
    assert_eq!(failures.len(), 2);
}

// ── 9.3 validate_fields_unordered() ─────────────────────────

#[test]
fn unordered_non_array_fields_validated_normally() {
    let fields = vec![field("name", "\"Alice\"")];
    let body = json!({"name": "Alice"});
    assert!(validate_fields_unordered(&fields, &body).is_empty());
}

#[test]
fn unordered_array_fields_grouped_by_row_prefix() {
    let fields = vec![
        field("offers[0].name", "\"A\""),
        field("offers[0].code", "\"X\""),
    ];
    let body = json!({"offers": [{"name": "A", "code": "X"}]});
    assert!(validate_fields_unordered(&fields, &body).is_empty());
}

#[test]
fn unordered_row_prefixes_grouped_by_pattern() {
    let fields = vec![
        field("offers[0].name", "\"A\""),
        field("offers[1].name", "\"B\""),
    ];
    // Unordered: offers[0] and offers[1] grouped under offers[*]
    let body = json!({"offers": [{"name": "B"}, {"name": "A"}]});
    assert!(validate_fields_unordered(&fields, &body).is_empty());
}

#[test]
fn unordered_perfect_match_marks_index_used() {
    let fields = vec![
        field("arr[0].id", "1"),
        field("arr[1].id", "2"),
    ];
    let body = json!({"arr": [{"id": 1}, {"id": 2}]});
    assert!(validate_fields_unordered(&fields, &body).is_empty());
}

#[test]
fn unordered_used_indices_prevents_double_matching() {
    let fields = vec![
        field("arr[0].id", "1"),
        field("arr[1].id", "1"),
    ];
    // Only one element with id=1 → second row can't match
    let body = json!({"arr": [{"id": 1}, {"id": 2}]});
    let failures = validate_fields_unordered(&fields, &body);
    assert!(!failures.is_empty());
}

#[test]
fn unordered_partial_match_reports_context() {
    let fields = vec![
        field("arr[0].name", "\"Alice\""),
        field("arr[0].age", "30"),
    ];
    let body = json!({"arr": [{"name": "Alice", "age": 25}]});
    let failures = validate_fields_unordered(&fields, &body);
    assert_eq!(failures.len(), 1);
    assert!(failures[0].actual.contains("matched by"));
    assert!(failures[0].actual.contains("at [0]"));
}

#[test]
fn unordered_partial_match_strips_quotes_from_actual() {
    let fields = vec![
        field("arr[0].name", "\"Alice\""),
        field("arr[0].city", "\"NYC\""),
    ];
    let body = json!({"arr": [{"name": "Alice", "city": "LA"}]});
    let failures = validate_fields_unordered(&fields, &body);
    assert_eq!(failures.len(), 1);
    // Actual should have quotes stripped from "LA"
    assert!(failures[0].actual.starts_with("LA"));
}

#[test]
fn unordered_no_match_reports_no_matching_item() {
    let fields = vec![field("arr[0].id", "999")];
    let body = json!({"arr": [{"id": 1}, {"id": 2}]});
    let failures = validate_fields_unordered(&fields, &body);
    assert_eq!(failures.len(), 1);
    assert_eq!(failures[0].actual, "no matching item found in array");
}

#[test]
fn unordered_array_not_found_falls_back_to_validate_fields() {
    let fields = vec![field("missing[0].name", "\"A\"")];
    let body = json!({"other": 1});
    let failures = validate_fields_unordered(&fields, &body);
    assert_eq!(failures.len(), 1);
}

#[test]
fn unordered_with_operator_in_array_fields() {
    let fields = vec![field_with_op(
        "arr[0].age",
        "18",
        FieldOperator::GreaterThan,
        None,
    )];
    let body = json!({"arr": [{"age": 25}]});
    assert!(validate_fields_unordered(&fields, &body).is_empty());
}

#[test]
fn unordered_with_negate_in_array_fields() {
    let fields = vec![field_with_op_negated(
        "arr[0].status",
        "\"active\"",
        FieldOperator::Equals,
        None,
    )];
    // status="inactive" equals "active" → false; negated → pass
    let body = json!({"arr": [{"status": "inactive"}]});
    assert!(validate_fields_unordered(&fields, &body).is_empty());
}

// ── 9.4 try_remap_paths() ──────────────────────────────────
// (tested indirectly through validate() since try_remap_paths is private)

#[test]
fn remap_strategy1_strip_prefix_when_response_is_array() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![
            field("data[0].name", "\"Alice\""),
            field("data[1].name", "\"Bob\""),
        ]),
        unordered_arrays: None,
    };
    // Response is array (no "data" wrapper) → strip "data" prefix
    let body = json!([{"name": "Alice"}, {"name": "Bob"}]);
    assert!(validate(&config, &body).is_empty());
}

#[test]
fn remap_strategy2_add_prefix_when_response_has_wrapper() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![field("name", "\"Alice\"")]),
        unordered_arrays: None,
    };
    // Response wraps in "result" key → try resolving against nested value
    let body = json!({"result": {"name": "Alice"}});
    assert!(validate(&config, &body).is_empty());
}

#[test]
fn remap_no_improvement_keeps_original() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![field("totally.missing.path", "1")]),
        unordered_arrays: None,
    };
    let body = json!({"a": 1});
    let failures = validate(&config, &body);
    assert!(!failures.is_empty());
}

#[test]
fn remap_respects_unordered_flag() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![
            field("items[0].name", "\"B\""),
            field("items[1].name", "\"A\""),
        ]),
        unordered_arrays: Some(true),
    };
    // Response wraps in "data" → try resolving against nested value
    // Unordered matching should find items in any order
    let body = json!({"data": {"items": [{"name": "A"}, {"name": "B"}]}});
    assert!(validate(&config, &body).is_empty());
}

#[test]
fn remap_not_called_when_response_is_null() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![field("a", "1")]),
        unordered_arrays: None,
    };
    let body = serde_json::Value::Null;
    let failures = validate(&config, &body);
    assert!(!failures.is_empty());
}

#[test]
fn remap_strategy1_first_segment_detected_by_bracket() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![field("results[0]", "1")]),
        unordered_arrays: None,
    };
    // Response is array → strip "results" prefix
    let body = json!([1, 2, 3]);
    assert!(validate(&config, &body).is_empty());
}

#[test]
fn remap_strategy2_prefixed_path_with_bracket() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![field("[0].name", "\"Alice\"")]),
        unordered_arrays: None,
    };
    // Response has wrapper key "data" → try data.[0].name → data[0].name
    let body = json!({"data": [{"name": "Alice"}]});
    assert!(validate(&config, &body).is_empty());
}

// ── Additional edge cases ───────────────────────────────────

#[test]
fn remap_not_called_for_primitive_response() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![field("a", "1")]),
        unordered_arrays: None,
    };
    // Response is a primitive number — tryRemap should not be called
    let body = json!(42);
    let failures = validate(&config, &body);
    assert!(!failures.is_empty());
}

#[test]
fn remap_not_called_for_string_response() {
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![field("a", "1")]),
        unordered_arrays: None,
    };
    let body = json!("hello");
    let failures = validate(&config, &body);
    assert!(!failures.is_empty());
}

#[test]
fn validate_fields_null_value_at_path_returns_null() {
    let fields = vec![field("a", "null")];
    let body = json!({"a": null});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn validate_fields_exists_operator_null_at_path_passes() {
    let fields = vec![field_with_op("a", "", FieldOperator::Exists, None)];
    let body = json!({"a": null});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn validate_fields_exists_operator_missing_path_fails() {
    let fields = vec![field_with_op("missing", "", FieldOperator::Exists, None)];
    let body = json!({"a": 1});
    let failures = validate_fields(&fields, &body);
    assert_eq!(failures.len(), 1);
}

#[test]
fn validate_fields_not_exists_operator_missing_path_passes() {
    let fields = vec![field_with_op("missing", "", FieldOperator::NotExists, None)];
    let body = json!({"a": 1});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn unordered_partial_match_undefined_actual_not_stripped() {
    // When a partial match field has actual="undefined" (path not found),
    // it should NOT be quote-stripped (already handled by special case)
    let fields = vec![
        field("arr[0].name", "\"Alice\""),
        field("arr[0].missing_field", "\"xxx\""),
    ];
    let body = json!({"arr": [{"name": "Alice"}]});
    let failures = validate_fields_unordered(&fields, &body);
    assert_eq!(failures.len(), 1);
    // Should show "undefined (matched by ...)" not stripped quotes of "undefined"
    assert!(failures[0].actual.starts_with("undefined"));
    assert!(failures[0].actual.contains("matched by"));
}

#[test]
fn validate_fields_boolean_equality() {
    let fields = vec![field("flag", "true")];
    let body = json!({"flag": true});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn validate_fields_array_equality() {
    let fields = vec![field("items", "[1,2,3]")];
    let body = json!({"items": [1, 2, 3]});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn validate_fields_nested_path() {
    let fields = vec![field("a.b.c", "42")];
    let body = json!({"a": {"b": {"c": 42}}});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn validate_fields_array_index_path() {
    let fields = vec![field("arr[1].name", "\"Bob\"")];
    let body = json!({"arr": [{"name": "Alice"}, {"name": "Bob"}]});
    assert!(validate_fields(&fields, &body).is_empty());
}

#[test]
fn unordered_multi_field_row_match_at_different_index() {
    // Two rows with multiple fields — row 0 matches at array index 1
    let fields = vec![
        field("arr[0].name", "\"Bob\""),
        field("arr[0].age", "30"),
        field("arr[1].name", "\"Alice\""),
        field("arr[1].age", "25"),
    ];
    let body = json!({"arr": [{"name": "Alice", "age": 25}, {"name": "Bob", "age": 30}]});
    assert!(validate_fields_unordered(&fields, &body).is_empty());
}
