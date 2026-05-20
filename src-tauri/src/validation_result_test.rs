use serde_json::json;
use std::collections::HashMap;

use crate::validation_result::build_validation_result;
use crate::validation_types::{
    Assertion, ComparisonOperator, ValidationConfig, ValidationMode,
};

fn no_headers() -> HashMap<String, String> {
    HashMap::new()
}

fn none_config() -> ValidationConfig {
    ValidationConfig {
        mode: ValidationMode::None,
        expected_json: None,
        expected_fields: None,
        unordered_arrays: None,
    }
}

fn selective_config_with_fields(
    fields: Vec<crate::validation_types::ExpectedField>,
) -> ValidationConfig {
    ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(fields),
        unordered_arrays: None,
    }
}

fn full_config(expected_json: &str) -> ValidationConfig {
    ValidationConfig {
        mode: ValidationMode::Full,
        expected_json: Some(expected_json.to_string()),
        expected_fields: None,
        unordered_arrays: None,
    }
}

fn ef(path: &str, expected: &str) -> crate::validation_types::ExpectedField {
    crate::validation_types::ExpectedField {
        json_path: path.to_string(),
        expected_value: expected.to_string(),
        operator: None,
        operator_value: None,
        negate: None,
        expression: None,
    }
}

// ── 10.1 build_validation_result() — combination logic ────────

#[test]
fn no_assertions_mode_none_passed_is_http_ok() {
    let body = json!({});
    let output = build_validation_result(
        200, 50.0, &no_headers(), "{}", &body, None, &none_config(), &[],
    );
    assert!(output.passed);
    assert!(output.failure_details.is_empty());
}

#[test]
fn no_assertions_mode_none_http_500_passed_false() {
    let body = json!({});
    let output = build_validation_result(
        500, 50.0, &no_headers(), "{}", &body, None, &none_config(), &[],
    );
    // HTTP 500 → http_ok = false, but mode=none so no JSON validation.
    // httpFailed overlay: !statusAsserted && status >= 400 → prepend (http) failure
    assert!(!output.passed);
    assert!(!output.failure_details.is_empty());
    assert_eq!(output.failure_details[0].path, "(http)");
}

#[test]
fn no_assertions_mode_selective_http_200_runs_validate() {
    let config = selective_config_with_fields(vec![ef("a", "1")]);
    let body = json!({"a": 1});
    let output = build_validation_result(
        200, 50.0, &no_headers(), r#"{"a":1}"#, &body, None, &config, &[],
    );
    assert!(output.passed);
    assert!(output.failure_details.is_empty());
}

#[test]
fn no_assertions_mode_selective_http_200_validation_fails() {
    let config = selective_config_with_fields(vec![ef("a", "99")]);
    let body = json!({"a": 1});
    let output = build_validation_result(
        200, 50.0, &no_headers(), r#"{"a":1}"#, &body, None, &config, &[],
    );
    assert!(!output.passed);
    assert!(!output.failure_details.is_empty());
}

#[test]
fn assertions_present_runs_evaluate_assertions() {
    let assertions = vec![Assertion::Status {
        negate: false,
        expected: "200".to_string(),
    }];
    let body = json!({});
    let output = build_validation_result(
        200, 50.0, &no_headers(), "{}", &body, None, &none_config(), &assertions,
    );
    assert!(output.passed);
}

#[test]
fn http_ok_check_boundary() {
    // status 399 is ok, 400 is not
    let body = json!({});
    let ok = build_validation_result(
        399, 50.0, &no_headers(), "{}", &body, None, &none_config(), &[],
    );
    assert!(ok.passed);

    let not_ok = build_validation_result(
        400, 50.0, &no_headers(), "{}", &body, None, &none_config(), &[],
    );
    assert!(!not_ok.passed);
}

#[test]
fn status_asserted_true_no_status_failure_status_ok_true() {
    // Status 500 but status assertion passes (expected "5xx") → status_ok = true
    let assertions = vec![Assertion::Status {
        negate: false,
        expected: "5xx".to_string(),
    }];
    let config = selective_config_with_fields(vec![ef("a", "1")]);
    let body = json!({"a": 1});
    let output = build_validation_result(
        500, 50.0, &no_headers(), r#"{"a":1}"#, &body, None, &config, &assertions,
    );
    // status_asserted=true, no (status) failure → status_ok=true
    // JSON validation runs and passes
    assert!(output.passed);
}

