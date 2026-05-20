#[cfg(test)]
mod tests {
    use crate::assertion_evaluator::evaluate_assertions;
    use crate::assertion_evaluator_test_helpers::{default_headers, make_ctx};
    use crate::validation_types::*;
    use serde_json::json;

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
        assert!(
            r.failures[0].expected.contains("precision: second"),
            "should be lowercase"
        );
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
}
