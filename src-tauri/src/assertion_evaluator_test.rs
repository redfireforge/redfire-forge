#[cfg(test)]
mod tests {
    use crate::assertion_evaluator::{compare, evaluate_assertions, format_op};
    use crate::validation_types::*;
    use serde_json::json;
    use std::collections::HashMap;

    fn make_ctx<'a>(
        status: u16,
        time_ms: f64,
        headers: &'a HashMap<String, String>,
        body: &'a serde_json::Value,
        raw: &'a str,
    ) -> AssertionContext<'a> {
        AssertionContext {
            http_status: status,
            response_time_ms: time_ms,
            response_headers: headers,
            response_body: body,
            raw_body: raw,
        }
    }

    fn default_headers() -> HashMap<String, String> {
        let mut h = HashMap::new();
        h.insert("Content-Type".into(), "application/json".into());
        h.insert("X-Request-Id".into(), "abc-123".into());
        h
    }

    // ── compare ────────────────────────────────────────────────

    #[test]
    fn compare_eq() {
        assert!(compare(5.0, &ComparisonOperator::Eq, 5.0));
        assert!(!compare(5.0, &ComparisonOperator::Eq, 6.0));
    }

    #[test]
    fn compare_ne() {
        assert!(compare(5.0, &ComparisonOperator::Ne, 6.0));
        assert!(!compare(5.0, &ComparisonOperator::Ne, 5.0));
    }

    #[test]
    fn compare_gt_gte_lt_lte() {
        assert!(compare(6.0, &ComparisonOperator::Gt, 5.0));
        assert!(compare(5.0, &ComparisonOperator::Gte, 5.0));
        assert!(compare(4.0, &ComparisonOperator::Lt, 5.0));
        assert!(compare(5.0, &ComparisonOperator::Lte, 5.0));
    }

    #[test]
    fn format_op_symbols() {
        assert_eq!(format_op(&ComparisonOperator::Eq), "=");
        assert_eq!(format_op(&ComparisonOperator::Gt), ">");
        assert_eq!(format_op(&ComparisonOperator::Lte), "≤");
    }

    // ── status assertion ───────────────────────────────────────

    #[test]
    fn status_pass() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Status {
            negate: false,
            expected: "200".into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
        assert!(r.status_asserted);
    }

    #[test]
    fn status_fail() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(404, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Status {
            negate: false,
            expected: "200".into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert_eq!(r.failures[0].path, "(status)");
    }

    #[test]
    fn status_range_pass() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(201, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Status {
            negate: false,
            expected: "200-299".into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn status_class_pattern() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(201, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Status {
            negate: false,
            expected: "2xx".into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    // ── responseTime assertion ──────────────────────────────────

    #[test]
    fn response_time_pass() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(200, 50.0, &h, &body, "");
        let assertions = vec![Assertion::ResponseTime {
            negate: false,
            max_ms: 100.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn response_time_fail() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(200, 150.0, &h, &body, "");
        let assertions = vec![Assertion::ResponseTime {
            negate: false,
            max_ms: 100.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].expected.contains("100"));
    }

    // ── header assertion ───────────────────────────────────────

    #[test]
    fn header_exists_pass() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Header {
            negate: false,
            name: "Content-Type".into(),
            operator: AssertionOperator::Exists,
            value: None,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn header_equals_pass() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Header {
            negate: false,
            name: "Content-Type".into(),
            operator: AssertionOperator::Equals,
            value: Some("application/json".into()),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn header_missing_fails() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Header {
            negate: false,
            name: "X-Missing".into(),
            operator: AssertionOperator::Exists,
            value: None,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
    }

    // ── regex assertion ────────────────────────────────────────

    #[test]
    fn regex_match_pass() {
        let h = default_headers();
        let body = json!({"msg": "hello123"});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Regex {
            negate: false,
            json_path: "$.msg".into(),
            pattern: r"\d+".into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn regex_no_match_fail() {
        let h = default_headers();
        let body = json!({"msg": "hello"});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Regex {
            negate: false,
            json_path: "$.msg".into(),
            pattern: r"^\d+$".into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
    }

    #[test]
    fn regex_truncates_long_actual() {
        let h = default_headers();
        let long_str = "a".repeat(300);
        let body = json!({"msg": long_str});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Regex {
            negate: false,
            json_path: "$.msg".into(),
            pattern: r"^NOMATCH$".into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].actual.len() <= 210);
    }

    // ── arrayLength assertion ──────────────────────────────────

    #[test]
    fn array_length_pass() {
        let h = default_headers();
        let body = json!({"items": [1, 2, 3]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::ArrayLength {
            negate: false,
            json_path: "$.items".into(),
            operator: ComparisonOperator::Eq,
            value: 3.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn array_length_fail() {
        let h = default_headers();
        let body = json!({"items": [1, 2]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::ArrayLength {
            negate: false,
            json_path: "$.items".into(),
            operator: ComparisonOperator::Eq,
            value: 3.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].actual.contains("length 2"));
    }

    #[test]
    fn array_length_not_array() {
        let h = default_headers();
        let body = json!({"items": "not_array"});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::ArrayLength {
            negate: false,
            json_path: "$.items".into(),
            operator: ComparisonOperator::Eq,
            value: 0.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].actual.contains("not an array"));
        assert!(r.failures[0].actual.contains("string"), "JS typeof string is 'string'");
    }

    #[test]
    fn array_length_null_uses_js_typeof() {
        let h = default_headers();
        let body = json!({"items": null});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::ArrayLength {
            negate: false,
            json_path: "$.items".into(),
            operator: ComparisonOperator::Eq,
            value: 0.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].actual.contains("object"), "JS typeof null === 'object'");
    }

    // ── numeric assertion ──────────────────────────────────────

    #[test]
    fn numeric_pass() {
        let h = default_headers();
        let body = json!({"count": 42});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Numeric {
            negate: false,
            json_path: "$.count".into(),
            operator: ComparisonOperator::Gt,
            value: 10.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn numeric_fail() {
        let h = default_headers();
        let body = json!({"count": 5});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Numeric {
            negate: false,
            json_path: "$.count".into(),
            operator: ComparisonOperator::Gt,
            value: 10.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
    }

    #[test]
    fn numeric_not_a_number() {
        let h = default_headers();
        let body = json!({"count": "abc"});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Numeric {
            negate: false,
            json_path: "$.count".into(),
            operator: ComparisonOperator::Eq,
            value: 0.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].actual.contains("not a number"));
    }

    // ── date assertion ─────────────────────────────────────────

    #[test]
    fn date_pass_fixed() {
        let h = default_headers();
        let body = json!({"created": "2024-06-15T12:00:00Z"});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Date {
            negate: false,
            json_path: "$.created".into(),
            operator: ComparisonOperator::Gte,
            reference: DateReference::Fixed {
                iso: "2024-01-01".into(),
            },
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    // ── typeCheck assertion ────────────────────────────────────

    #[test]
    fn type_check_pass() {
        let h = default_headers();
        let body = json!({"name": "alice"});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::TypeCheck {
            negate: false,
            json_path: "$.name".into(),
            expected_type: JsonTypeName::String,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn type_check_fail() {
        let h = default_headers();
        let body = json!({"name": 42});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::TypeCheck {
            negate: false,
            json_path: "$.name".into(),
            expected_type: JsonTypeName::String,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].actual.contains("type number"));
    }

    #[test]
    fn type_check_not_found() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::TypeCheck {
            negate: false,
            json_path: "$.missing".into(),
            expected_type: JsonTypeName::String,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].actual.contains("path not found"));
    }

    // ── existence assertion ────────────────────────────────────

    #[test]
    fn existence_pass() {
        let h = default_headers();
        let body = json!({"name": "alice"});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Existence {
            negate: false,
            json_path: "$.name".into(),
            expect_exists: true,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn existence_fail() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Existence {
            negate: false,
            json_path: "$.name".into(),
            expect_exists: true,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
    }

    #[test]
    fn existence_expect_not_exists_pass() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Existence {
            negate: false,
            json_path: "$.missing".into(),
            expect_exists: false,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    // ── arrayContains assertion ────────────────────────────────

    #[test]
    fn array_contains_any_pass() {
        let h = default_headers();
        let body = json!({"arr": [1, 2, 3]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::ArrayContains {
            negate: false,
            json_path: "$.arr".into(),
            value: "2".into(),
            mode: ArrayContainsMode::Any,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn array_contains_any_fail() {
        let h = default_headers();
        let body = json!({"arr": [1, 2, 3]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::ArrayContains {
            negate: false,
            json_path: "$.arr".into(),
            value: "4".into(),
            mode: ArrayContainsMode::Any,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
    }

    #[test]
    fn array_contains_none_pass() {
        let h = default_headers();
        let body = json!({"arr": [1, 2, 3]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::ArrayContains {
            negate: false,
            json_path: "$.arr".into(),
            value: "4".into(),
            mode: ArrayContainsMode::None,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn array_contains_none_fail() {
        let h = default_headers();
        let body = json!({"arr": [1, 2, 3]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::ArrayContains {
            negate: false,
            json_path: "$.arr".into(),
            value: "2".into(),
            mode: ArrayContainsMode::None,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].actual.contains("index 1"));
    }

    // ── each assertion ─────────────────────────────────────────

    #[test]
    fn each_pass() {
        let h = default_headers();
        let body = json!({"items": [{"score": 5}, {"score": 10}]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Each {
            negate: false,
            json_path: "$.items".into(),
            field_path: "score".into(),
            operator: FieldOperator::GreaterThan,
            value: Some("0".into()),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn each_pass_no_value() {
        let h = default_headers();
        let body = json!({"items": [true, true]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Each {
            negate: false,
            json_path: "$.items".into(),
            field_path: "".into(),
            operator: FieldOperator::IsTrue,
            value: None,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty(), "is_true needs no value; None should not override expectedValue");
    }

    #[test]
    fn each_fail() {
        let h = default_headers();
        let body = json!({"items": [{"score": 5}, {"score": -1}]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Each {
            negate: false,
            json_path: "$.items".into(),
            field_path: "score".into(),
            operator: FieldOperator::GreaterThan,
            value: Some("0".into()),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].actual.contains("1 of 2 failed"));
    }

    // ── containsSubset assertion ───────────────────────────────

    #[test]
    fn contains_subset_pass() {
        let h = default_headers();
        let body = json!({"data": {"a": 1, "b": 2, "c": 3}});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::ContainsSubset {
            negate: false,
            json_path: "$.data".into(),
            expected: r#"{"a": 1, "b": 2}"#.into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn contains_subset_fail() {
        let h = default_headers();
        let body = json!({"data": {"a": 1}});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::ContainsSubset {
            negate: false,
            json_path: "$.data".into(),
            expected: r#"{"a": 1, "b": 2}"#.into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
    }

    // ── bodySize assertion ─────────────────────────────────────

    #[test]
    fn body_size_pass() {
        let h = default_headers();
        let body = json!({});
        let raw = r#"{"key": "value"}"#;
        let ctx = make_ctx(200, 10.0, &h, &body, raw);
        let assertions = vec![Assertion::BodySize {
            negate: false,
            operator: ComparisonOperator::Lt,
            value: 1024.0,
            unit: SizeUnit::Bytes,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn body_size_fail() {
        let h = default_headers();
        let body = json!({});
        let raw = &"x".repeat(2000);
        let ctx = make_ctx(200, 10.0, &h, &body, raw);
        let assertions = vec![Assertion::BodySize {
            negate: false,
            operator: ComparisonOperator::Lt,
            value: 1.0,
            unit: SizeUnit::Kb,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
    }

    #[test]
    fn body_size_fallback_to_serialized() {
        let h = default_headers();
        let body = json!({"key": "value"});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::BodySize {
            negate: false,
            operator: ComparisonOperator::Gt,
            value: 0.0,
            unit: SizeUnit::Bytes,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn body_size_null_body_no_raw_is_zero_bytes() {
        let h = default_headers();
        let body = json!(null);
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::BodySize {
            negate: false,
            operator: ComparisonOperator::Eq,
            value: 0.0,
            unit: SizeUnit::Bytes,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty(), "JS: responseBody == null → empty string → 0 bytes");
    }

    // ── jsonSchema assertion ───────────────────────────────────

    #[test]
    fn json_schema_pass() {
        let h = default_headers();
        let body = json!({"name": "alice", "age": 30});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let schema = r#"{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"integer"}},"required":["name","age"]}"#;
        let assertions = vec![Assertion::JsonSchema {
            negate: false,
            schema: schema.into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn json_schema_fail() {
        let h = default_headers();
        let body = json!({"name": 42});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let schema = r#"{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}"#;
        let assertions = vec![Assertion::JsonSchema {
            negate: false,
            schema: schema.into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(!r.failures.is_empty());
        assert!(r.failures[0].path.contains("jsonSchema"));
    }

    // ── datePrecise assertion ──────────────────────────────────

    #[test]
    fn date_precise_pass() {
        let h = default_headers();
        let body = json!({"ts": "2024-06-15T12:30:45Z"});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::DatePrecise {
            negate: false,
            json_path: "$.ts".into(),
            operator: ComparisonOperator::Eq,
            reference: "2024-06-15T12:30:45Z".into(),
            precision: DatePrecision::Second,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    #[test]
    fn date_precise_fail() {
        let h = default_headers();
        let body = json!({"ts": "2024-06-15T12:30:45Z"});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::DatePrecise {
            negate: false,
            json_path: "$.ts".into(),
            operator: ComparisonOperator::Eq,
            reference: "2024-06-15T12:31:45Z".into(),
            precision: DatePrecision::Second,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
    }

    // ── negation ───────────────────────────────────────────────

    #[test]
    fn negated_status_inverts() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Status {
            negate: true,
            expected: "200".into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].expected.contains("NOT"));
    }

    #[test]
    fn negated_status_fail_becomes_pass() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(404, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Status {
            negate: true,
            expected: "200".into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    // ── custom assertion ───────────────────────────────────────

    #[test]
    fn custom_assertion_skipped() {
        let h = default_headers();
        let body = json!({});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Custom {
            negate: false,
            expression: "true".into(),
            description: None,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty());
    }

    // ── numeric with bool/null (JS Number() parity) ─────────

    #[test]
    fn numeric_bool_true_as_number_1() {
        let h = default_headers();
        let body = json!({"val": true});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Numeric {
            negate: false,
            json_path: "$.val".into(),
            operator: ComparisonOperator::Eq,
            value: 1.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty(), "JS Number(true) === 1");
    }

    #[test]
    fn numeric_null_as_number_0() {
        let h = default_headers();
        let body = json!({"val": null});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Numeric {
            negate: false,
            json_path: "$.val".into(),
            operator: ComparisonOperator::Eq,
            value: 0.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty(), "JS Number(null) === 0");
    }

    #[test]
    fn numeric_object_is_nan() {
        let h = default_headers();
        let body = json!({"val": {"a": 1}});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Numeric {
            negate: false,
            json_path: "$.val".into(),
            operator: ComparisonOperator::Eq,
            value: 0.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1, "JS Number({{}}) is NaN");
        assert!(r.failures[0].actual.contains("not a number"));
    }

    // ── each: non-array uses js typeof ─────────────────────────

    #[test]
    fn each_null_reports_js_typeof_object() {
        let h = default_headers();
        let body = json!({"items": null});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Each {
            negate: false,
            json_path: "$.items".into(),
            field_path: "".into(),
            operator: FieldOperator::Exists,
            value: None,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].actual.contains("object"), "JS typeof null === 'object'");
    }

    // ── regex truncation safety ────────────────────────────────

    #[test]
    fn regex_truncates_multibyte_safely() {
        let h = default_headers();
        let long_str: String = "é".repeat(250);
        let body = json!({"msg": long_str});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Regex {
            negate: false,
            json_path: "$.msg".into(),
            pattern: r"^NOMATCH$".into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].actual.ends_with('…'));
    }

    // ── datePrecise precision label ────────────────────────────

    #[test]
    fn date_precise_uses_lowercase_precision_label() {
        let h = default_headers();
        let body = json!({"ts": "2024-06-15T12:30:45Z"});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::DatePrecise {
            negate: false,
            json_path: "$.ts".into(),
            operator: ComparisonOperator::Eq,
            reference: "2024-06-15T12:31:45Z".into(),
            precision: DatePrecision::Second,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].expected.contains("precision: second"), "should be lowercase");
    }

    // ── each operator name format ──────────────────────────────

    #[test]
    fn each_operator_name_is_snake_case() {
        let h = default_headers();
        let body = json!({"items": [{"score": 5}, {"score": -1}]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Each {
            negate: false,
            json_path: "$.items".into(),
            field_path: "score".into(),
            operator: FieldOperator::GreaterThan,
            value: Some("0".into()),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].expected.contains("greater_than"), "should be snake_case, not GreaterThan");
    }

    // ── multiple assertions ────────────────────────────────────

    #[test]
    fn multiple_assertions_mixed() {
        let h = default_headers();
        let body = json!({"count": 5});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![
            Assertion::Status {
                negate: false,
                expected: "200".into(),
            },
            Assertion::Numeric {
                negate: false,
                json_path: "$.count".into(),
                operator: ComparisonOperator::Gt,
                value: 10.0,
            },
        ];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1);
        assert!(r.failures[0].path.contains("numeric"));
    }

    // ── val_to_f64 parity: JS Number() for arrays ──────────────

    #[test]
    fn numeric_empty_array_is_zero() {
        let h = default_headers();
        let body = json!({"val": []});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Numeric {
            negate: false,
            json_path: "$.val".into(),
            operator: ComparisonOperator::Eq,
            value: 0.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty(), "JS: Number([]) === 0");
    }

    #[test]
    fn numeric_single_element_array() {
        let h = default_headers();
        let body = json!({"val": [42]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Numeric {
            negate: false,
            json_path: "$.val".into(),
            operator: ComparisonOperator::Eq,
            value: 42.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(r.failures.is_empty(), "JS: Number([42]) === 42");
    }

    #[test]
    fn numeric_multi_element_array_is_nan() {
        let h = default_headers();
        let body = json!({"val": [1, 2]});
        let ctx = make_ctx(200, 10.0, &h, &body, "");
        let assertions = vec![Assertion::Numeric {
            negate: false,
            json_path: "$.val".into(),
            operator: ComparisonOperator::Eq,
            value: 0.0,
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert_eq!(r.failures.len(), 1, "JS: Number([1,2]) === NaN");
        assert!(r.failures[0].actual.contains("not a number"));
    }
}