#[test]
fn status_asserted_true_with_status_failure_status_ok_false() {
    // Status 500 but status assertion expects "200" → fails
    let assertions = vec![Assertion::Status {
        negate: false,
        expected: "200".to_string(),
    }];
    let config = selective_config_with_fields(vec![ef("a", "1")]);
    let body = json!({"a": 1});
    let output = build_validation_result(
        500, 50.0, &no_headers(), r#"{"a":1}"#, &body, None, &config, &assertions,
    );
    // status_asserted=true, (status) failure present → status_ok=false
    // JSON validation skipped
    assert!(!output.passed);
    // Should have exactly the status failure, no JSON failures
    assert!(output.failure_details.iter().any(|f| f.path == "(status)"));
    assert!(output.failure_details.iter().all(|f| f.path != "a"));
}

#[test]
fn json_validation_skipped_when_mode_none() {
    let assertions = vec![Assertion::Status {
        negate: false,
        expected: "200".to_string(),
    }];
    let body = json!({"a": 99});
    // mode=none → no JSON validation even though body doesn't match
    let output = build_validation_result(
        200, 50.0, &no_headers(), r#"{"a":99}"#, &body, None, &none_config(), &assertions,
    );
    assert!(output.passed);
}

#[test]
fn json_validation_skipped_when_status_not_ok() {
    let config = selective_config_with_fields(vec![ef("a", "1")]);
    let body = json!({"a": 99});
    // HTTP 500, no status assertion → status_ok = false → JSON validation skipped
    let output = build_validation_result(
        500, 50.0, &no_headers(), r#"{"a":99}"#, &body, None, &config, &[],
    );
    assert!(!output.passed);
    // Should have (http) failure but NO validation failure for field "a"
    assert!(output.failure_details.iter().any(|f| f.path == "(http)"));
    assert!(output.failure_details.iter().all(|f| f.path != "a"));
}

// ── 10.2 HTTP failure overlay ────────────────────────────────

#[test]
fn http_500_no_status_assertion_prepends_http_failure() {
    let body = json!({});
    let output = build_validation_result(
        500, 50.0, &no_headers(), "{}", &body, None, &none_config(), &[],
    );
    assert!(!output.passed);
    assert_eq!(output.failure_details[0].path, "(http)");
    assert_eq!(output.failure_details[0].expected, "2xx");
    assert_eq!(output.failure_details[0].actual, "HTTP 500");
}

#[test]
fn http_500_with_error_message_uses_error_message_as_actual() {
    let body = json!({});
    let output = build_validation_result(
        500,
        50.0,
        &no_headers(),
        "{}",
        &body,
        Some("Internal Server Error"),
        &none_config(),
        &[],
    );
    assert_eq!(
        output.failure_details[0].actual,
        "Internal Server Error"
    );
}

#[test]
fn http_0_network_error() {
    let body = json!({});
    let output = build_validation_result(
        0, 50.0, &no_headers(), "", &body, None, &none_config(), &[],
    );
    assert!(!output.passed);
    assert_eq!(output.failure_details[0].path, "(http)");
    assert_eq!(output.failure_details[0].actual, "network error");
}

#[test]
fn http_500_passing_status_assertion_no_http_overlay() {
    let assertions = vec![Assertion::Status {
        negate: false,
        expected: "5xx".to_string(),
    }];
    let body = json!({});
    let output = build_validation_result(
        500, 50.0, &no_headers(), "{}", &body, None, &none_config(), &assertions,
    );
    // status_asserted=true → no HTTP overlay
    assert!(output.passed);
    assert!(output.failure_details.is_empty());
}

#[test]
fn http_200_no_overlay() {
    let body = json!({});
    let output = build_validation_result(
        200, 50.0, &no_headers(), "{}", &body, None, &none_config(), &[],
    );
    assert!(output.passed);
    assert!(output.failure_details.is_empty());
}

#[test]
fn http_0_with_status_assertion_passing_no_network_error() {
    // Status assertion expects "0" → matches http_status 0
    // matches_status_pattern("0", 0) → exact match
    let assertions = vec![Assertion::Status {
        negate: false,
        expected: "0".to_string(),
    }];
    let body = json!({});
    let output = build_validation_result(
        0, 50.0, &no_headers(), "", &body, None, &none_config(), &assertions,
    );
    // status_asserted=true → no network_error flag
    // No (status) failure → status_ok = true
    assert!(output.passed);
}

#[test]
fn http_failure_drops_json_failures() {
    let config = selective_config_with_fields(vec![ef("a", "99")]);
    let body = json!({"a": 1});
    // HTTP 500 + no status assertion → overlay DROPS JSON failures
    let output = build_validation_result(
        500, 50.0, &no_headers(), r#"{"a":1}"#, &body, None, &config, &[],
    );
    // Only (http) failure, no field "a" failure
    assert!(output.failure_details.iter().any(|f| f.path == "(http)"));
    assert!(output.failure_details.iter().all(|f| f.path != "a"));
}

