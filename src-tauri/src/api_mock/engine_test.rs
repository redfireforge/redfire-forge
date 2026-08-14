use crate::api_mock::engine::{handle_captured_request, EngineRuntime};
use crate::api_mock::types::{CapturedRequest, ServerDefinition};

fn def(json: serde_json::Value) -> ServerDefinition {
    serde_json::from_value(json).unwrap()
}

fn get(path: &str) -> CapturedRequest {
    CapturedRequest {
        method: "GET".into(),
        path: path.into(),
        raw_path: path.into(),
        received_at: "2026-08-11T00:00:00.000Z".into(),
        ..Default::default()
    }
}

#[test]
fn matched_static_json() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/users" },
            "responses": [{
                "id": "resp-1",
                "enabled": true,
                "isDefault": true,
                "status": 200,
                "body": { "kind": "json", "content": "{\"users\":[]}", "contentType": "application/json" }
            }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/users"), &mut EngineRuntime::default());
    assert_eq!(out.outcome, "matched");
    assert_eq!(out.status, 200);
    assert_eq!(out.matched_route_id.as_deref(), Some("route-1"));
    assert!(out.body.contains("users"));
}

#[test]
fn unmatched_uses_fallback() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/users" },
            "responses": [{ "id": "resp-1", "enabled": true, "isDefault": true, "status": 200 }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/nope"), &mut EngineRuntime::default());
    assert_eq!(out.outcome, "unmatched");
    assert_eq!(out.status, 404);
}

#[test]
fn closest_match_debug_includes_near_misses() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "settings": { "fallback": { "mode": "closest_match_debug", "unmatchedResponse": { "status": 404 } } },
        "routes": [{
            "id": "route-1",
            "name": "Users",
            "method": "GET",
            "path": { "kind": "exact", "value": "/users" },
            "predicates": {
                "id": "g",
                "combinator": "all",
                "children": [{
                    "id": "p1",
                    "source": "header",
                    "selector": "x-tenant",
                    "operator": "exact",
                    "expected": "acme"
                }]
            },
            "responses": [{ "id": "resp-1", "enabled": true, "isDefault": true, "status": 200 }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/users"), &mut EngineRuntime::default());
    assert_eq!(out.outcome, "unmatched");
    let parsed: serde_json::Value = serde_json::from_str(&out.body).unwrap();
    assert_eq!(parsed["mode"], "closest_match_debug");
    assert_eq!(parsed["nearMissCount"], 1);
    assert_eq!(parsed["nearMisses"][0]["routeName"], "Users");
}

#[test]
fn sequence_advances() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/seq" },
            "responseMode": "sequence",
            "responses": [
                { "id": "a", "enabled": true, "status": 200, "body": { "kind": "text", "content": "one" } },
                { "id": "b", "enabled": true, "status": 200, "body": { "kind": "text", "content": "two" } }
            ]
        }]
    }));
    let mut runtime = EngineRuntime::default();
    let first = handle_captured_request(&def, &get("/seq"), &mut runtime);
    let second = handle_captured_request(&def, &get("/seq"), &mut runtime);
    assert_eq!(first.body, "one");
    assert_eq!(second.body, "two");
}

#[test]
fn timeout_fault_drops() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/hang" },
            "responses": [{
                "id": "resp-1",
                "enabled": true,
                "isDefault": true,
                "status": 200,
                "behavior": { "fault": "timeout", "delayMs": 0, "jitterMs": 0 }
            }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/hang"), &mut EngineRuntime::default());
    assert!(out.drop_response);
    assert_eq!(out.outcome, "fault");
}

