#[cfg(test)]
mod tests {
    use crate::assertion_evaluator::evaluate_assertions;
    use crate::assertion_evaluator_test_helpers::{default_headers, make_ctx};
    use crate::validation_types::*;
    use serde_json::json;

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
}
