use crate::api_mock::select::select_route;
use crate::api_mock::types::{CapturedRequest, ServerSettings};

fn def_routes(json: serde_json::Value) -> (Vec<crate::api_mock::types::Route>, ServerSettings) {
    let def: crate::api_mock::types::ServerDefinition = serde_json::from_value(json).unwrap();
    (def.routes, def.settings)
}

#[test]
fn highest_priority_wins() {
    let (routes, settings) = def_routes(serde_json::json!({
        "id": "s",
        "port": 1,
        "settings": { "selection": { "multipleMatchPolicy": "highest_priority", "equalPriorityPolicy": "reject" } },
        "routes": [
            { "id": "low", "method": "GET", "path": { "kind": "exact", "value": "/items" }, "priority": 5,
              "responses": [{ "id": "a", "enabled": true, "isDefault": true, "status": 200 }] },
            { "id": "high", "method": "GET", "path": { "kind": "exact", "value": "/items" }, "priority": 20,
              "responses": [{ "id": "b", "enabled": true, "isDefault": true, "status": 201 }] }
        ]
    }));
    let req = CapturedRequest {
        method: "GET".into(),
        path: "/items".into(),
        ..Default::default()
    };
    let result = select_route(&routes, &req, &settings, "");
    assert_eq!(result.outcome, "matched");
    assert_eq!(result.selected_route_id.as_deref(), Some("high"));
}

#[test]
fn reject_multiple_is_ambiguous() {
    let (routes, settings) = def_routes(serde_json::json!({
        "id": "s",
        "port": 1,
        "settings": { "selection": { "multipleMatchPolicy": "reject_multiple", "equalPriorityPolicy": "reject" } },
        "routes": [
            { "id": "a", "method": "GET", "path": { "kind": "exact", "value": "/items" }, "priority": 10,
              "responses": [{ "id": "ra", "enabled": true, "isDefault": true, "status": 200 }] },
            { "id": "b", "method": "GET", "path": { "kind": "exact", "value": "/items" }, "priority": 5,
              "responses": [{ "id": "rb", "enabled": true, "isDefault": true, "status": 200 }] }
        ]
    }));
    let req = CapturedRequest {
        method: "GET".into(),
        path: "/items".into(),
        ..Default::default()
    };
    assert_eq!(select_route(&routes, &req, &settings, "").outcome, "ambiguous");
}

#[test]
fn unmatched_when_path_differs() {
    let (routes, settings) = def_routes(serde_json::json!({
        "id": "s",
        "port": 1,
        "routes": [
            { "id": "a", "method": "GET", "path": { "kind": "exact", "value": "/users" },
              "responses": [{ "id": "r", "enabled": true, "isDefault": true, "status": 200 }] }
        ]
    }));
    let req = CapturedRequest {
        method: "GET".into(),
        path: "/nope".into(),
        ..Default::default()
    };
    assert_eq!(select_route(&routes, &req, &settings, "").outcome, "unmatched");
}

#[test]
fn equal_priority_prefers_specific_method_over_any() {
    let (routes, settings) = def_routes(serde_json::json!({
        "id": "s",
        "port": 1,
        "settings": { "selection": { "multipleMatchPolicy": "highest_priority", "equalPriorityPolicy": "specificity_then_id" } },
        "routes": [
            { "id": "any", "method": "ANY", "path": { "kind": "exact", "value": "/items" }, "priority": 10,
              "responses": [{ "id": "a", "enabled": true, "isDefault": true, "status": 200 }] },
            { "id": "get", "method": "GET", "path": { "kind": "exact", "value": "/items" }, "priority": 10,
              "responses": [{ "id": "b", "enabled": true, "isDefault": true, "status": 201 }] }
        ]
    }));
    let req = CapturedRequest {
        method: "GET".into(),
        path: "/items".into(),
        ..Default::default()
    };
    let result = select_route(&routes, &req, &settings, "");
    assert_eq!(result.outcome, "matched");
    assert_eq!(result.selected_route_id.as_deref(), Some("get"));
}
