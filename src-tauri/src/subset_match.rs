use serde_json::Value;

/// Result of a deep subset match.
pub struct SubsetMatchResult {
    pub matched: bool,
    pub path: Option<String>,
    pub expected: Option<String>,
    pub actual: Option<String>,
}

impl SubsetMatchResult {
    fn ok() -> Self {
        Self { matched: true, path: None, expected: None, actual: None }
    }
    fn fail(path: &str, expected: &str, actual: &str) -> Self {
        Self {
            matched: false,
            path: Some(if path.is_empty() { "(root)".into() } else { path.into() }),
            expected: Some(expected.into()),
            actual: Some(actual.into()),
        }
    }
}

/// Recursive existential/unordered subset match.
///
/// Port of JS `deepSubsetMatch()` from `validatorSubsetMatch.ts`.
/// - `null` expected: requires exact null on actual
/// - Arrays: each expected[i] must match *some* actual element (existential, unordered)
/// - Objects + actual is array: search array elements for matching subset
/// - Objects: all expected keys must exist on actual, recurse
/// - Primitives: strict equality
pub fn deep_subset_match(actual: &Value, expected: &Value, path: &str) -> SubsetMatchResult {
    // null expected
    if matches!(expected, Value::Null) {
        return if matches!(actual, Value::Null) {
            SubsetMatchResult::ok()
        } else {
            SubsetMatchResult::fail(path, "null", &stringify(actual))
        };
    }

    // expected is array
    if let Value::Array(exp_arr) = expected {
        if let Value::Array(act_arr) = actual {
            for (i, exp_el) in exp_arr.iter().enumerate() {
                let found = act_arr.iter().any(|item| deep_subset_match(item, exp_el, "").matched);
                if !found {
                    return SubsetMatchResult::fail(
                        &format!("{path}[{i}]"),
                        &stringify(exp_el),
                        "not found in array",
                    );
                }
            }
            return SubsetMatchResult::ok();
        }
        return SubsetMatchResult::fail(path, "array", &type_name(actual));
    }

    // expected is object
    if let Value::Object(exp_map) = expected {
        // actual is array → search elements
        if let Value::Array(act_arr) = actual {
            let found = act_arr.iter().any(|item| deep_subset_match(item, expected, "").matched);
            if found {
                return SubsetMatchResult::ok();
            }
            return SubsetMatchResult::fail(path, &stringify(expected), "no matching element in array");
        }

        // actual must be object
        if let Value::Object(act_map) = actual {
            for (key, exp_val) in exp_map {
                let child_path = if path.is_empty() { key.clone() } else { format!("{path}.{key}") };
                match act_map.get(key) {
                    None => {
                        return SubsetMatchResult::fail(&child_path, &stringify(exp_val), "missing key");
                    }
                    Some(act_val) => {
                        let sub = deep_subset_match(act_val, exp_val, &child_path);
                        if !sub.matched {
                            return sub;
                        }
                    }
                }
            }
            return SubsetMatchResult::ok();
        }

        // actual is primitive/null
        let actual_str = if matches!(actual, Value::Null) { "null".into() } else { type_name(actual) };
        return SubsetMatchResult::fail(path, "object", &actual_str);
    }

    // Primitive comparison
    if actual == expected {
        SubsetMatchResult::ok()
    } else {
        SubsetMatchResult::fail(path, &stringify(expected), &stringify(actual))
    }
}

fn stringify(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        _ => serde_json::to_string(v).unwrap_or_else(|_| format!("{v:?}")),
    }
}

fn type_name(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        Value::Bool(_) => "boolean".into(),
        Value::Number(_) => "number".into(),
        Value::String(_) => "string".into(),
        Value::Array(_) => "array".into(),
        Value::Object(_) => "object".into(),
    }
}
