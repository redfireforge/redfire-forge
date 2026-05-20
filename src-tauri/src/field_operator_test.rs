#[cfg(test)]
mod tests {
    use crate::field_operator::{evaluate_field_operator, stringify, to_number, FieldEvalResult};
    use crate::validation_types::FieldOperator;
    use serde_json::{json, Value};

    fn eval(val: Option<&Value>, op: FieldOperator, ov: Option<&str>, ev: &str) -> FieldEvalResult {
        evaluate_field_operator(val, &op, ov, ev)
    }

    // ── to_number ────────────────────────────────────────────────

    #[test]
    fn to_number_from_json_number() {
        assert_eq!(to_number(&json!(42)), Some(42.0));
        assert_eq!(to_number(&json!(3.14)), Some(3.14));
    }

    #[test]
    fn to_number_from_string() {
        assert_eq!(to_number(&json!("3.14")), Some(3.14));
        assert_eq!(to_number(&json!("42")), Some(42.0));
    }

    #[test]
    fn to_number_empty_string() {
        assert_eq!(to_number(&json!("")), None);
        assert_eq!(to_number(&json!("  ")), None);
    }

    #[test]
    fn to_number_non_numeric_string() {
        assert_eq!(to_number(&json!("abc")), None);
    }

    #[test]
    fn to_number_bool_and_null() {
        assert_eq!(to_number(&json!(true)), None);
        assert_eq!(to_number(&json!(null)), None);
    }

    // ── stringify ────────────────────────────────────────────────

    #[test]
    fn stringify_string_returns_raw() {
        assert_eq!(stringify(&json!("hello")), "hello");
    }

    #[test]
    fn stringify_number() {
        assert_eq!(stringify(&json!(42)), "42");
    }

    #[test]
    fn stringify_null() {
        assert_eq!(stringify(&json!(null)), "null");
    }

    #[test]
    fn stringify_bool() {
        assert_eq!(stringify(&json!(true)), "true");
    }

    #[test]
    fn stringify_array() {
        assert_eq!(stringify(&json!([1, 2])), "[1,2]");
    }

    // ── equals ──────────────────────────────────────────────────

    #[test]
    fn equals_string_match() {
        let v = json!("hello");
        let r = eval(Some(&v), FieldOperator::Equals, None, "hello");
        assert!(r.pass);
        assert_eq!(r.expected, "equals hello");
    }

    #[test]
    fn equals_string_mismatch() {
        let v = json!("hello");
        let r = eval(Some(&v), FieldOperator::Equals, None, "world");
        assert!(!r.pass);
    }

    #[test]
    fn equals_number_match() {
        let v = json!(42);
        let r = eval(Some(&v), FieldOperator::Equals, None, "42");
        assert!(r.pass);
    }

