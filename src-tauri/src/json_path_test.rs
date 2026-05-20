#[cfg(test)]
mod tests {
    use crate::json_path::*;
    use serde_json::json;

    // ── strip_json_path_prefix ─────────────────────────────

    #[test]
    fn strip_no_prefix() {
        assert_eq!(strip_json_path_prefix("a.b.c"), "a.b.c");
    }

    #[test]
    fn strip_dollar_dot() {
        assert_eq!(strip_json_path_prefix("$.x.y"), "x.y");
    }

    #[test]
    fn strip_bare_dollar() {
        assert_eq!(strip_json_path_prefix("$foo"), "foo");
    }

    // ── getByPath — basic ──────────────────────────────────

    fn sample() -> serde_json::Value {
        json!({
            "name": "Alice",
            "address": { "city": "NYC", "zip": "10001" },
            "orders": [
                { "id": 1, "items": [{ "sku": "A" }, { "sku": "B" }] },
                { "id": 2, "items": [{ "sku": "C" }] }
            ]
        })
    }

    #[test]
    fn top_level_key() {
        assert_eq!(get_by_path(&sample(), "$.name"), json!("Alice"));
    }

    #[test]
    fn nested_keys() {
        assert_eq!(get_by_path(&sample(), "$.address.city"), json!("NYC"));
    }

    #[test]
    fn array_index() {
        assert_eq!(get_by_path(&sample(), "$.orders[0].id"), json!(1));
    }

    #[test]
    fn deeply_nested_array() {
        assert_eq!(get_by_path(&sample(), "$.orders[0].items[1].sku"), json!("B"));
    }

    #[test]
    fn missing_path_returns_null() {
        assert_eq!(get_by_path(&sample(), "$.nonexistent"), json!(null));
        assert_eq!(get_by_path(&sample(), "$.orders[5].id"), json!(null));
    }

    #[test]
    fn path_without_dollar_prefix() {
        assert_eq!(get_by_path(&sample(), "name"), json!("Alice"));
        assert_eq!(get_by_path(&sample(), "address.city"), json!("NYC"));
    }

    #[test]
    fn null_input() {
        assert_eq!(get_by_path(&json!(null), "$.x"), json!(null));
    }

    #[test]
    fn star_over_array() {
        assert_eq!(get_by_path(&sample(), "$.orders[*].id"), json!([1, 2]));
    }

    #[test]
    fn star_nested_under_fixed_index() {
        assert_eq!(
            get_by_path(&sample(), "$.orders[0].items[*].sku"),
            json!(["A", "B"])
        );
    }

    #[test]
    fn star_terminal_returns_array() {
        let obj = &sample();
        let result = get_by_path(obj, "$.orders[*]");
        assert_eq!(result, obj["orders"]);
    }

    // ── getByPath — edge cases ─────────────────────────────

    #[test]
    fn root_for_dollar_only() {
        let obj = json!({ "a": 1 });
        assert_eq!(get_by_path(&obj, "$"), obj);
    }

    #[test]
    fn root_for_dollar_dot_only() {
        let obj = json!({ "a": 1 });
        assert_eq!(get_by_path(&obj, "$."), obj);
    }

    #[test]
    fn unclosed_bracket_returns_partial() {
        let obj = json!({ "a": [1, 2] });
        assert_eq!(get_by_path(&obj, "$.a[0"), json!([1, 2]));
    }

    #[test]
    fn unclosed_bracket_stops_tokenization() {
        let obj = json!({ "items": { "count": 3 } });
        assert_eq!(get_by_path(&obj, "items["), json!({ "count": 3 }));
    }

    #[test]
    fn star_on_non_array() {
        let obj = json!({ "a": { "b": 1 } });
        assert_eq!(get_by_path(&obj, "$.a[*]"), json!(null));
    }

    #[test]
    fn star_terminal_returns_entire_array() {
        let obj = json!({ "items": [1, 2, 3] });
        assert_eq!(get_by_path(&obj, "$.items[*]"), json!([1, 2, 3]));
    }

    #[test]
    fn single_dollar_prefix() {
        let obj = json!({ "a": 1 });
        assert_eq!(get_by_path(&obj, "$a"), json!(1));
    }

    #[test]
    fn path_through_null() {
        assert_eq!(get_by_path(&json!(null), "a.b"), json!(null));
    }

    #[test]
    fn non_numeric_key_on_array() {
        assert_eq!(get_by_path(&json!([1, 2, 3]), "foo"), json!(null));
    }

