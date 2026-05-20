#[cfg(test)]
mod tests {
    use crate::assertion_evaluator::{compare, evaluate_assertions, format_op};
    use crate::assertion_evaluator_test_helpers::{default_headers, make_ctx};
    use crate::validation_types::*;
    use serde_json::json;

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
}