    #[test]
    fn equals_json_object_match() {
        let v = json!({"a": 1});
        let r = eval(Some(&v), FieldOperator::Equals, None, r#"{"a":1}"#);
        assert!(r.pass);
    }

    #[test]
    fn equals_uses_operator_value() {
        let v = json!("hello");
        let r = eval(Some(&v), FieldOperator::Equals, Some("hello"), "ignored");
        assert!(r.pass);
    }

    // ── not_equals ──────────────────────────────────────────────

    #[test]
    fn not_equals_different_values() {
        let v = json!("hello");
        let r = eval(Some(&v), FieldOperator::NotEquals, None, "world");
        assert!(r.pass);
        assert_eq!(r.expected, "not equals world");
    }

    #[test]
    fn not_equals_same_values() {
        let v = json!("hello");
        let r = eval(Some(&v), FieldOperator::NotEquals, None, "hello");
        assert!(!r.pass);
    }

    // ── greater_than ────────────────────────────────────────────

    #[test]
    fn greater_than_pass() {
        let v = json!(5);
        let r = eval(Some(&v), FieldOperator::GreaterThan, None, "3");
        assert!(r.pass);
        assert_eq!(r.expected, "> 3");
        assert_eq!(r.actual, "5");
    }

    #[test]
    fn greater_than_fail() {
        let v = json!(3);
        let r = eval(Some(&v), FieldOperator::GreaterThan, None, "5");
        assert!(!r.pass);
    }

    #[test]
    fn greater_than_equal_fails() {
        let v = json!(5);
        let r = eval(Some(&v), FieldOperator::GreaterThan, None, "5");
        assert!(!r.pass);
    }

    #[test]
    fn greater_than_non_numeric() {
        let v = json!("abc");
        let r = eval(Some(&v), FieldOperator::GreaterThan, None, "5");
        assert!(!r.pass);
        assert_eq!(r.expected, "> 5");
    }

    #[test]
    fn greater_than_string_numeric() {
        let v = json!("10");
        let r = eval(Some(&v), FieldOperator::GreaterThan, None, "5");
        assert!(r.pass);
    }

    // ── greater_than_or_equal ───────────────────────────────────

    #[test]
    fn gte_equal_values() {
        let v = json!(5);
        let r = eval(Some(&v), FieldOperator::GreaterThanOrEqual, None, "5");
        assert!(r.pass);
    }

    // ── less_than ───────────────────────────────────────────────

    #[test]
    fn less_than_pass() {
        let v = json!(3);
        let r = eval(Some(&v), FieldOperator::LessThan, None, "5");
        assert!(r.pass);
    }

    // ── less_than_or_equal ──────────────────────────────────────

    #[test]
    fn lte_equal_values() {
        let v = json!(5);
        let r = eval(Some(&v), FieldOperator::LessThanOrEqual, None, "5");
        assert!(r.pass);
    }

    // ── contains ────────────────────────────────────────────────

    #[test]
    fn contains_pass() {
        let v = json!("hello world");
        let r = eval(Some(&v), FieldOperator::Contains, None, "world");
        assert!(r.pass);
        assert_eq!(r.expected, "contains \"world\"");
    }

    #[test]
    fn contains_fail() {
        let v = json!("hello");
        let r = eval(Some(&v), FieldOperator::Contains, None, "xyz");
        assert!(!r.pass);
    }

    #[test]
    fn contains_non_string_actual() {
        let v = json!({"key": "value"});
        let r = eval(Some(&v), FieldOperator::Contains, None, "key");
        assert!(r.pass);
    }

    // ── not_contains ────────────────────────────────────────────

    #[test]
    fn not_contains_pass() {
        let v = json!("hello");
        let r = eval(Some(&v), FieldOperator::NotContains, None, "xyz");
        assert!(r.pass);
    }

    // ── starts_with ─────────────────────────────────────────────

    #[test]
    fn starts_with_pass() {
        let v = json!("hello world");
        let r = eval(Some(&v), FieldOperator::StartsWith, None, "hello");
        assert!(r.pass);
    }

    #[test]
    fn starts_with_non_string() {
        let v = json!([1, 2]);
        let r = eval(Some(&v), FieldOperator::StartsWith, None, "[1");
        assert!(r.pass);
    }

    // ── ends_with ───────────────────────────────────────────────

    #[test]
    fn ends_with_pass() {
        let v = json!("hello world");
        let r = eval(Some(&v), FieldOperator::EndsWith, None, "world");
        assert!(r.pass);
    }

    // ── regex ───────────────────────────────────────────────────

    #[test]
    fn regex_match() {
        let v = json!("hello123");
        let r = eval(Some(&v), FieldOperator::Regex, None, r"\d+");
        assert!(r.pass);
        assert_eq!(r.expected, r"matches /\d+/");
    }

    #[test]
    fn regex_no_match() {
        let v = json!("hello");
        let r = eval(Some(&v), FieldOperator::Regex, None, r"^\d+$");
        assert!(!r.pass);
    }

    #[test]
    fn regex_empty_pattern() {
        let v = json!("hello");
        let r = eval(Some(&v), FieldOperator::Regex, None, "");
        assert!(!r.pass);
        assert_eq!(r.actual, "empty pattern");
    }

    #[test]
    fn regex_invalid_pattern() {
        let v = json!("hello");
        let r = eval(Some(&v), FieldOperator::Regex, None, "[invalid");
        assert!(!r.pass);
        assert_eq!(r.actual, "invalid regex pattern");
    }

    #[test]
    fn regex_non_string_actual() {
        let v = json!(42);
        let r = eval(Some(&v), FieldOperator::Regex, None, "42");
        assert!(r.pass);
    }

    // ── is_true ─────────────────────────────────────────────────

    #[test]
    fn is_true_bool() {
        let v = json!(true);
        assert!(eval(Some(&v), FieldOperator::IsTrue, None, "").pass);
    }

    #[test]
    fn is_true_string() {
        let v = json!("true");
        assert!(eval(Some(&v), FieldOperator::IsTrue, None, "").pass);
    }

    #[test]
    fn is_true_case_sensitive() {
        let v = json!("True");
        assert!(!eval(Some(&v), FieldOperator::IsTrue, None, "").pass);
    }

    #[test]
    fn is_true_number_not_matched() {
        let v = json!(1);
        assert!(!eval(Some(&v), FieldOperator::IsTrue, None, "").pass);
    }

    // ── is_false ────────────────────────────────────────────────

    #[test]
    fn is_false_bool() {
        let v = json!(false);
        assert!(eval(Some(&v), FieldOperator::IsFalse, None, "").pass);
    }

    #[test]
    fn is_false_string() {
        let v = json!("false");
        assert!(eval(Some(&v), FieldOperator::IsFalse, None, "").pass);
    }

    #[test]
    fn is_false_case_sensitive() {
        let v = json!("False");
        assert!(!eval(Some(&v), FieldOperator::IsFalse, None, "").pass);
    }

    #[test]
    fn is_false_zero_not_matched() {
        let v = json!(0);
        assert!(!eval(Some(&v), FieldOperator::IsFalse, None, "").pass);
    }

    // ── is_null ─────────────────────────────────────────────────

    #[test]
    fn is_null_pass() {
        let v = json!(null);
        assert!(eval(Some(&v), FieldOperator::IsNull, None, "").pass);
    }

    #[test]
    fn is_null_non_null() {
        let v = json!(42);
        assert!(!eval(Some(&v), FieldOperator::IsNull, None, "").pass);
    }

    // ── is_not_null ─────────────────────────────────────────────

    #[test]
    fn is_not_null_pass() {
        let v = json!(42);
        assert!(eval(Some(&v), FieldOperator::IsNotNull, None, "").pass);
    }

    #[test]
    fn is_not_null_null() {
        let v = json!(null);
        assert!(!eval(Some(&v), FieldOperator::IsNotNull, None, "").pass);
    }

    #[test]
    fn is_not_null_undefined() {
        assert!(!eval(None, FieldOperator::IsNotNull, None, "").pass);
    }

    // ── exists ──────────────────────────────────────────────────

    #[test]
    fn exists_with_null_value() {
        let v = json!(null);
        assert!(eval(Some(&v), FieldOperator::Exists, None, "").pass);
    }

    #[test]
    fn exists_with_value() {
        let v = json!(42);
        assert!(eval(Some(&v), FieldOperator::Exists, None, "").pass);
    }

    #[test]
    fn exists_undefined() {
        assert!(!eval(None, FieldOperator::Exists, None, "").pass);
    }

    // ── not_exists ──────────────────────────────────────────────

    #[test]
    fn not_exists_undefined() {
        assert!(eval(None, FieldOperator::NotExists, None, "").pass);
    }

    #[test]
    fn not_exists_null_fails() {
        let v = json!(null);
        assert!(!eval(Some(&v), FieldOperator::NotExists, None, "").pass);
    }

    // ── is_empty ────────────────────────────────────────────────

    #[test]
    fn is_empty_empty_string() {
        let v = json!("");
        assert!(eval(Some(&v), FieldOperator::IsEmpty, None, "").pass);
    }

    #[test]
    fn is_empty_null() {
        let v = json!(null);
        assert!(eval(Some(&v), FieldOperator::IsEmpty, None, "").pass);
    }

    #[test]
    fn is_empty_undefined() {
        assert!(eval(None, FieldOperator::IsEmpty, None, "").pass);
    }

    #[test]
    fn is_empty_empty_array() {
        let v = json!([]);
        assert!(eval(Some(&v), FieldOperator::IsEmpty, None, "").pass);
    }

    #[test]
    fn is_empty_empty_object() {
        let v = json!({});
        assert!(eval(Some(&v), FieldOperator::IsEmpty, None, "").pass);
    }

    #[test]
    fn is_empty_non_empty_string() {
        let v = json!("hello");
        assert!(!eval(Some(&v), FieldOperator::IsEmpty, None, "").pass);
    }

    #[test]
    fn is_empty_non_empty_array() {
        let v = json!([1, 2]);
        assert!(!eval(Some(&v), FieldOperator::IsEmpty, None, "").pass);
    }

    // ── is_not_empty ────────────────────────────────────────────

    #[test]
    fn is_not_empty_non_empty_string() {
        let v = json!("hello");
        assert!(eval(Some(&v), FieldOperator::IsNotEmpty, None, "").pass);
    }

    #[test]
    fn is_not_empty_empty_string() {
        let v = json!("");
        assert!(!eval(Some(&v), FieldOperator::IsNotEmpty, None, "").pass);
    }

    // ── is_type ─────────────────────────────────────────────────

    #[test]
    fn is_type_string() {
        let v = json!("hello");
        let r = eval(Some(&v), FieldOperator::IsType, Some("string"), "");
        assert!(r.pass);
        assert_eq!(r.actual, "type: string");
    }

    #[test]
    fn is_type_array() {
        let v = json!([1]);
        let r = eval(Some(&v), FieldOperator::IsType, Some("array"), "");
        assert!(r.pass);
    }

    #[test]
    fn is_type_case_insensitive() {
        let v = json!("hello");
        assert!(eval(Some(&v), FieldOperator::IsType, Some("STRING"), "").pass);
    }

    #[test]
    fn is_type_mismatch() {
        let v = json!(42);
        let r = eval(Some(&v), FieldOperator::IsType, Some("string"), "");
        assert!(!r.pass);
        assert_eq!(r.actual, "type: number");
    }

    #[test]
    fn is_type_null() {
        let v = json!(null);
        assert!(eval(Some(&v), FieldOperator::IsType, Some("null"), "").pass);
    }

    // ── in ──────────────────────────────────────────────────────

    #[test]
    fn in_json_array() {
        let v = json!(2);
        let r = eval(Some(&v), FieldOperator::In, Some("[1, 2, 3]"), "");
        assert!(r.pass);
    }

    #[test]
    fn in_not_found() {
        let v = json!(4);
        let r = eval(Some(&v), FieldOperator::In, Some("[1, 2, 3]"), "");
        assert!(!r.pass);
    }

    #[test]
    fn in_comma_separated() {
        let v = json!("b");
        let r = eval(Some(&v), FieldOperator::In, Some("a, b, c"), "");
        assert!(r.pass);
    }

    #[test]
    fn in_uses_json_stringify_equality() {
        let v = json!("1");
        let r = eval(Some(&v), FieldOperator::In, Some("[1, 2, 3]"), "");
        assert!(!r.pass);
    }

    // ── not_in ──────────────────────────────────────────────────

    #[test]
    fn not_in_pass() {
        let v = json!(4);
        let r = eval(Some(&v), FieldOperator::NotIn, Some("[1, 2, 3]"), "");
        assert!(r.pass);
    }

    #[test]
    fn not_in_fail() {
        let v = json!(2);
        let r = eval(Some(&v), FieldOperator::NotIn, Some("[1, 2, 3]"), "");
        assert!(!r.pass);
    }

    // ── between ─────────────────────────────────────────────────

    #[test]
    fn between_in_range() {
        let v = json!(5);
        let r = eval(Some(&v), FieldOperator::Between, Some("1,10"), "");
        assert!(r.pass);
        assert_eq!(r.expected, "between 1 and 10");
    }

    #[test]
    fn between_boundary_inclusive() {
        let v = json!(1);
        assert!(eval(Some(&v), FieldOperator::Between, Some("1,10"), "").pass);
        let v2 = json!(10);
        assert!(eval(Some(&v2), FieldOperator::Between, Some("1,10"), "").pass);
    }

    #[test]
    fn between_out_of_range() {
        let v = json!(0);
        assert!(!eval(Some(&v), FieldOperator::Between, Some("1,10"), "").pass);
    }

    #[test]
    fn between_whitespace_separated() {
        let v = json!(5);
        assert!(eval(Some(&v), FieldOperator::Between, Some("1 10"), "").pass);
    }

    #[test]
    fn between_non_numeric() {
        let v = json!("abc");
        assert!(!eval(Some(&v), FieldOperator::Between, Some("1,10"), "").pass);
    }

    // ── close_to ────────────────────────────────────────────────

    #[test]
    fn close_to_within_tolerance() {
        let v = json!(5.005);
        let r = eval(Some(&v), FieldOperator::CloseTo, Some("5,0.01"), "");
        assert!(r.pass);
        assert_eq!(r.expected, "close to 5 ±0.01");
    }

    #[test]
    fn close_to_outside_tolerance() {
        let v = json!(5.02);
        assert!(!eval(Some(&v), FieldOperator::CloseTo, Some("5,0.01"), "").pass);
    }

    #[test]
    fn close_to_default_tolerance() {
        let v = json!(5.005);
        let r = eval(Some(&v), FieldOperator::CloseTo, Some("5"), "");
        assert!(r.pass);
        assert_eq!(r.expected, "close to 5 ±0.01");
    }

    #[test]
    fn close_to_non_numeric() {
        let v = json!("abc");
        assert!(!eval(Some(&v), FieldOperator::CloseTo, Some("5,0.01"), "").pass);
    }

    // ── undefined (None) edge cases ─────────────────────────────

    #[test]
    fn equals_undefined_actual() {
        let r = eval(None, FieldOperator::Equals, None, "hello");
        assert!(!r.pass);
        assert_eq!(r.actual, "undefined");
    }

    #[test]
    fn not_equals_undefined_actual() {
        let r = eval(None, FieldOperator::NotEquals, None, "hello");
        assert!(r.pass);
        assert_eq!(r.actual, "undefined");
    }

    #[test]
    fn in_undefined_always_false() {
        let r = eval(None, FieldOperator::In, Some("[null, 1, 2]"), "");
        assert!(!r.pass, "JS: undefined is never `in` any list");
    }

    #[test]
    fn not_in_undefined_always_true() {
        let r = eval(None, FieldOperator::NotIn, Some("[null, 1, 2]"), "");
        assert!(r.pass, "JS: undefined is always `not_in` any list");
    }

    #[test]
    fn is_null_undefined_false() {
        let r = eval(None, FieldOperator::IsNull, None, "");
        assert!(!r.pass, "JS: is_null fails for undefined");
    }

    #[test]
    fn contains_undefined_uses_empty_string() {
        let r = eval(None, FieldOperator::Contains, None, "null");
        assert!(!r.pass, "JS: undefined → '' for string ops, so ''.includes('null') is false");
    }

    #[test]
    fn starts_with_undefined_uses_empty_string() {
        let r = eval(None, FieldOperator::StartsWith, None, "n");
        assert!(!r.pass, "JS: undefined → '' for string ops");
    }

    #[test]
    fn regex_undefined_uses_empty_string() {
        let r = eval(None, FieldOperator::Regex, None, "null");
        assert!(!r.pass, "JS: undefined → '' for string ops, so 'null' regex doesn't match ''");
    }

    #[test]
    fn is_type_undefined_actual() {
        let r = eval(None, FieldOperator::IsType, Some("undefined"), "");
        assert!(r.pass, "JS: typeof undefined === 'undefined'");
        assert_eq!(r.actual, "type: undefined");
    }

    #[test]
    fn is_type_undefined_vs_null() {
        let r = eval(None, FieldOperator::IsType, Some("null"), "");
        assert!(!r.pass, "JS: typeof undefined !== 'null'");
    }

    #[test]
    fn close_to_nan_tolerance_always_fails() {
        let r = eval(Some(&json!(10.0)), FieldOperator::CloseTo, Some("10,abc"), "");
        assert!(!r.pass, "JS: NaN tolerance makes comparison always fail");
        assert!(r.expected.contains("NaN"), "expected should mention NaN tolerance");
    }

    #[test]
    fn close_to_nan_tolerance_no_parts() {
        let r = eval(Some(&json!(10.0)), FieldOperator::CloseTo, Some("10"), "");
        assert!(r.pass, "default tolerance 0.01 — exact match passes");
    }

    #[test]
    fn to_number_nan_string_returns_none() {
        let r = eval(Some(&json!("NaN")), FieldOperator::GreaterThan, Some("0"), "");
        assert!(!r.pass, "JS: toNumber('NaN') returns null → fail");
        assert_eq!(r.actual, "NaN", "actual display should show NaN");
    }

    #[test]
    fn to_number_infinity_string_returns_value() {
        let r = eval(Some(&json!("Infinity")), FieldOperator::GreaterThan, Some("0"), "");
        assert!(r.pass, "JS: toNumber('Infinity') returns Infinity > 0 → true");
    }
}