#[test]
fn json_header_predicate_does_not_match_when_missing() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "routes": [{
            "id": "route-hdr",
            "method": "GET",
            "path": { "kind": "exact", "value": "/data" },
            "predicates": {
                "id": "pg-1",
                "combinator": "all",
                "children": [{
                    "id": "p1",
                    "source": "header",
                    "selector": "x-tenant",
                    "operator": "exact",
                    "expected": "acme"
                }]
            },
            "responses": [{ "id": "resp-1", "enabled": true, "isDefault": true, "status": 200 }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/data"), &mut EngineRuntime::default());
    assert_eq!(out.outcome, "unmatched", "leaf predicates must not deserialize as empty groups");
}

#[test]
fn state_transition_applies_after_render() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/s" },
            "responses": [{
                "id": "resp-1",
                "enabled": true,
                "isDefault": true,
                "status": 200,
                "body": { "kind": "text", "content": "{{state default}}" },
                "transition": { "targetState": "on" }
            }]
        }]
    }));
    let mut runtime = EngineRuntime::default();
    let out = handle_captured_request(&def, &get("/s"), &mut runtime);
    assert!(runtime.scenario.states.is_empty());
    assert_eq!(out.body, "");
    runtime.apply_pending_transition(out.pending_transition.as_ref().unwrap());
    assert_eq!(runtime.scenario.states.get("default").map(String::as_str), Some("on"));
}

#[test]
fn max_matches_falls_back_to_sibling() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/lim" },
            "responses": [
                { "id": "a", "enabled": true, "isDefault": true, "status": 200, "behavior": { "maxMatches": 1 },
                  "body": { "kind": "text", "content": "first" } },
                { "id": "b", "enabled": true, "status": 201, "body": { "kind": "text", "content": "second" } }
            ]
        }]
    }));
    let mut runtime = EngineRuntime::default();
    let first = handle_captured_request(&def, &get("/lim"), &mut runtime);
    let second = handle_captured_request(&def, &get("/lim"), &mut runtime);
    assert_eq!(first.body, "first");
    assert_eq!(second.body, "second");
}

#[test]
fn unmatched_interpolates_request_id_placeholder() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "settings": {
            "fallback": {
                "unmatchedResponse": {
                    "status": 404,
                    "body": "{\"error\":\"not_found\",\"requestId\":\"{{requestId}}\"}"
                }
            }
        },
        "routes": []
    }));
    let out = handle_captured_request(&def, &get("/missing"), &mut EngineRuntime::default());
    assert_eq!(out.outcome, "unmatched");
    assert!(!out.body.contains("{{requestId}}"), "{}", out.body);
    let id = out.transaction_id.expect("fallback id");
    assert!(out.body.contains(&id), "{}", out.body);
}

#[test]
fn faker_helper_fills_body() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/who" },
            "responses": [{
                "id": "resp-1",
                "enabled": true,
                "isDefault": true,
                "status": 200,
                "body": { "kind": "text", "content": "{{faker 'person.firstName'}}", "contentType": "text/plain" }
            }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/who"), &mut EngineRuntime::default());
    assert_eq!(out.outcome, "matched");
    assert!(
        ["Ada", "Grace", "Linus", "Niels", "Alan", "Barbara", "Ken", "Dorothy"].contains(&out.body.as_str()),
        "body={}",
        out.body
    );
}

#[test]
fn transforms_override_status_and_headers() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/t" },
            "responses": [{
                "id": "resp-1",
                "enabled": true,
                "isDefault": true,
                "status": 200,
                "headers": [{ "key": "X-Old", "value": "1", "enabled": true }],
                "body": { "kind": "text", "content": "orig", "contentType": "text/plain" },
                "transforms": [
                    { "id": "t1", "enabled": true, "target": "response", "op": "setStatus", "value": "201" },
                    { "id": "t2", "enabled": true, "target": "response", "op": "setHeader", "key": "X-Mocked", "value": "yes" },
                    { "id": "t3", "enabled": true, "target": "response", "op": "removeHeader", "key": "X-Old" },
                    { "id": "t4", "enabled": true, "target": "response", "op": "replaceBody", "value": "created" }
                ]
            }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/t"), &mut EngineRuntime::default());
    assert_eq!(out.status, 201);
    assert_eq!(out.body, "created");
    assert!(out.headers.iter().any(|(k, v)| k == "X-Mocked" && v == "yes"));
    assert!(!out.headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("x-old")));
}

#[test]
fn reset_and_malformed_faults_drop() {
    for fault in ["reset", "malformed"] {
        let def = def(serde_json::json!({
            "id": "s",
            "port": 4600,
            "routes": [{
                "id": "route-1",
                "method": "GET",
                "path": { "kind": "exact", "value": "/boom" },
                "responses": [{
                    "id": "resp-1",
                    "enabled": true,
                    "isDefault": true,
                    "status": 200,
                    "behavior": { "fault": fault, "delayMs": 0, "jitterMs": 0 }
                }]
            }]
        }));
        let out = handle_captured_request(&def, &get("/boom"), &mut EngineRuntime::default());
        assert!(out.drop_response, "{fault}");
        assert_eq!(out.outcome, "fault");
        assert!(out.dribble_chunks.is_empty());
    }
}

