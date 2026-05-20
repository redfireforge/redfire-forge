#[cfg(test)]
mod tests {
    use crate::http_helpers::{
        evaluate_header_op, find_header, get_json_type_name, matches_status_pattern,
    };
    use crate::validation_types::JsonTypeName;
    use serde_json::json;
    use std::collections::HashMap;

    // ── matchesStatusPattern ───────────────────────────────

    #[test]
    fn exact_match() {
        assert!(matches_status_pattern(200, "200"));
        assert!(!matches_status_pattern(201, "200"));
    }

    #[test]
    fn exact_match_with_whitespace() {
        assert!(matches_status_pattern(404, "  404  "));
    }

    #[test]
    fn range_match() {
        assert!(matches_status_pattern(200, "200-299"));
        assert!(matches_status_pattern(250, "200-299"));
        assert!(matches_status_pattern(299, "200-299"));
        assert!(!matches_status_pattern(300, "200-299"));
    }

    #[test]
    fn range_with_spaces() {
        assert!(matches_status_pattern(404, "400 - 499"));
    }

    #[test]
    fn class_match() {
        assert!(matches_status_pattern(200, "2xx"));
        assert!(matches_status_pattern(204, "2xx"));
        assert!(!matches_status_pattern(301, "2xx"));
    }

    #[test]
    fn class_case_insensitive() {
        assert!(matches_status_pattern(200, "2XX"));
        assert!(matches_status_pattern(200, "2Xx"));
    }

    #[test]
    fn comma_separated() {
        assert!(matches_status_pattern(200, "200,201,204"));
        assert!(matches_status_pattern(204, "200,201,204"));
        assert!(!matches_status_pattern(202, "200,201,204"));
    }

    #[test]
    fn comma_with_classes_and_ranges() {
        assert!(matches_status_pattern(200, "2xx,404"));
        assert!(matches_status_pattern(404, "2xx,404"));
        assert!(!matches_status_pattern(500, "2xx,404"));
    }

    #[test]
    fn invalid_pattern_returns_false() {
        assert!(!matches_status_pattern(200, "abc"));
    }

    #[test]
    fn leading_hyphen_not_treated_as_range() {
        // JS regex /^\d+\s*-\s*\d+$/ requires at least one digit before `-`
        assert!(!matches_status_pattern(100, "-200"));
    }

    #[test]
    fn trailing_hyphen_not_treated_as_range() {
        assert!(!matches_status_pattern(200, "200-"));
    }

    #[test]
    fn empty_pattern() {
        assert!(!matches_status_pattern(200, ""));
        assert!(!matches_status_pattern(200, "  "));
    }

    #[test]
    fn overflow_pattern_does_not_false_positive() {
        // "99999" > u16::MAX (65535), must not silently match status 0
        assert!(!matches_status_pattern(0, "99999"));
        assert!(!matches_status_pattern(200, "99999"));
    }

    #[test]
    fn large_range_boundary() {
        // Range with hi > u16 max — 200 is within [200, 99999]
        assert!(matches_status_pattern(200, "200-99999"));
        assert!(matches_status_pattern(200, "100-99999"));
        assert!(!matches_status_pattern(99, "100-99999"));
    }

    // ── getJsonTypeName ────────────────────────────────────

    #[test]
    fn json_type_null() {
        assert_eq!(get_json_type_name(&json!(null)), JsonTypeName::Null);
    }

    #[test]
    fn json_type_string() {
        assert_eq!(get_json_type_name(&json!("hello")), JsonTypeName::String);
    }

    #[test]
    fn json_type_number() {
        assert_eq!(get_json_type_name(&json!(42)), JsonTypeName::Number);
    }

    #[test]
    fn json_type_boolean() {
        assert_eq!(get_json_type_name(&json!(true)), JsonTypeName::Boolean);
    }

    #[test]
    fn json_type_array() {
        assert_eq!(get_json_type_name(&json!([1, 2])), JsonTypeName::Array);
    }

    #[test]
    fn json_type_object() {
        assert_eq!(get_json_type_name(&json!({"a": 1})), JsonTypeName::Object);
    }

    // ── findHeader ─────────────────────────────────────────

    fn headers(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn find_header_exact() {
        let h = headers(&[("Content-Type", "application/json")]);
        assert_eq!(find_header(&h, "Content-Type"), Some("application/json"));
    }

    #[test]
    fn find_header_case_insensitive() {
        let h = headers(&[("Content-Type", "text/html")]);
        assert_eq!(find_header(&h, "content-type"), Some("text/html"));
        assert_eq!(find_header(&h, "CONTENT-TYPE"), Some("text/html"));
    }

    #[test]
    fn find_header_missing() {
        let h = headers(&[("X-Custom", "val")]);
        assert_eq!(find_header(&h, "Authorization"), None);
    }

    // ── evaluateHeaderOp ───────────────────────────────────

    #[test]
    fn header_op_exists_present() {
        let r = evaluate_header_op(Some("val"), "exists", None);
        assert!(r.pass);
        assert_eq!(r.expected, "header exists");
    }

    #[test]
    fn header_op_exists_missing() {
        let r = evaluate_header_op(None, "exists", None);
        assert!(!r.pass);
        assert_eq!(r.actual, "(not present)");
    }

    #[test]
    fn header_op_equals_match() {
        let r = evaluate_header_op(Some("application/json"), "equals", Some("application/json"));
        assert!(r.pass);
    }

    #[test]
    fn header_op_equals_no_match() {
        let r = evaluate_header_op(Some("text/html"), "equals", Some("application/json"));
        assert!(!r.pass);
    }

    #[test]
    fn header_op_equals_missing_header() {
        let r = evaluate_header_op(None, "equals", Some("application/json"));
        assert!(!r.pass);
    }

    #[test]
    fn header_op_contains_match() {
        let r = evaluate_header_op(Some("application/json; charset=utf-8"), "contains", Some("json"));
        assert!(r.pass);
    }

    #[test]
    fn header_op_contains_no_match() {
        let r = evaluate_header_op(Some("text/html"), "contains", Some("json"));
        assert!(!r.pass);
    }

    #[test]
    fn header_op_contains_missing_header() {
        let r = evaluate_header_op(None, "contains", Some("json"));
        assert!(!r.pass);
    }

    #[test]
    fn header_op_regex_match() {
        let r = evaluate_header_op(Some("application/json"), "regex", Some("json$"));
        assert!(r.pass);
    }

    #[test]
    fn header_op_regex_no_match() {
        let r = evaluate_header_op(Some("text/html"), "regex", Some("json$"));
        assert!(!r.pass);
    }

    #[test]
    fn header_op_regex_missing_header() {
        let r = evaluate_header_op(None, "regex", Some(".*"));
        assert!(!r.pass);
    }

    #[test]
    fn header_op_regex_invalid_pattern() {
        let r = evaluate_header_op(Some("val"), "regex", Some("[invalid"));
        assert!(!r.pass);
        assert_eq!(r.actual, "invalid regex pattern");
    }

    #[test]
    fn header_op_unknown_operator() {
        let r = evaluate_header_op(Some("val"), "startsWith", None);
        assert!(!r.pass);
        assert_eq!(r.actual, "unknown operator");
    }

    #[test]
    fn header_op_equals_with_none_expected() {
        let r = evaluate_header_op(None, "equals", None);
        assert!(r.pass);
    }

    #[test]
    fn header_op_contains_none_expected() {
        let r = evaluate_header_op(Some("abc"), "contains", None);
        assert!(r.pass); // "abc".contains("") == true
    }
}
