//! Path matching — exact / parameterized / glob / regex (parity with pathMatcher.ts).

use crate::api_mock::types::PathMatcher;
use regex::RegexBuilder;
use std::collections::HashMap;

pub struct PathMatch {
    pub matched: bool,
    pub params: HashMap<String, String>,
}

pub fn match_path(matcher: &PathMatcher, request_path: &str) -> PathMatch {
    let ci = matcher
        .flags
        .as_ref()
        .map(|f| f.case_insensitive)
        .unwrap_or(false);
    match matcher.kind.as_str() {
        "exact" => match_exact(&matcher.value, request_path, ci),
        "parameterized" => match_parameterized(&matcher.value, request_path, ci),
        "glob" => match_glob(&matcher.value, request_path, ci),
        "regex" => match_regex(&matcher.value, request_path, ci),
        _ => PathMatch {
            matched: false,
            params: HashMap::new(),
        },
    }
}

pub fn strip_base_path<'a>(path: &'a str, base_path: &str) -> &'a str {
    if base_path.is_empty() {
        return path;
    }
    if let Some(rest) = path.strip_prefix(base_path) {
        if rest.is_empty() {
            "/"
        } else {
            rest
        }
    } else {
        path
    }
}

fn match_exact(pattern: &str, path: &str, ci: bool) -> PathMatch {
    let matched = if ci {
        pattern.eq_ignore_ascii_case(path)
    } else {
        pattern == path
    };
    PathMatch {
        matched,
        params: HashMap::new(),
    }
}

fn match_parameterized(pattern: &str, path: &str, ci: bool) -> PathMatch {
    let pattern_parts: Vec<&str> = pattern.split('/').collect();
    let path_parts: Vec<&str> = path.split('/').collect();
    if pattern_parts.len() != path_parts.len() {
        return PathMatch {
            matched: false,
            params: HashMap::new(),
        };
    }
    let mut params = HashMap::new();
    for (pp, rp) in pattern_parts.iter().zip(path_parts.iter()) {
        if pp.starts_with(':') || (pp.starts_with('{') && pp.ends_with('}')) {
            let name = if pp.starts_with(':') {
                &pp[1..]
            } else {
                &pp[1..pp.len() - 1]
            };
            if !name.is_empty() {
                params.insert(name.to_string(), (*rp).to_string());
            }
        } else {
            let ok = if ci {
                pp.eq_ignore_ascii_case(rp)
            } else {
                pp == rp
            };
            if !ok {
                return PathMatch {
                    matched: false,
                    params: HashMap::new(),
                };
            }
        }
    }
    PathMatch {
        matched: true,
        params,
    }
}

fn glob_to_regex(glob: &str) -> String {
    let mut regex = String::from("^");
    let chars: Vec<char> = glob.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i];
        if ch == '*' && i + 1 < chars.len() && chars[i + 1] == '*' {
            regex.push_str(".*");
            i += 2;
            if i < chars.len() && chars[i] == '/' {
                i += 1;
            }
        } else if ch == '*' {
            regex.push_str("[^/]*");
            i += 1;
        } else if ch == '?' {
            regex.push_str("[^/]");
            i += 1;
        } else if ".+*?^${}()|[]\\".contains(ch) {
            regex.push('\\');
            regex.push(ch);
            i += 1;
        } else {
            regex.push(ch);
            i += 1;
        }
    }
    regex.push('$');
    regex
}

fn match_glob(pattern: &str, path: &str, ci: bool) -> PathMatch {
    let re = glob_to_regex(pattern);
    match_regex(&re, path, ci)
}

fn match_regex(pattern: &str, path: &str, ci: bool) -> PathMatch {
    let Ok(re) = RegexBuilder::new(pattern).case_insensitive(ci).build() else {
        return PathMatch {
            matched: false,
            params: HashMap::new(),
        };
    };
    PathMatch {
        matched: re.is_match(path),
        params: HashMap::new(),
    }
}