// ── 10.3 Final result computation ────────────────────────────

#[test]
fn passed_equals_no_network_error_and_no_failures() {
    let body = json!({});
    let output = build_validation_result(
        200, 50.0, &no_headers(), "{}", &body, None, &none_config(), &[],
    );
    assert!(output.passed);
    assert!(output.failure_details.is_empty());
}

#[test]
fn error_message_passed_through_unchanged() {
    let body = json!({});
    let output = build_validation_result(
        200,
        50.0,
        &no_headers(),
        "{}",
        &body,
        Some("custom error"),
        &none_config(),
        &[],
    );
    assert_eq!(output.error_message, Some("custom error".to_string()));
}

#[test]
fn network_error_always_passed_false() {
    let body = json!({});
    let output = build_validation_result(
        0, 50.0, &no_headers(), "", &body, None, &none_config(), &[],
    );
    assert!(!output.passed);
}

#[test]
fn failures_merged_in_order_assertions_first() {
    let assertions = vec![Assertion::ResponseTime {
        negate: false,
        max_ms: 10.0,
    }];
    let config = selective_config_with_fields(vec![ef("a", "99")]);
    let body = json!({"a": 1});
    let output = build_validation_result(
        200, 50.0, &no_headers(), r#"{"a":1}"#, &body, None, &config, &assertions,
    );
    // First failure should be responseTime (assertion), then field "a" (JSON)
    assert!(output.failure_details.len() >= 2);
    assert_eq!(output.failure_details[0].path, "(responseTime)");
}

#[test]
fn full_mode_with_invalid_expected_json_parse_failure() {
    let config = full_config("{invalid json}");
    let body = json!({"a": 1});
    let output = build_validation_result(
        200, 50.0, &no_headers(), r#"{"a":1}"#, &body, None, &config, &[],
    );
    assert!(!output.passed);
    assert_eq!(output.failure_details[0].path, "(parse)");
}

#[test]
fn full_mode_matching_body_passes() {
    let config = full_config(r#"{"a":1}"#);
    let body = json!({"a": 1});
    let output = build_validation_result(
        200, 50.0, &no_headers(), r#"{"a":1}"#, &body, None, &config, &[],
    );
    assert!(output.passed);
}

#[test]
fn http_500_with_empty_error_message_uses_status_fallback() {
    let body = json!({});
    let output = build_validation_result(
        500,
        50.0,
        &no_headers(),
        "{}",
        &body,
        Some(""),
        &none_config(),
        &[],
    );
    // Empty errorMessage is falsy in JS (|| fallback) → should use "HTTP 500"
    assert_eq!(output.failure_details[0].actual, "HTTP 500");
}

#[test]
fn http_0_with_empty_error_message_uses_network_error() {
    let body = json!({});
    let output = build_validation_result(
        0,
        50.0,
        &no_headers(),
        "",
        &body,
        Some(""),
        &none_config(),
        &[],
    );
    assert_eq!(output.failure_details[0].actual, "network error");
}

#[test]
fn empty_response_body_parses_as_null() {
    let config = selective_config_with_fields(vec![ef("a", "1")]);
    let body = serde_json::Value::Null;
    let output = build_validation_result(
        200, 50.0, &no_headers(), "", &body, None, &config, &[],
    );
    // Path "a" doesn't exist in null → failure
    assert!(!output.passed);
    assert!(!output.failure_details.is_empty());
}

#[test]
fn combined_assertion_and_json_failures() {
    let assertions = vec![Assertion::Numeric {
        negate: false,
        json_path: "count".to_string(),
        operator: ComparisonOperator::Gt,
        value: 100.0,
    }];
    let config = selective_config_with_fields(vec![ef("name", "\"Expected\"")]);
    let body = json!({"count": 50, "name": "Wrong"});
    let output = build_validation_result(
        200,
        50.0,
        &no_headers(),
        r#"{"count":50,"name":"Wrong"}"#,
        &body,
        None,
        &config,
        &assertions,
    );
    assert!(!output.passed);
    // Should have both numeric assertion failure and field validation failure
    assert!(output.failure_details.len() >= 2);
}

// ── Integration: realistic end-to-end scenarios ────────────

#[test]
fn integration_selective_with_remap_through_build() {
    // Paths reference "data[0].name" but response is an unwrapped array.
    // build_validation_result → validate → validate_selective → try_remap_paths
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![ef("data[0].name", "\"Alice\"")]),
        unordered_arrays: None,
    };
    let body = json!([{"name": "Alice"}]);
    let output = build_validation_result(
        200,
        50.0,
        &no_headers(),
        r#"[{"name":"Alice"}]"#,
        &body,
        None,
        &config,
        &[],
    );
    assert!(output.passed);
    assert!(output.failure_details.is_empty());
}

