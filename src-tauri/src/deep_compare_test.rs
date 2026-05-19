#[cfg(test)]
mod tests {
    use crate::deep_compare::deep_compare;
    use crate::validation_types::FailureDetail;
    use serde_json::json;

    fn run(expected: serde_json::Value, actual: serde_json::Value) -> Vec<FailureDetail> {
        let mut f = Vec::new();
        deep_compare(&expected, &actual, "", &mut f);
        f
    }

    #[test]
    fn identical_objects() {
        let f = run(json!({"a": 1, "b": "two"}), json!({"a": 1, "b": "two"}));
        assert!(f.is_empty());
    }

    #[test]
    fn identical_arrays() {
        let f = run(json!([1, 2, 3]), json!([1, 2, 3]));
        assert!(f.is_empty());
    }

    #[test]
    fn identical_primitives() {
        assert!(run(json!(42), json!(42)).is_empty());
        assert!(run(json!("hello"), json!("hello")).is_empty());
        assert!(run(json!(true), json!(true)).is_empty());
        assert!(run(json!(null), json!(null)).is_empty());
    }

    #[test]
    fn root_primitive_mismatch() {
        let f = run(json!(1), json!(2));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "(root)");
        assert_eq!(f[0].expected, "1");
        assert_eq!(f[0].actual, "2");
    }

    #[test]
    fn root_type_mismatch() {
        let f = run(json!("hello"), json!(42));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "(root)");
    }

    #[test]
    fn null_vs_value() {
        let f = run(json!(null), json!(1));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "(root)");
        assert_eq!(f[0].expected, "null");
        assert_eq!(f[0].actual, "1");
    }

    #[test]
    fn value_vs_null() {
        let f = run(json!({"a": 1}), json!(null));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "(root)");
    }

    #[test]
    fn nested_object_mismatch() {
        let f = run(json!({"a": {"b": 1}}), json!({"a": {"b": 2}}));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "a.b");
        assert_eq!(f[0].expected, "1");
        assert_eq!(f[0].actual, "2");
    }

    #[test]
    fn extra_key_in_actual() {
        let f = run(json!({"a": 1}), json!({"a": 1, "b": 2}));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "b");
        assert_eq!(f[0].expected, "null");
        assert_eq!(f[0].actual, "2");
    }

    #[test]
    fn missing_key_in_actual() {
        let f = run(json!({"a": 1, "b": 2}), json!({"a": 1}));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "b");
        assert_eq!(f[0].expected, "2");
        assert_eq!(f[0].actual, "null");
    }

    #[test]
    fn array_length_mismatch() {
        let f = run(json!([1, 2, 3]), json!([1, 2]));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "[2]");
        assert_eq!(f[0].expected, "3");
        assert_eq!(f[0].actual, "null");
    }

    #[test]
    fn array_index_mismatch() {
        let f = run(json!([1, 2, 3]), json!([1, 99, 3]));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "[1]");
    }

    #[test]
    fn array_vs_object() {
        // JS: expected is array, actual is object → special message
        let f = run(json!([1]), json!({"0": 1}));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, ""); // JS uses currentPath directly, no fallback
        assert_eq!(f[0].expected, "array");
        assert_eq!(f[0].actual, "object");
    }

    #[test]
    fn object_vs_array() {
        // JS: typeof [] === 'object', so typeof guard doesn't fire.
        // expected is not Array.isArray → falls to object branch.
        // Object.keys({"a":1}) = ["a"], Object.keys([1]) = ["0"]
        // Union = ["0", "a"]:
        //   "0": expected[{"a":1}]["0"] = undefined→null, actual[[1]]["0"] = 1 → mismatch
        //   "a": expected[{"a":1}]["a"] = 1, actual[[1]]["a"] = undefined→null → mismatch
        let f = run(json!({"a": 1}), json!([1]));
        assert_eq!(f.len(), 2);
        assert!(f.iter().any(|fd| fd.path == "0" && fd.expected == "null" && fd.actual == "1"));
        assert!(f.iter().any(|fd| fd.path == "a" && fd.expected == "1" && fd.actual == "null"));
    }

    #[test]
    fn nested_object_vs_nested_array() {
        // Verify the object-vs-array behavior at a nested level
        let f = run(
            json!({"items": {"0": "a", "1": "b"}}),
            json!({"items": ["a", "b"]}),
        );
        assert!(f.is_empty()); // Keys "0" and "1" match array indices
    }

    #[test]
    fn object_length_key_vs_array_length() {
        // JS: [1,2,3]["length"] === 3, so {"length": 3} matches [1,2,3] on that key
        // But Object.keys([1,2,3]) = ["0","1","2"] (no "length"), so extra array keys still differ
        let f = run(json!({"length": 3}), json!([1, 2, 3]));
        // Keys: "0","1","2" from array + "length" from expected → 4 keys
        // "0": exp=null, act=1 → mismatch
        // "1": exp=null, act=2 → mismatch
        // "2": exp=null, act=3 → mismatch
        // "length": exp=3, act=3 (via array.length) → match!
        assert_eq!(f.len(), 3);
        assert!(f.iter().all(|fd| fd.path != "length")); // length matches
    }

    #[test]
    fn deeply_nested_array_in_object() {
        let f = run(
            json!({"items": [{"id": 1}, {"id": 2}]}),
            json!({"items": [{"id": 1}, {"id": 3}]}),
        );
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "items[1].id");
    }

    #[test]
    fn multiple_failures() {
        let f = run(
            json!({"a": 1, "b": 2, "c": 3}),
            json!({"a": 1, "b": 99, "c": 100}),
        );
        assert_eq!(f.len(), 2);
        assert!(f.iter().any(|fd| fd.path == "b"));
        assert!(f.iter().any(|fd| fd.path == "c"));
    }

    #[test]
    fn empty_objects_match() {
        assert!(run(json!({}), json!({})).is_empty());
    }

    #[test]
    fn empty_arrays_match() {
        assert!(run(json!([]), json!([])).is_empty());
    }

    #[test]
    fn boolean_mismatch() {
        let f = run(json!(true), json!(false));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].expected, "true");
        assert_eq!(f[0].actual, "false");
    }

    #[test]
    fn string_mismatch() {
        let f = run(json!("hello"), json!("world"));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].expected, "\"hello\"");
        assert_eq!(f[0].actual, "\"world\"");
    }

    // ── Round 6: stringify parity ──────────────────────────

    #[test]
    fn stringify_integer_matches_json_stringify() {
        // JS: JSON.stringify(1) → "1"
        let f = run(json!(1), json!(2));
        assert_eq!(f[0].expected, "1");
        assert_eq!(f[0].actual, "2");
    }

    #[test]
    fn stringify_float_matches_json_stringify() {
        // JS: JSON.stringify(1.5) → "1.5"
        let f = run(json!(1.5), json!(2.5));
        assert_eq!(f[0].expected, "1.5");
        assert_eq!(f[0].actual, "2.5");
    }

    #[test]
    fn nested_null_in_object() {
        // expected has explicit null, actual has different value
        let f = run(json!({"a": null}), json!({"a": 1}));
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "a");
        assert_eq!(f[0].expected, "null");
        assert_eq!(f[0].actual, "1");
    }

    #[test]
    fn nested_null_vs_missing() {
        // expected has null, actual doesn't have key → both null → match
        let f = run(json!({"a": null}), json!({}));
        assert!(f.is_empty()); // both resolve to null for key "a"
    }

    #[test]
    fn array_of_objects_mixed_types() {
        let f = run(
            json!([1, "two", null, true]),
            json!([1, "two", null, false]),
        );
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].path, "[3]");
    }

    #[test]
    fn integer_vs_float_serde_equality() {
        // In JS: 1 === 1.0 is true (all numbers are f64).
        // serde_json: json!(1) creates an integer Number, json!(1.0) creates a float Number.
        // serde_json::Value::Number equality: they are NOT equal if one is i64 and other is f64.
        // This is an accepted divergence from JS since HTTP responses always come as parsed JSON
        // where 1 and 1.0 both parse to the same serde_json Number representation.
        let a = json!(1);
        let b = json!(1.0);
        // Document the actual serde_json behavior
        if a == b {
            // If serde_json considers them equal, deep_compare should too
            assert!(run(a, b).is_empty());
        } else {
            // If not equal, deep_compare will report a mismatch (accepted)
            let f = run(a, b);
            assert_eq!(f.len(), 1);
        }
    }
}
