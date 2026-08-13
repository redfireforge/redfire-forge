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
    if def.settings.tls.as_ref().is_some_and(|t| t.enabled) {
        out.push(warn(
            "NATIVE_NO_HTTP2",
            "Native HTTPS serves HTTP/1.1 only (no h2 ALPN). Use the Node companion for HTTP/2.",
        ));
        if def
            .settings
            .tls
            .as_ref()
            .and_then(|t| t.passphrase.as_deref())
            .is_some_and(|p| !p.is_empty())
        {
            out.push(warn(
                "NATIVE_NO_KEY_PASSPHRASE",
                "Passphrase-protected TLS keys are not supported on the native listener.",
            ));
        }
    }
    if def.settings.proxy.as_ref().is_some_and(|p| p.enabled)
        || def.settings.fallback.mode == "proxy"
    {
        out.push(warn(
            "NATIVE_NO_PROXY",
            "Unmatched proxy and recording are not available on the native listener.",
        ));
    }
    if def
        .settings
        .callbacks
        .as_ref()
        .is_some_and(|c| !c.allowlist.is_empty())
        || def
            .routes
            .iter()
            .any(|r| r.responses.iter().any(|v| v.callbacks.as_ref().is_some_and(|c| !c.is_empty())))
    {
        out.push(warn(
            "NATIVE_NO_CALLBACKS",
            "Outbound callbacks are not delivered by the native listener.",
        ));
    }
    if def.routes.iter().any(|r| {
        r.responses
            .iter()
            .any(|v| v.transforms.as_ref().is_some_and(|t| !t.is_empty()))
    }) {
        out.push(warn(
            "NATIVE_NO_TRANSFORMS",
            "Response transforms are skipped on the native listener.",
        ));
    }
    if def.settings.journal.persist_to_disk {
        out.push(warn(
            "NATIVE_NO_JOURNAL_DISK",
            "Journal persistToDisk is ignored on the native listener.",
        ));
    }
    if def.routes.iter().any(|r| {
        r.responses.iter().any(|v| {
            v.body.content.contains("{{faker")
                || v.headers.iter().any(|h| h.value.contains("{{faker"))
        })
    }) {
        out.push(warn(
            "NATIVE_NO_FAKER",
            "Faker template helpers are empty on the native listener.",
        ));
    }
    if def.routes.iter().any(|r| {
        r.responses.iter().any(|v| {
            matches!(
                v.behavior.fault.as_deref(),
                Some("malformed" | "reset" | "dribble")
            ) || v.behavior.chunk_schedule.as_ref().is_some_and(|s| !s.is_empty())
        })
    }) {
        out.push(warn(
            "NATIVE_LIMITED_FAULTS",
            "Native faults support delay, timeout, and close only (no malformed/reset/dribble).",
        ));
    }
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
    fn tls_warns_about_http2() {
        let mut d = def();
        d.settings.tls = Some(TlsSettings {
            enabled: true,
            ..Default::default()
        });
        let codes: Vec<_> = native_capability_warnings(&d)
            .into_iter()
            .map(|w| w.code)
            .collect();
        assert!(codes.contains(&"NATIVE_NO_HTTP2".into()));
    }

    #[test]
    fn proxy_mode_warns() {
        let mut d = def();
        d.settings.fallback.mode = "proxy".into();
        assert!(native_capability_warnings(&d)
            .iter()
            .any(|w| w.code == "NATIVE_NO_PROXY"));
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
            native_capability_warnings(&d)
                .iter()
                .any(|w| w.code == "NATIVE_UNAVAILABLE_OPERATOR"),
            "leaf predicates must deserialize so unavailable operators are reported"
        );
    }
}
