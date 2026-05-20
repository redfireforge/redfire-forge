use crate::validation_types::FailureDetail;
use serde_json::Value;

/// Recursive depth-first JSON equality comparison.
///
/// Port of JS `deepCompare()` from `deepCompare.ts`.
/// Control flow mirrors JS exactly:
///   1. `expected === actual` → return
///   2. Either is null, or typeof mismatch → push failure
///   3. Both arrays → index-aligned walk to max(len)
///   4. Expected is object → union-of-keys walk (actual can be object OR array,
///      since JS `typeof [] === "object"`)
///   5. Primitive mismatch → push failure
pub fn deep_compare(expected: &Value, actual: &Value, current_path: &str, failures: &mut Vec<FailureDetail>) {
    // Step 1: strict equality
    if expected == actual {
        return;
    }

    // Step 2: null guard + typeof guard (JS semantics)
    if matches!(expected, Value::Null) || matches!(actual, Value::Null) || js_typeof_mismatch(expected, actual) {
        failures.push(FailureDetail {
            path: if current_path.is_empty() { "(root)".into() } else { current_path.into() },
            expected: stringify_value(expected),
            actual: stringify_value(actual),
        });
        return;
    }

    // Step 3: Array branch — only when expected is an array
    if let Value::Array(exp_arr) = expected {
        if let Value::Array(act_arr) = actual {
            let max_len = exp_arr.len().max(act_arr.len());
            for i in 0..max_len {
                let exp_el = exp_arr.get(i).unwrap_or(&Value::Null);
                let act_el = act_arr.get(i).unwrap_or(&Value::Null);
                let child_path = format!("{current_path}[{i}]");
                deep_compare(exp_el, act_el, &child_path, failures);
            }
        } else {
            // JS: Array.isArray(expected) && !Array.isArray(actual)
            // Uses currentPath directly (no || '(root)' fallback)
            failures.push(FailureDetail {
                path: current_path.into(),
                expected: "array".into(),
                actual: js_typeof_name(actual).into(),
            });
        }
        return;
    }

    // Step 4: Object branch
    //
    // In JS, typeof returns "object" for both arrays AND objects, so when
    // expected is Object and actual is Array, JS still enters `typeof expected === 'object'`.
    // Object.keys([1,2]) returns ["0","1"], and array["key"] returns undefined.
    // We replicate this by treating arrays as string-keyed maps.
    if let Value::Object(exp_map) = expected {
        let mut all_keys: Vec<String> = exp_map.keys().cloned().collect();

        // Collect actual's keys
        match actual {
            Value::Object(act_map) => {
                for k in act_map.keys() {
                    all_keys.push(k.clone());
                }
            }
            Value::Array(act_arr) => {
                for i in 0..act_arr.len() {
                    all_keys.push(i.to_string());
                }
            }
            _ => {} // shouldn't happen after typeof guard, but safe fallback
        }

        all_keys.sort();
        all_keys.dedup();

        for key in &all_keys {
            let exp_val = exp_map.get(key.as_str()).unwrap_or(&Value::Null);
            let act_val = get_by_string_key(actual, key);
            let child_path = if current_path.is_empty() {
                key.clone()
            } else {
                format!("{current_path}.{key}")
            };
            deep_compare(exp_val, act_val.as_ref(), &child_path, failures);
        }
        return;
    }

    // Step 5: Primitive mismatch (same JS typeof but different value)
    failures.push(FailureDetail {
        path: if current_path.is_empty() { "(root)".into() } else { current_path.into() },
        expected: stringify_value(expected),
        actual: stringify_value(actual),
    });
}

/// Get a value from an object or array by string key.
/// For arrays: numeric keys resolve to indices, "length" returns array length.
/// Returns &Value::Null for missing keys (like JS `undefined`).
///
/// We use a static Value::Null and produce owned Values for computed properties
/// like "length". The caller gets a Cow-like behavior via the enum below.
fn get_by_string_key<'a>(val: &'a Value, key: &str) -> MaybeOwned<'a> {
    match val {
        Value::Object(map) => MaybeOwned::Borrowed(map.get(key).unwrap_or(&Value::Null)),
        Value::Array(arr) => {
            if key == "length" {
                MaybeOwned::Owned(Value::Number(serde_json::Number::from(arr.len())))
            } else {
                MaybeOwned::Borrowed(
                    key.parse::<usize>()
                        .ok()
                        .and_then(|i| arr.get(i))
                        .unwrap_or(&Value::Null),
                )
            }
        }
        _ => MaybeOwned::Borrowed(&Value::Null),
    }
}

enum MaybeOwned<'a> {
    Borrowed(&'a Value),
    Owned(Value),
}

impl<'a> MaybeOwned<'a> {
    fn as_ref(&self) -> &Value {
        match self {
            MaybeOwned::Borrowed(v) => v,
            MaybeOwned::Owned(v) => v,
        }
    }
}

/// Simulate JS `typeof expected !== typeof actual`.
///
/// In JS, both arrays and objects have `typeof === "object"`, while
/// primitives (string, number, boolean) each have their own typeof.
/// Null is already handled before this is called.
fn js_typeof_mismatch(a: &Value, b: &Value) -> bool {
    js_typeof_name(a) != js_typeof_name(b)
}

/// Map serde_json::Value to its JS `typeof` string.
fn js_typeof_name(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) | Value::Object(_) => "object",
    }
}

fn stringify_value(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        _ => serde_json::to_string(v).unwrap_or_else(|_| format!("{v:?}")),
    }
}