    #[test]
    fn numeric_index_on_array() {
        assert_eq!(get_by_path(&json!([10, 20, 30]), "1"), json!(20));
    }

    #[test]
    fn length_on_array() {
        assert_eq!(get_by_path(&json!([1, 2, 3]), "length"), json!(3));
    }

    #[test]
    fn unclosed_bracket_gracefully() {
        assert_eq!(get_by_path(&json!({"a": 1}), "[unclosed"), json!({"a": 1}));
    }

    #[test]
    fn walk_path_on_primitive() {
        assert_eq!(get_by_path(&json!("hello"), "length"), json!(null));
    }

    #[test]
    fn star_on_string_non_array() {
        assert_eq!(get_by_path(&json!({"a": "hello"}), "a[*]"), json!(null));
    }

    #[test]
    fn empty_string_path() {
        let obj = json!({"a": 1});
        assert_eq!(get_by_path(&obj, ""), obj);
    }

    #[test]
    fn whitespace_only_path() {
        let obj = json!({"a": 1});
        assert_eq!(get_by_path(&obj, "   "), obj);
    }

    #[test]
    fn bracket_with_spaces() {
        let obj = json!({"items": ["x", "y"]});
        assert_eq!(get_by_path(&obj, "items[ 1 ]"), json!("y"));
    }

    #[test]
    fn double_nested_star() {
        let obj = json!({"matrix": [[1, 2], [3, 4]]});
        assert_eq!(get_by_path(&obj, "matrix[*]"), json!([[1, 2], [3, 4]]));
    }

    #[test]
    fn star_deep_chain() {
        let obj = json!({
            "teams": [
                { "members": [{ "name": "A" }, { "name": "B" }] },
                { "members": [{ "name": "C" }] }
            ]
        });
        assert_eq!(
            get_by_path(&obj, "teams[*].members[*].name"),
            json!([["A", "B"], ["C"]])
        );
    }

    #[test]
    fn boolean_and_number_leaves() {
        let obj = json!({"active": true, "count": 0, "ratio": 0.5});
        assert_eq!(get_by_path(&obj, "active"), json!(true));
        assert_eq!(get_by_path(&obj, "count"), json!(0));
        assert_eq!(get_by_path(&obj, "ratio"), json!(0.5));
    }

    #[test]
    fn keys_with_special_characters() {
        let obj = json!({"my-key": 42});
        assert_eq!(get_by_path(&obj, "my-key"), json!(42));
    }

    #[test]
    fn nested_length() {
        let obj = json!({"items": [1, 2, 3]});
        assert_eq!(get_by_path(&obj, "$.items.length"), json!(3));
    }

    // ── path_exists ────────────────────────────────────────

    #[test]
    fn exists_for_present_key() {
        assert!(path_exists(&json!({"a": 1}), "a"));
    }

    #[test]
    fn exists_for_null_value() {
        assert!(path_exists(&json!({"a": null}), "a"));
    }

    #[test]
    fn not_exists_for_missing_key() {
        assert!(!path_exists(&json!({"a": 1}), "b"));
    }

    #[test]
    fn exists_empty_path_returns_true() {
        assert!(path_exists(&json!({"a": 1}), ""));
    }

    #[test]
    fn exists_deep_missing() {
        assert!(!path_exists(&json!({"a": {"b": 1}}), "a.c"));
    }

    #[test]
    fn exists_array_index_in_bounds() {
        assert!(path_exists(&json!([1, 2, 3]), "1"));
    }

    #[test]
    fn exists_array_index_out_of_bounds() {
        assert!(!path_exists(&json!([1, 2, 3]), "5"));
    }

    #[test]
    fn exists_star_on_array() {
        assert!(path_exists(&json!({"items": [1, 2]}), "items[*]"));
    }

    #[test]
    fn exists_star_on_non_array() {
        assert!(!path_exists(&json!({"items": "hello"}), "items[*]"));
    }

    #[test]
    fn exists_length_on_array() {
        assert!(path_exists(&json!([1, 2, 3]), "length"));
    }

    // ── getByPathAsString ──────────────────────────────────

    #[test]
    fn as_string_primitive() {
        assert_eq!(get_by_path_as_string(&json!({"name": "Alice"}), "name"), "Alice");
        assert_eq!(get_by_path_as_string(&json!({"count": 42}), "count"), "42");
        assert_eq!(get_by_path_as_string(&json!({"active": true}), "active"), "true");
    }

