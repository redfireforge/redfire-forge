use crate::api_mock::predicates::{evaluate_predicate_group, evaluate_route};
use crate::api_mock::types::{
    CapturedRequest, PathMatcher, Predicate, PredicateGroup, PredicateNode, PredicateOptions, Route,
    Variant,
};

fn request(path: &str) -> CapturedRequest {
    CapturedRequest {
        method: "GET".into(),
        path: path.into(),
        raw_path: path.into(),
        received_at: "2026-08-11T00:00:00.000Z".into(),
        ..Default::default()
    }
}

fn route_with(pred: Predicate) -> Route {
    Route {
        id: "r1".into(),
        name: "R".into(),
        enabled: true,
        method: "GET".into(),
        path: PathMatcher {
            kind: "exact".into(),
            value: "/data".into(),
            flags: None,
        },
        priority: 10,
        predicates: PredicateGroup {
            id: "g".into(),
            combinator: "all".into(),
            children: vec![PredicateNode::Leaf(pred)],
        },
        response_mode: "rules".into(),
        responses: vec![Variant {
            id: "v1".into(),
            enabled: true,
            is_default: true,
            status: 200,
            ..serde_json::from_value(serde_json::json!({"id":"v1"})).unwrap()
        }],
    }
}

#[test]
fn header_exact_matches() {
    let mut req = request("/data");
    req.headers
        .insert("x-tenant".into(), vec!["acme".into()]);
    let pred = Predicate {
        id: "p1".into(),
        source: "header".into(),
        selector: Some("x-tenant".into()),
        operator: "exact".into(),
        expected: Some(serde_json::json!("acme")),
        options: Some(PredicateOptions {
            case_sensitive: Some(false),
            ..Default::default()
        }),
    };
    let eval = evaluate_route(&route_with(pred), &req, "");
    assert!(eval.overall_match);
}

#[test]
fn unavailable_operator_fail_closes_not() {
    let pred = Predicate {
        id: "p1".into(),
        source: "body".into(),
        selector: None,
        operator: "xpath_exists".into(),
        expected: Some(serde_json::json!("//a")),
        options: None,
    };
    let group = PredicateGroup {
        id: "g".into(),
        combinator: "not".into(),
        children: vec![PredicateNode::Leaf(pred)],
    };
    assert!(!evaluate_predicate_group(&group, &request("/"), &Default::default()));
}

#[test]
fn method_any_matches_post() {
    let mut route = route_with(Predicate {
        id: "p".into(),
        source: "query".into(),
        selector: Some("q".into()),
        operator: "present".into(),
        expected: None,
        options: None,
    });
    route.method = "ANY".into();
    route.predicates.children.clear();
    let mut req = request("/data");
    req.method = "POST".into();
    assert!(evaluate_route(&route, &req, "").overall_match);
}

#[test]
fn json_leaf_predicate_fails_when_header_is_missing() {
    let route: Route = serde_json::from_value(serde_json::json!({
        "id": "r1",
        "name": "R",
        "enabled": true,
        "method": "GET",
        "path": { "kind": "exact", "value": "/data" },
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
        "responses": [{ "id": "v1", "enabled": true, "isDefault": true, "status": 200 }]
    }))
    .unwrap();
    assert!(!evaluate_route(&route, &request("/data"), "").overall_match);
    let mut req = request("/data");
    req.headers.insert("x-tenant".into(), vec!["acme".into()]);
    assert!(evaluate_route(&route, &req, "").overall_match);
}

#[test]
fn json_path_exists_treats_explicit_null_as_present() {
    let pred = Predicate {
        id: "p1".into(),
        source: "body".into(),
        selector: None,
        operator: "jsonPath_exists".into(),
        expected: Some(serde_json::json!("$.a")),
        options: None,
    };
    let mut req = request("/data");
    req.body = Some("{\"a\":null}".into());
    assert!(evaluate_route(&route_with(pred), &req, "").overall_match);
}

#[test]
fn json_path_equals_accepts_studio_array_form() {
    let pred = Predicate {
        id: "p1".into(),
        source: "body".into(),
        selector: None,
        operator: "jsonPath_equals".into(),
        expected: Some(serde_json::json!(["$.role", "admin"])),
        options: None,
    };
    let mut req = request("/data");
    req.body = Some("{\"role\":\"admin\"}".into());
    assert!(evaluate_route(&route_with(pred), &req, "").overall_match);
}

#[test]
fn header_exact_matches_any_repeated_value() {
    let mut req = request("/data");
    req.headers
        .insert("x-tenant".into(), vec!["other".into(), "acme".into()]);
    let pred = Predicate {
        id: "p1".into(),
        source: "header".into(),
        selector: Some("x-tenant".into()),
        operator: "exact".into(),
        expected: Some(serde_json::json!("acme")),
        options: Some(PredicateOptions {
            case_sensitive: Some(false),
            ..Default::default()
        }),
    };
    assert!(evaluate_route(&route_with(pred), &req, "").overall_match);
}

#[test]
fn form_field_exact_accepts_studio_array_form() {
    let pred = Predicate {
        id: "p1".into(),
        source: "body".into(),
        selector: None,
        operator: "form_field_exact".into(),
        expected: Some(serde_json::json!(["username", "admin"])),
        options: None,
    };
    let mut req = request("/data");
    req.body = Some("username=admin&x=1".into());
    assert!(evaluate_route(&route_with(pred), &req, "").overall_match);
}

#[test]
fn form_field_present_accepts_name_only_array() {
    let pred = Predicate {
        id: "p1".into(),
        source: "body".into(),
        selector: None,
        operator: "form_field_present".into(),
        expected: Some(serde_json::json!(["csrf"])),
        options: None,
    };
    let mut req = request("/data");
    req.body = Some("csrf=token".into());
    assert!(evaluate_route(&route_with(pred), &req, "").overall_match);
}
