//! Explicit native vs TypeScript capability differences (Phase 10E).

use crate::api_mock::predicates::NATIVE_UNAVAILABLE_OPERATORS;
use crate::api_mock::types::{PredicateNode, ServerDefinition};
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeCapabilityWarning {
    pub code: String,
    pub message: String,
}

pub fn native_capability_warnings(def: &ServerDefinition) -> Vec<NativeCapabilityWarning> {
    let mut out = Vec::new();
    let mut seen_ops = Vec::new();
    for route in &def.routes {
        collect_ops(&route.predicates, &mut seen_ops);
        for v in &route.responses {
            if let Some(c) = &v.conditions {
                collect_ops(c, &mut seen_ops);
            }
        }
    }
    for op in seen_ops {
        if NATIVE_UNAVAILABLE_OPERATORS.contains(&op.as_str()) {
            out.push(warn(
                "NATIVE_UNAVAILABLE_OPERATOR",
                &format!("Predicate operator \"{op}\" is not evaluated on the native listener (fail-closed)."),
            ));
        }
    }
    out
}

fn collect_ops(group: &crate::api_mock::types::PredicateGroup, out: &mut Vec<String>) {
    for child in &group.children {
        match child {
            PredicateNode::Group(g) => collect_ops(g, out),
            PredicateNode::Leaf(p) => {
                if !out.contains(&p.operator) {
                    out.push(p.operator.clone());
                }
            }
        }
    }
}

fn warn(code: &str, message: &str) -> NativeCapabilityWarning {
    NativeCapabilityWarning {
        code: code.into(),
        message: message.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api_mock::types::*;

    fn def() -> ServerDefinition {
        serde_json::from_value(serde_json::json!({
            "id": "s",
            "port": 4600,
            "routes": []
        }))
        .unwrap()
    }

    #[test]
    fn empty_definition_has_no_warnings() {
        assert!(native_capability_warnings(&def()).is_empty());
    }

    #[test]
    fn tls_has_no_http2_warning() {
        let mut d = def();
        d.settings.tls = Some(TlsSettings {
            enabled: true,
            ..Default::default()
        });
        assert!(native_capability_warnings(&d).is_empty());
    }

    #[test]
    fn proxy_mode_with_recording_has_no_warning() {
        let mut d = def();
        d.settings.fallback.mode = "proxy".into();
        d.settings.proxy = Some(ProxySettings {
            enabled: true,
            ..Default::default()
        });
        assert!(native_capability_warnings(&d).is_empty());
    }

    #[test]
    fn proxy_without_recording_has_no_warning() {
        let mut d = def();
        d.settings.fallback.mode = "proxy".into();
        d.settings.proxy = Some(ProxySettings {
            enabled: true,
            record_as_drafts: false,
            ..Default::default()
        });
        assert!(native_capability_warnings(&d).is_empty());
    }

    #[test]
    fn proxy_enabled_but_fallback_not_proxy_has_no_warning() {
        let mut d = def();
        d.settings.proxy = Some(ProxySettings {
            enabled: true,
            ..Default::default()
        });
        assert!(native_capability_warnings(&d).is_empty());
    }

    #[test]
    fn json_leaf_predicates_are_not_swallowed_as_groups() {
        let d: ServerDefinition = serde_json::from_value(serde_json::json!({
            "id": "s",
            "port": 1,
            "routes": [{
                "id": "r",
                "method": "GET",
                "path": { "kind": "exact", "value": "/" },
                "predicates": {
                    "id": "g",
                    "combinator": "all",
                    "children": [{
                        "id": "p",
                        "source": "body",
                        "operator": "xpath_exists",
                        "expected": "//a"
                    }]
                }
            }]
        }))
        .unwrap();
        assert!(
            native_capability_warnings(&d).iter().all(|w| w.code != "NATIVE_UNAVAILABLE_OPERATOR"),
            "xpath_exists is evaluated on the native listener"
        );
    }

    #[test]
    fn implemented_features_do_not_warn() {
        let d: ServerDefinition = serde_json::from_value(serde_json::json!({
            "id": "s",
            "port": 1,
            "settings": {
                "tls": { "enabled": true, "passphrase": "secret" },
                "journal": { "persistToDisk": true }
            },
            "routes": [{
                "id": "r",
                "method": "GET",
                "path": { "kind": "exact", "value": "/" },
                "predicates": {
                    "id": "g",
                    "combinator": "all",
                    "children": [
                        { "id": "p", "source": "body", "operator": "xmlSchema", "expected": "Order" },
                        { "id": "m", "source": "body", "operator": "multipart_field", "expected": "note" }
                    ]
                },
                "responses": [{
                    "id": "v",
                    "enabled": true,
                    "status": 200,
                    "behavior": { "fault": "dribble", "chunkSchedule": [{ "afterMs": 1, "body": "x" }] }
                }]
            }]
        }))
        .unwrap();
        assert!(native_capability_warnings(&d).is_empty());
    }

    #[test]
    fn callbacks_do_not_warn() {
        let d: ServerDefinition = serde_json::from_value(serde_json::json!({
            "id": "s",
            "port": 1,
            "settings": { "callbacks": { "allowlist": ["https://hooks.example.com/event"] } },
            "routes": [{
                "id": "r",
                "method": "GET",
                "path": { "kind": "exact", "value": "/" },
                "responses": [{
                    "id": "v",
                    "enabled": true,
                    "status": 200,
                    "callbacks": [{
                        "id": "c",
                        "enabled": true,
                        "url": "https://hooks.example.com/event",
                        "method": "POST"
                    }]
                }]
            }]
        }))
        .unwrap();
        assert!(native_capability_warnings(&d).is_empty());
    }
}
