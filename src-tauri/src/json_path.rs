use serde_json::Value;

const STAR: &str = "__PATH_STAR__";

/// Strip the leading `$.` or `$` prefix from a JSONPath string.
pub fn strip_json_path_prefix(path: &str) -> &str {
    if let Some(rest) = path.strip_prefix("$.") {
        rest
    } else if let Some(rest) = path.strip_prefix('$') {
        rest
    } else {
        path
    }
}

fn tokenize_json_path(normalized: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let s = normalized.trim();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'.' {
            i += 1;
            continue;
        }
        if bytes[i] == b'[' {
            let rest = &s[i + 1..];
            let end = match rest.find(']') {
                Some(pos) => pos,
                std::option::Option::None => break, // unclosed bracket → stop
            };
            let inner = rest[..end].trim();
            tokens.push(if inner == "*" {
                STAR.to_string()
            } else {
                inner.to_string()
            });
            i += 1 + end + 1; // skip past ']'
            continue;
        }
        let mut j = i;
        while j < bytes.len() && bytes[j] != b'.' && bytes[j] != b'[' {
            j += 1;
        }
        if j > i {
            tokens.push(s[i..j].to_string());
        }
        i = j;
    }
    tokens
}

fn walk_path(obj: &Value, tokens: &[String], idx: usize) -> Value {
    if idx >= tokens.len() {
        return obj.clone();
    }
    let t = &tokens[idx];

    if t == STAR {
        if let Value::Array(arr) = obj {
            if idx == tokens.len() - 1 {
                return obj.clone();
            }
            let mapped: Vec<Value> = arr.iter().map(|el| walk_path(el, tokens, idx + 1)).collect();
            return Value::Array(mapped);
        }
        return Value::Null;
    }

    if t == "length" {
        if let Value::Array(arr) = obj {
            let len_val = Value::Number(serde_json::Number::from(arr.len()));
            return walk_path(&len_val, tokens, idx + 1);
        }
    }

    match obj {
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => Value::Null,
        Value::Array(arr) => {
            if let Ok(index) = t.parse::<usize>() {
                match arr.get(index) {
                    Some(next) => walk_path(next, tokens, idx + 1),
                    std::option::Option::None => Value::Null,
                }
            } else {
                Value::Null
            }
        }
        Value::Object(map) => match map.get(t.as_str()) {
            Some(next) => walk_path(next, tokens, idx + 1),
            std::option::Option::None => Value::Null,
        },
    }
}

/// Resolve a JSONPath-style expression against a JSON value.
///
/// Returns `Value::Null` for missing paths (equivalent to JS `undefined`).
/// Callers should use `is_found()` to distinguish explicit null from not-found.
pub fn get_by_path(obj: &Value, path: &str) -> Value {
    let normalized = strip_json_path_prefix(path);
    if normalized.trim().is_empty() {
        return obj.clone();
    }
    let tokens = tokenize_json_path(normalized);
    if tokens.is_empty() {
        return obj.clone();
    }
    walk_path(obj, &tokens, 0)
}

/// Check whether a path resolves to a real value (including explicit `null`)
/// versus missing/undefined. This mirrors JS `getByPath(obj, path) !== undefined`.
///
/// We use a two-pass strategy: walk once returning `Value::Null` for both
/// missing and explicit null, then walk with a sentinel to detect the difference.
pub fn path_exists(obj: &Value, path: &str) -> bool {
    let normalized = strip_json_path_prefix(path);
    if normalized.trim().is_empty() {
        return true;
    }
    let tokens = tokenize_json_path(normalized);
    if tokens.is_empty() {
        return true;
    }
    walk_path_exists(obj, &tokens, 0)
}

fn walk_path_exists(obj: &Value, tokens: &[String], idx: usize) -> bool {
    if idx >= tokens.len() {
        return true;
    }
    let t = &tokens[idx];

    if t == STAR {
        if let Value::Array(_) = obj {
            return true;
        }
        return false;
    }

    if t == "length" {
        if let Value::Array(_) = obj {
            return walk_path_exists(&Value::Null, tokens, idx + 1);
        }
    }

    match obj {
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => false,
        Value::Array(arr) => {
            if let Ok(index) = t.parse::<usize>() {
                match arr.get(index) {
                    Some(next) => walk_path_exists(next, tokens, idx + 1),
                    std::option::Option::None => false,
                }
            } else {
                false
            }
        }
        Value::Object(map) => match map.get(t.as_str()) {
            Some(next) => walk_path_exists(next, tokens, idx + 1),
            std::option::Option::None => false,
        },
    }
}

/// Like `get_by_path` but coerces the result to a string.
/// Returns empty string for null/missing paths.
/// Objects and arrays are JSON-stringified.
pub fn get_by_path_as_string(obj: &Value, path: &str) -> String {
    let value = get_by_path(obj, path);
    value_to_string(&value, !path_exists(obj, path))
}

/// Convert a `serde_json::Value` to a display string.
fn value_to_string(value: &Value, is_missing: bool) -> String {
    if is_missing {
        return String::new();
    }
    match value {
        Value::Null => String::new(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::String(s) => s.clone(),
        Value::Array(_) | Value::Object(_) => {
            serde_json::to_string(value).unwrap_or_default()
        }
    }
}
