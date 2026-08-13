use crate::api_mock::path_match::{match_path, strip_base_path};
use crate::api_mock::types::{PathFlags, PathMatcher};

fn matcher(kind: &str, value: &str) -> PathMatcher {
    PathMatcher {
        kind: kind.into(),
        value: value.into(),
        flags: None,
    }
}

#[test]
fn exact_and_case_insensitive() {
    assert!(match_path(&matcher("exact", "/users"), "/users").matched);
    assert!(!match_path(&matcher("exact", "/users"), "/Users").matched);
    let mut m = matcher("exact", "/Users");
    m.flags = Some(PathFlags {
        case_insensitive: true,
    });
    assert!(match_path(&m, "/users").matched);
}

#[test]
fn parameterized_extracts_id() {
    let result = match_path(&matcher("parameterized", "/users/:id"), "/users/42");
    assert!(result.matched);
    assert_eq!(result.params.get("id").map(String::as_str), Some("42"));
}

#[test]
fn glob_and_regex() {
    assert!(match_path(&matcher("glob", "/api/*/items"), "/api/v1/items").matched);
    assert!(!match_path(&matcher("glob", "/api/*/items"), "/api/v1/x/items").matched);
    assert!(match_path(&matcher("regex", "^/api/v[0-9]+/items$"), "/api/v2/items").matched);
}

#[test]
fn unknown_kind_does_not_match() {
    assert!(!match_path(&matcher("other", "/x"), "/x").matched);
}

#[test]
fn strip_base_path_variants() {
    assert_eq!(strip_base_path("/api/users", ""), "/api/users");
    assert_eq!(strip_base_path("/api/users", "/api"), "/users");
    assert_eq!(strip_base_path("/api", "/api"), "/");
    assert_eq!(strip_base_path("/other", "/api"), "/other");
}
