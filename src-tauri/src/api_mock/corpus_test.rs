use crate::api_mock::engine::{handle_captured_request, EngineRuntime};
use crate::api_mock::types::{CapturedRequest, ServerDefinition};
use serde_json::Value;

const BASIC: &str = include_str!("../../../docs/plan/future/apimock/fixtures/conformance-seed-basic.json");
const ADVANCED: &str =
    include_str!("../../../docs/plan/future/apimock/fixtures/conformance-seed-advanced.json");

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    id: String,
    server: ServerSlice,
    request: CapturedRequest,
    expected: Expected,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ServerSlice {
    settings: Option<Value>,
    routes: Vec<Value>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Expected {
    outcome: String,
    matched_route_id: Option<String>,
    status: Option<u16>,
}

fn run_file(raw: &str) {
    let cases: Vec<Case> = serde_json::from_str(raw).unwrap();
    for case in cases {
        let mut def_json = serde_json::json!({
            "id": case.id,
            "port": 4600,
            "routes": case.server.routes,
        });
        if let Some(settings) = case.server.settings {
            def_json["settings"] = settings;
        }
        let def: ServerDefinition = serde_json::from_value(def_json).unwrap();
        let out = handle_captured_request(&def, &case.request, &mut EngineRuntime::default());
        assert_eq!(out.outcome, case.expected.outcome, "{}", case.id);
        if let Some(route) = case.expected.matched_route_id {
            assert_eq!(out.matched_route_id.as_deref(), Some(route.as_str()), "{}", case.id);
        }
        if let Some(status) = case.expected.status {
            assert_eq!(out.status, status, "{}", case.id);
        }
    }
}

#[test]
fn basic_corpus() {
    run_file(BASIC);
}

#[test]
fn advanced_corpus() {
    run_file(ADVANCED);
}
