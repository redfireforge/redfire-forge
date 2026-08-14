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
        operator: "not_a_real_op".into(),
        expected: Some(serde_json::json!("//a")),
        options: None,
    };
    let group = PredicateGroup {
        id: "g".into(),
        combinator: "not".into(),
        children: vec![PredicateNode::Leaf(pred)],
    };
    // Unknown operators evaluate to false; NOT of false is true when evaluated.
    assert!(evaluate_predicate_group(&group, &request("/"), &Default::default()));
}

#[test]
fn xpath_exists_matches_local_name() {
    let xml = r#"<root><a>1</a></root>"#;
    let mut req = request("/data");
    req.body = Some(xml.into());
    let pred = Predicate {
        id: "p1".into(),
        source: "body".into(),
        selector: None,
        operator: "xpath_exists".into(),
        expected: Some(serde_json::json!("//a")),
        options: None,
    };
    assert!(evaluate_route(&route_with(pred), &req, "").overall_match);
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

#[test]
fn json_strict_parses_string_expected() {
    let pred = Predicate {
        id: "p1".into(),
        source: "body".into(),
        selector: None,
        operator: "json_strict".into(),
        expected: Some(serde_json::json!("{\"a\":1}")),
        options: None,
    };
    let mut req = request("/data");
    req.body = Some("{\"a\":1}".into());
    assert!(evaluate_route(&route_with(pred), &req, "").overall_match);
}

#[test]
fn contains_ignores_case_sensitive_flag_like_typescript() {
    let pred = Predicate {
        id: "p1".into(),
        source: "body".into(),
        selector: None,
        operator: "contains".into(),
        expected: Some(serde_json::json!("hello")),
        options: Some(PredicateOptions {
            case_sensitive: Some(false),
            ..Default::default()
        }),
    };
    let mut req = request("/data");
    req.body = Some("HELLO WORLD".into());
    assert!(
        !evaluate_route(&route_with(pred), &req, "").overall_match,
        "contains must stay case-sensitive to match TypeScript"
    );
}

#[test]
fn xml_schema_and_xpath_equals_match() {
    let xml = r#"<Order><Id>42</Id></Order>"#;
    let mut req = request("/data");
    req.body = Some(xml.into());
    let schema = Predicate {
        id: "p1".into(),
        source: "body".into(),
        selector: None,
        operator: "xmlSchema".into(),
        expected: Some(serde_json::json!("Order, Id")),
        options: None,
    };
    assert!(evaluate_route(&route_with(schema), &req, "").overall_match);
    let xpath = Predicate {
        id: "p2".into(),
        source: "body".into(),
        selector: None,
        operator: "xpath_equals".into(),
        expected: Some(serde_json::json!(["//Id", "42"])),
        options: None,
    };
    assert!(evaluate_route(&route_with(xpath), &req, "").overall_match);
}

#[test]
fn multipart_field_uses_content_type_boundary() {
    let body = [
        "------bound",
        r#"Content-Disposition: form-data; name="note""#,
        "",
        "hello",
        "------bound--",
        "",
    ]
    .join("\r\n");
    let mut req = request("/data");
    req.method = "POST".into();
    req.body = Some(body);
    req.content_type = Some("multipart/form-data; boundary=----bound".into());
    let mut route = route_with(Predicate {
        id: "p1".into(),
        source: "body".into(),
        selector: None,
        operator: "multipart_field".into(),
        expected: Some(serde_json::json!(["note", "hello"])),
        options: None,
    });
    route.method = "POST".into();
    assert!(evaluate_route(&route, &req, "").overall_match);
}