#[test]
fn integration_http_500_with_failing_assertion_no_json_check() {
    // HTTP 500 + status assertion (expects 200) → fails → status_ok=false → JSON skipped
    // Also: status_asserted=true → no HTTP overlay
    let assertions = vec![Assertion::Status {
        negate: false,
        expected: "200".to_string(),
    }];
    let config = selective_config_with_fields(vec![ef("key", "\"value\"")]);
    let body = json!({"key": "wrong"});
    let output = build_validation_result(
        500,
        50.0,
        &no_headers(),
        r#"{"key":"wrong"}"#,
        &body,
        None,
        &config,
        &assertions,
    );
    assert!(!output.passed);
    // Only status assertion failure — no JSON failure, no HTTP overlay
    assert!(output.failure_details.iter().any(|f| f.path == "(status)"));
    assert!(output.failure_details.iter().all(|f| f.path != "key"));
    assert!(output.failure_details.iter().all(|f| f.path != "(http)"));
}

#[test]
fn integration_unordered_with_assertions_both_pass() {
    let assertions = vec![Assertion::Status {
        negate: false,
        expected: "2xx".to_string(),
    }];
    let config = ValidationConfig {
        mode: ValidationMode::Selective,
        expected_json: None,
        expected_fields: Some(vec![
            ef("items[0].id", "2"),
            ef("items[1].id", "1"),
        ]),
        unordered_arrays: Some(true),
    };
    let body = json!({"items": [{"id": 1}, {"id": 2}]});
    let output = build_validation_result(
        200,
        50.0,
        &no_headers(),
        r#"{"items":[{"id":1},{"id":2}]}"#,
        &body,
        None,
        &config,
        &assertions,
    );
    assert!(output.passed);
    assert!(output.failure_details.is_empty());
}

#[test]
fn negated_status_pass_allows_json_validation() {
    // HTTP 404, negated status "200" → assertion fails (404 != 200), negation inverts → pass.
    // status_asserted = true, but the (status) failure is dropped during negation,
    // so status_ok = true → JSON validation should run.
    let assertions = vec![Assertion::Status {
        negate: true,
        expected: "200".to_string(),
    }];
    let config = selective_config_with_fields(vec![ef("key", "\"hello\"")]);
    let body = json!({"key": "hello"});
    let output = build_validation_result(
        404,
        50.0,
        &no_headers(),
        r#"{"key":"hello"}"#,
        &body,
        None,
        &config,
        &assertions,
    );
    // status_asserted=true → no HTTP overlay. Negated status passed (no (status) failure).
    // JSON validation runs and passes → overall pass.
    assert!(output.passed, "negated status pass + valid JSON → should pass");
    assert!(output.failure_details.is_empty());
}

#[test]
fn negated_status_fail_blocks_json_validation() {
    // HTTP 200, negated status "200" → assertion passes (200 == 200), negation inverts → fail.
    // The negation handler pushes a (status) failure. status_ok = false → JSON validation skipped.
    let assertions = vec![Assertion::Status {
        negate: true,
        expected: "200".to_string(),
    }];
    let config = selective_config_with_fields(vec![ef("key", "\"wrong\"")]);
    let body = json!({"key": "hello"});
    let output = build_validation_result(
        200,
        50.0,
        &no_headers(),
        r#"{"key":"hello"}"#,
        &body,
        None,
        &config,
        &assertions,
    );
    assert!(!output.passed, "negated status fail → should fail");
    assert_eq!(output.failure_details.len(), 1);
    assert_eq!(output.failure_details[0].path, "(status)");
}

#[test]
fn integration_full_mode_mismatch_through_build() {
    let config = full_config(r#"{"status":"ok","count":5}"#);
    let body = json!({"status": "ok", "count": 3});
    let output = build_validation_result(
        200,
        50.0,
        &no_headers(),
        r#"{"status":"ok","count":3}"#,
        &body,
        None,
        &config,
        &[],
    );
    assert!(!output.passed);
    assert_eq!(output.failure_details.len(), 1);
    assert_eq!(output.failure_details[0].path, "count");
}
