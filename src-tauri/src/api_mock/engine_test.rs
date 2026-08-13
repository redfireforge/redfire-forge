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
