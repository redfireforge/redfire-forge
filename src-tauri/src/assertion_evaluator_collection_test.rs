#[cfg(test)]
mod tests {
    use crate::assertion_evaluator::evaluate_assertions;
    use crate::assertion_evaluator_test_helpers::{default_headers, make_ctx};
    use crate::validation_types::*;
    use serde_json::json;

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
        assert!(
            r.failures[0].actual.contains("string"),
            "JS typeof string is 'string'"
        );
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
        assert!(
            r.failures[0].actual.contains("object"),
            "JS typeof null === 'object'"
        );
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
        assert!(
            r.failures.is_empty(),
            "is_true needs no value; None should not override expectedValue"
        );
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
        assert!(
            r.failures[0].actual.contains("object"),
            "JS typeof null === 'object'"
        );
    }

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
        assert!(
            r.failures[0].expected.contains("greater_than"),
            "should be snake_case, not GreaterThan"
        );
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
        assert!(
            r.failures.is_empty(),
            "JS: responseBody == null → empty string → 0 bytes"
        );
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
        let schema =
            r#"{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}"#;
        let assertions = vec![Assertion::JsonSchema {
            negate: false,
            schema: schema.into(),
        }];
        let r = evaluate_assertions(&assertions, &ctx);
        assert!(!r.failures.is_empty());
        assert!(r.failures[0].path.contains("jsonSchema"));
    }
}
