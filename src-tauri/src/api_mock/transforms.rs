//! Typed response transforms — port of `src/shared/api-mock/responseTransforms.ts`.
//! Failures are isolated; unknown ops and bad status do not abort delivery.

use crate::api_mock::types::TransformRule;

pub fn apply_transforms(
    status: &mut u16,
    headers: &mut Vec<(String, String)>,
    body: &mut String,
    rules: &[TransformRule],
    resolve: impl Fn(&str) -> String,
) {
    for rule in rules {
        if !rule.enabled {
            continue;
        }
        match rule.op.as_str() {
            "setHeader" => {
                let Some(key) = rule.key.as_deref().filter(|k| !k.is_empty()) else { continue };
                let value = resolve_value(rule.value.as_deref(), &resolve);
                headers.retain(|(k, _)| k != key);
                headers.push((key.to_string(), value));
            }
            "appendHeader" => {
                let Some(key) = rule.key.as_deref().filter(|k| !k.is_empty()) else { continue };
                let value = resolve_value(rule.value.as_deref(), &resolve);
                headers.push((key.to_string(), value));
            }
            "removeHeader" => {
                let Some(key) = rule.key.as_deref().filter(|k| !k.is_empty()) else { continue };
                headers.retain(|(k, _)| !k.eq_ignore_ascii_case(key));
            }
            "setStatus" => {
                let raw = resolve_value(rule.value.as_deref(), &resolve);
                if let Some(n) = parse_http_status(&raw) {
                    *status = n;
                }
            }
            "replaceBody" => {
                *body = resolve_value(rule.value.as_deref(), &resolve);
            }
            _ => {}
        }
    }
}

fn resolve_value(raw: Option<&str>, resolve: &impl Fn(&str) -> String) -> String {
    match raw {
        None => String::new(),
        Some(v) if !v.contains("{{") => v.to_string(),
        Some(v) => resolve(v),
    }
}

fn parse_http_status(raw: &str) -> Option<u16> {
    let digits: String = raw.chars().take_while(|c| c.is_ascii_digit()).collect();
    let n: u16 = digits.parse().ok()?;
    (100..=599).contains(&n).then_some(n)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(op: &str, key: Option<&str>, value: Option<&str>) -> TransformRule {
        TransformRule {
            id: op.into(),
            enabled: true,
            op: op.into(),
            key: key.map(str::to_string),
            value: value.map(str::to_string),
            ..Default::default()
        }
    }

    #[test]
    fn applies_set_remove_status_body() {
        let mut status = 200u16;
        let mut headers = vec![
            ("Content-Type".into(), "application/json".into()),
            ("X-Old".into(), "1".into()),
        ];
        let mut body = "{\"ok\":true}".to_string();
        apply_transforms(
            &mut status,
            &mut headers,
            &mut body,
            &[
                rule("setHeader", Some("X-Mocked"), Some("yes")),
                rule("removeHeader", Some("X-Old"), None),
                rule("setStatus", None, Some("201")),
                rule("replaceBody", None, Some("{\"created\":true}")),
            ],
            |s| s.to_string(),
        );
        assert_eq!(status, 201);
        assert!(headers.iter().any(|(k, v)| k == "X-Mocked" && v == "yes"));
        assert!(!headers.iter().any(|(k, _)| k == "X-Old"));
        assert_eq!(body, "{\"created\":true}");
    }

    #[test]
    fn isolates_bad_status_and_skips_disabled() {
        let mut status = 200u16;
        let mut headers = vec![];
        let mut body = String::new();
        let mut off = rule("setStatus", None, Some("500"));
        off.enabled = false;
        apply_transforms(
            &mut status,
            &mut headers,
            &mut body,
            &[rule("setStatus", None, Some("nope")), off],
            |s| s.to_string(),
        );
        assert_eq!(status, 200);
    }

    #[test]
    fn appends_and_removes_case_insensitive() {
        let mut status = 200u16;
        let mut headers = vec![
            ("Content-Type".into(), "application/json".into()),
            ("X-Old".into(), "1".into()),
        ];
        let mut body = String::new();
        apply_transforms(
            &mut status,
            &mut headers,
            &mut body,
            &[
                rule("appendHeader", Some("X-Old"), Some("2")),
                rule("removeHeader", Some("x-old"), None),
            ],
            |s| s.to_string(),
        );
        assert!(!headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("x-old")));
        assert!(headers.iter().any(|(k, _)| k == "Content-Type"));
    }

    #[test]
    fn resolves_templates_and_empty_values() {
        let mut status = 200u16;
        let mut headers = vec![];
        let mut body = String::new();
        apply_transforms(
            &mut status,
            &mut headers,
            &mut body,
            &[
                rule("setHeader", Some("Authorization"), Some("{{variables.token}}")),
                rule("setHeader", Some("Plain"), Some("no-template")),
                rule("setHeader", Some("Empty"), None),
            ],
            |s| s.replace("{{variables.token}}", "abc"),
        );
        assert_eq!(header(&headers, "Authorization"), Some("abc"));
        assert_eq!(header(&headers, "Plain"), Some("no-template"));
        assert_eq!(header(&headers, "Empty"), Some(""));
    }

    fn header<'a>(headers: &'a [(String, String)], key: &str) -> Option<&'a str> {
        headers.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str())
    }

    #[test]
    fn missing_keys_and_unknown_ops_are_noops() {
        let mut status = 200u16;
        let mut headers = vec![("Keep".into(), "1".into())];
        let mut body = "same".to_string();
        apply_transforms(
            &mut status,
            &mut headers,
            &mut body,
            &[
                rule("setHeader", None, Some("x")),
                rule("appendHeader", Some(""), Some("x")),
                rule("removeHeader", None, None),
                rule("noop", Some("Keep"), Some("x")),
                rule("setStatus", None, Some("201abc")),
            ],
            |s| s.to_string(),
        );
        assert_eq!(status, 201);
        assert_eq!(header(&headers, "Keep"), Some("1"));
        assert_eq!(body, "same");
    }
}