    #[test]
    fn as_string_null_returns_empty() {
        assert_eq!(get_by_path_as_string(&json!({"x": null}), "x"), "");
    }

    #[test]
    fn as_string_missing_returns_empty() {
        assert_eq!(get_by_path_as_string(&json!({"a": 1}), "b.c"), "");
    }

    #[test]
    fn as_string_object() {
        assert_eq!(
            get_by_path_as_string(&json!({"data": {"x": 1}}), "data"),
            r#"{"x":1}"#
        );
    }

    #[test]
    fn as_string_array() {
        assert_eq!(
            get_by_path_as_string(&json!({"items": [1, 2, 3]}), "items"),
            "[1,2,3]"
        );
    }

    #[test]
    fn as_string_null_input() {
        assert_eq!(get_by_path_as_string(&json!(null), "a"), "");
    }

    #[test]
    fn as_string_intermediate_null() {
        assert_eq!(
            get_by_path_as_string(&json!({"a": {"b": null}}), "a.b.c"),
            ""
        );
    }

    #[test]
    fn as_string_deeply_nested() {
        let obj = json!({"a": [{"b": [{"c": "found"}]}]});
        assert_eq!(get_by_path_as_string(&obj, "a[0].b[0].c"), "found");
    }

    #[test]
    fn as_string_array_element() {
        let obj = json!({"items": ["a", "b", "c"]});
        assert_eq!(get_by_path_as_string(&obj, "items[1]"), "b");
    }

    // ── numeric string key on objects ──────────────────────

    #[test]
    fn numeric_key_on_object() {
        let obj = json!({"0": "zero", "1": "one"});
        assert_eq!(get_by_path(&obj, "0"), json!("zero"));
        assert_eq!(get_by_path(&obj, "[1]"), json!("one"));
    }

    #[test]
    fn object_with_numeric_key_via_bracket() {
        let obj = json!({"items": {"0": "first"}});
        assert_eq!(get_by_path(&obj, "items[0]"), json!("first"));
    }

    // ── null vs missing distinction ────────────────────────

    #[test]
    fn explicit_null_at_path_exists() {
        assert!(path_exists(&json!({"x": null}), "x"));
        assert_eq!(get_by_path(&json!({"x": null}), "x"), json!(null));
        assert_eq!(get_by_path_as_string(&json!({"x": null}), "x"), "");
    }

    #[test]
    fn missing_key_not_exists() {
        assert!(!path_exists(&json!({"x": 1}), "y"));
        assert_eq!(get_by_path(&json!({"x": 1}), "y"), json!(null));
        assert_eq!(get_by_path_as_string(&json!({"x": 1}), "y"), "");
    }

    #[test]
    fn deep_null_exists() {
        assert!(path_exists(&json!({"a": {"b": null}}), "a.b"));
        assert_eq!(get_by_path_as_string(&json!({"a": {"b": null}}), "a.b"), "");
    }

    #[test]
    fn deep_missing_not_exists() {
        assert!(!path_exists(&json!({"a": {"c": 1}}), "a.b"));
        assert_eq!(get_by_path_as_string(&json!({"a": {"c": 1}}), "a.b"), "");
    }

    // ── object key named "length" ──────────────────────────

    #[test]
    fn object_with_length_key() {
        assert_eq!(get_by_path(&json!({"length": 42}), "length"), json!(42));
    }

    #[test]
    fn non_array_obj_nested_length_key() {
        assert_eq!(
            get_by_path(&json!({"items": {"length": 99}}), "items.length"),
            json!(99)
        );
    }

    #[test]
    fn string_length_returns_null() {
        assert_eq!(get_by_path(&json!({"a": "hello"}), "a.length"), json!(null));
    }

    // ── bracket notation edge cases ────────────────────────

    #[test]
    fn quoted_bracket_not_stripped() {
        assert_eq!(get_by_path(&json!({"name": "Alice"}), r#"["name"]"#), json!(null));
    }

    #[test]
    fn unquoted_bracket_resolves() {
        assert_eq!(get_by_path(&json!({"name": "Alice"}), "[name]"), json!("Alice"));
    }

    #[test]
    fn empty_bracket() {
        assert_eq!(get_by_path(&json!({"a": 1}), "[]"), json!(null));
    }

    #[test]
    fn negative_index_returns_null() {
        assert_eq!(get_by_path(&json!([10, 20, 30]), "[-1]"), json!(null));
    }
}
