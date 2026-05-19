#[cfg(test)]
mod tests {
    use crate::subset_match::deep_subset_match;
    use serde_json::json;

    // ── Port of JS validatorSubsetMatch.test.ts ────────────

    #[test]
    fn null_expected_and_actual() {
        assert!(deep_subset_match(&json!(null), &json!(null), "").matched);
    }

    #[test]
    fn null_expected_non_null_actual() {
        let r = deep_subset_match(&json!({"x": 1}), &json!(null), "");
        assert!(!r.matched);
        assert_eq!(r.path.as_deref(), Some("(root)"));
        assert_eq!(r.expected.as_deref(), Some("null"));
    }

    #[test]
    fn expected_array_actual_not_array() {
        let r = deep_subset_match(&json!({"not": "array"}), &json!([1]), "");
        assert!(!r.matched);
        assert_eq!(r.expected.as_deref(), Some("array"));
        assert_eq!(r.actual.as_deref(), Some("object"));
    }

    #[test]
    fn array_index_path_when_missing() {
        let r = deep_subset_match(&json!([{"a": 1}]), &json!([{"b": 2}]), "");
        assert!(!r.matched);
        assert_eq!(r.path.as_deref(), Some("[0]"));
    }

    #[test]
    fn object_expected_actual_null() {
        let r = deep_subset_match(&json!(null), &json!({"k": 1}), "");
        assert!(!r.matched);
        assert_eq!(r.expected.as_deref(), Some("object"));
        assert_eq!(r.actual.as_deref(), Some("null"));
    }

    #[test]
    fn object_expected_actual_array_no_match() {
        let r = deep_subset_match(&json!([1, 2]), &json!({"k": 1}), "");
        assert!(!r.matched);
        assert_eq!(r.actual.as_deref(), Some("no matching element in array"));
    }

    #[test]
    fn object_expected_actual_array_with_match() {
        let r = deep_subset_match(
            &json!([{"k": 1, "extra": "a"}, {"k": 2}]),
            &json!({"k": 1}),
            "",
        );
        assert!(r.matched);
    }

    #[test]
    fn object_expected_actual_array_no_element_matches() {
        let r = deep_subset_match(
            &json!([{"k": 2}, {"k": 3}]),
            &json!({"k": 1}),
            "",
        );
        assert!(!r.matched);
    }

    #[test]
    fn object_expected_actual_primitive() {
        let r = deep_subset_match(&json!("str"), &json!({"k": 1}), "");
        assert!(!r.matched);
        assert_eq!(r.actual.as_deref(), Some("string"));
    }

    #[test]
    fn nested_path_missing_key() {
        let r = deep_subset_match(
            &json!({"outer": {"a": 1}}),
            &json!({"outer": {"a": 1, "b": 2}}),
            "",
        );
        assert!(!r.matched);
        assert_eq!(r.path.as_deref(), Some("outer.b"));
        assert_eq!(r.actual.as_deref(), Some("missing key"));
    }

    #[test]
    fn nested_mismatch_propagates() {
        let r = deep_subset_match(
            &json!({"outer": {"inner": {"x": 1}}}),
            &json!({"outer": {"inner": {"x": 2}}}),
            "",
        );
        assert!(!r.matched);
        assert_eq!(r.path.as_deref(), Some("outer.inner.x"));
    }

    #[test]
    fn array_fully_satisfied() {
        assert!(deep_subset_match(&json!([1, 2, 3]), &json!([2, 1]), "").matched);
    }

    #[test]
    fn object_keys_satisfied() {
        assert!(deep_subset_match(
            &json!({"a": 1, "b": {"c": 2}}),
            &json!({"a": 1, "b": {"c": 2}}),
            "",
        ).matched);
    }

    #[test]
    fn bare_key_path_at_root() {
        let r = deep_subset_match(&json!({}), &json!({"missing": true}), "");
        assert!(!r.matched);
        assert_eq!(r.path.as_deref(), Some("missing"));
    }

    #[test]
    fn primitive_mismatch_at_root() {
        let r = deep_subset_match(&json!(2), &json!(3), "");
        assert!(!r.matched);
        assert_eq!(r.path.as_deref(), Some("(root)"));
    }

    // ── Additional edge cases ──────────────────────────────

    #[test]
    fn empty_expected_object_matches_any_object() {
        assert!(deep_subset_match(&json!({"a": 1}), &json!({}), "").matched);
    }

    #[test]
    fn empty_expected_object_fails_against_primitive() {
        let r = deep_subset_match(&json!(42), &json!({}), "");
        assert!(!r.matched);
        assert_eq!(r.actual.as_deref(), Some("number"));
    }

    #[test]
    fn empty_expected_array_always_matches() {
        assert!(deep_subset_match(&json!([1, 2]), &json!([]), "").matched);
    }

    #[test]
    fn nested_array_subset() {
        let actual = json!({"items": [{"id": 1, "name": "a"}, {"id": 2, "name": "b"}]});
        let expected = json!({"items": [{"id": 2}]});
        assert!(deep_subset_match(&actual, &expected, "").matched);
    }

    #[test]
    fn primitive_equality() {
        assert!(deep_subset_match(&json!(42), &json!(42), "").matched);
        assert!(deep_subset_match(&json!("hello"), &json!("hello"), "").matched);
        assert!(deep_subset_match(&json!(true), &json!(true), "").matched);
    }
}
