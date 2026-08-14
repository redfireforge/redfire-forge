//! Deterministic route selection (parity with routeSelector.ts).

use crate::api_mock::predicates::{evaluate_route, RouteEvaluation};
use crate::api_mock::types::{CapturedRequest, Route, ServerSettings, Variant};

pub struct SelectionResult {
    pub outcome: String,
    pub selected_route_id: Option<String>,
    pub selected_response_id: Option<String>,
    pub evaluations: Vec<RouteEvaluation>,
}

pub fn select_route(
    routes: &[Route],
    request: &CapturedRequest,
    settings: &ServerSettings,
    base_path: &str,
) -> SelectionResult {
    let evaluations: Vec<RouteEvaluation> = routes
        .iter()
        .map(|r| evaluate_route(r, request, base_path))
        .collect();
    let matched: Vec<&RouteEvaluation> = evaluations.iter().filter(|e| e.overall_match).collect();

    if matched.is_empty() {
        return SelectionResult {
            outcome: "unmatched".into(),
            selected_route_id: None,
            selected_response_id: None,
            evaluations,
        };
    }

    if matched.len() > 1 && settings.selection.multiple_match_policy == "reject_multiple" {
        return SelectionResult {
            outcome: "ambiguous".into(),
            selected_route_id: None,
            selected_response_id: None,
            evaluations,
        };
    }

    let highest = matched.iter().map(|m| m.priority).max().unwrap_or(0);
    let mut at_highest: Vec<&RouteEvaluation> =
        matched.into_iter().filter(|m| m.priority == highest).collect();

    if at_highest.len() > 1 {
        if settings.selection.equal_priority_policy == "reject" {
            return SelectionResult {
                outcome: "ambiguous".into(),
                selected_route_id: None,
                selected_response_id: None,
                evaluations,
            };
        }
        at_highest.sort_by(|a, b| {
            let spec_a = specificity(routes, a);
            let spec_b = specificity(routes, b);
            spec_b
                .cmp(&spec_a)
                .then_with(|| a.route_id.cmp(&b.route_id))
        });
    }

    let winner = at_highest[0];
    let route = routes.iter().find(|r| r.id == winner.route_id);
    let selected_response = route.and_then(select_default_response);
    SelectionResult {
        outcome: "matched".into(),
        selected_route_id: Some(winner.route_id.clone()),
        selected_response_id: selected_response.map(|v| v.id.clone()),
        evaluations,
    }
}

fn select_default_response(route: &Route) -> Option<&Variant> {
    if route.response_mode != "rules" {
        return route.responses.first();
    }
    let enabled: Vec<&Variant> = route.responses.iter().filter(|r| r.enabled).collect();
    enabled
        .iter()
        .copied()
        .find(|r| r.is_default)
        .or_else(|| enabled.first().copied())
}

fn specificity(routes: &[Route], evaluation: &RouteEvaluation) -> i32 {
    let Some(route) = routes.iter().find(|r| r.id == evaluation.route_id) else {
        return 0;
    };
    let mut score = 0;
    score += if route.method.eq_ignore_ascii_case("ANY") { 1 } else { 10 };
    match route.path.kind.as_str() {
        "exact" => score += 50,
        "parameterized" => score += 30,
        "glob" => score += 15,
        "regex" => score += 10,
        _ => {}
    }
    for result in &evaluation.predicate_results {
        if !result.passed {
            continue;
        }
        score += match result.operator.as_str() {
            "exact" => 8,
            "contains" | "prefix" | "suffix" => 5,
            "present" | "absent" => 2,
            "regex" | "glob" => 3,
            "json_strict" => 10,
            "json_subset" => 7,
            "jsonPath_exists" | "jsonPath_equals" => 6,
            _ => 1,
        };
    }
    score
}