#[test]
fn dribble_fault_splits_body() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/slow" },
            "responses": [{
                "id": "resp-1",
                "enabled": true,
                "isDefault": true,
                "status": 200,
                "body": { "kind": "text", "content": "abcdef", "contentType": "text/plain" },
                "behavior": { "fault": "dribble", "delayMs": 0, "jitterMs": 0 }
            }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/slow"), &mut EngineRuntime::default());
    assert!(!out.drop_response);
    assert_eq!(out.outcome, "fault");
    assert_eq!(out.dribble_chunks.len(), 2);
    let joined: String = out.dribble_chunks.iter().map(|(_, p)| p.as_str()).collect();
    assert_eq!(joined, "abcdef");
}

#[test]
fn dribble_schedule_accepts_float_after_ms() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/slow" },
            "responses": [{
                "id": "resp-1",
                "enabled": true,
                "isDefault": true,
                "status": 200,
                "body": { "kind": "text", "content": "ab", "contentType": "text/plain" },
                "behavior": {
                    "fault": "dribble",
                    "delayMs": 0,
                    "jitterMs": 0,
                    "chunkSchedule": [
                        { "afterMs": 20.9, "body": "a" },
                        { "afterMs": 40.1, "body": "b" }
                    ]
                }
            }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/slow"), &mut EngineRuntime::default());
    assert_eq!(out.dribble_chunks, vec![(20, "a".into()), (40, "b".into())]);
}

#[test]
fn unmatched_proxy_sets_needs_proxy() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "settings": {
            "fallback": { "mode": "proxy" },
            "proxy": { "enabled": true, "allowlist": ["https://api.example.com"] }
        },
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/users" },
            "responses": [{ "id": "resp-1", "enabled": true, "isDefault": true, "status": 200 }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/nope"), &mut EngineRuntime::default());
    assert!(out.needs_proxy);
    assert_eq!(out.outcome, "unmatched");
    assert_eq!(out.status, 0);
    assert!(out.body.is_empty());
}

#[test]
fn unmatched_proxy_disabled_uses_fallback() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "settings": {
            "fallback": { "mode": "proxy", "unmatchedResponse": { "status": 404 } },
            "proxy": { "enabled": false }
        },
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/users" },
            "responses": [{ "id": "resp-1", "enabled": true, "isDefault": true, "status": 200 }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/nope"), &mut EngineRuntime::default());
    assert!(!out.needs_proxy);
    assert_eq!(out.outcome, "unmatched");
    assert_eq!(out.status, 404);
}

#[test]
fn matched_route_without_variant_uses_proxy() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 4600,
        "settings": {
            "fallback": { "mode": "proxy" },
            "proxy": { "enabled": true, "allowlist": ["https://api.example.com"] }
        },
        "routes": [{
            "id": "route-1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/users" },
            "responses": [{ "id": "resp-1", "enabled": false, "isDefault": true, "status": 200 }]
        }]
    }));
    let out = handle_captured_request(&def, &get("/users"), &mut EngineRuntime::default());
    assert!(out.needs_proxy);
    assert_eq!(out.matched_route_id.as_deref(), Some("route-1"));
}

#[test]
fn legacy_proxy_json_deserializes_defaults() {
    let def = def(serde_json::json!({
        "id": "s",
        "port": 1,
        "settings": { "proxy": { "enabled": true } },
        "routes": []
    }));
    let p = def.settings.proxy.unwrap();
    assert!(p.enabled);
    assert!(p.block_private_networks);
    assert_eq!(p.max_redirects, 5);
    assert!(p.strip_hop_by_hop);
    assert!(!p.forward_auth);
    assert_eq!(p.timeout_ms, 10_000);
    assert_eq!(p.max_response_bytes, 1_048_576);
    assert!(p.record_as_drafts);
    assert!(p.allowlist.is_empty());
}
