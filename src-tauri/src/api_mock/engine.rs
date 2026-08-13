//! Pure request handling: select + render + scenario/sequence (no sockets).

use crate::api_mock::predicates::evaluate_predicate_group;
use crate::api_mock::render::render_variant;
use crate::api_mock::select::select_route;
use crate::api_mock::types::{
    CapturedRequest, ScenarioState, SequenceState, ServerDefinition, StateTransition, Variant,
};
use serde_json::{json, Value};
use std::collections::HashMap;

const DEFAULT_STATE_KEY: &str = "default";

#[derive(Debug, Clone, Default)]
#[allow(dead_code)]
pub struct EngineRuntime {
    pub scenario: ScenarioState,
    pub sequence: SequenceState,
    pub variant_match_counts: HashMap<String, u32>,
    pub generation: u64,
}

pub struct EngineOutcome {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
    pub outcome: String,
    pub matched_route_id: Option<String>,
    pub matched_response_id: Option<String>,
    pub explanation: Value,
    pub delay_ms: u64,
    #[allow(dead_code)]
    pub fault: Option<String>,
    pub drop_response: bool,
    /// Applied after delay (parity with the Node listener `deliver()` path).
    pub pending_transition: Option<StateTransition>,
}

impl EngineRuntime {
    pub fn apply_pending_transition(&mut self, t: &StateTransition) {
        apply_transition(&mut self.scenario, t);
    }
}

pub fn handle_captured_request(
    def: &ServerDefinition,
    request: &CapturedRequest,
    runtime: &mut EngineRuntime,
) -> EngineOutcome {
    let selection = select_route(&def.routes, request, &def.settings, &def.base_path);
    let matched_count = selection.evaluations.iter().filter(|e| e.overall_match).count();
    let highest = selection
        .evaluations
        .iter()
        .filter(|e| e.overall_match)
        .map(|e| e.priority)
        .max()
        .unwrap_or(0);
    let tied = selection
        .evaluations
        .iter()
        .filter(|e| e.overall_match && e.priority == highest)
        .count();
    let mut near_misses: Vec<Value> = selection
        .evaluations
        .iter()
        .filter(|e| e.enabled && !e.overall_match && (e.method_match || e.path_match))
        .map(|e| {
            json!({
                "routeId": e.route_id,
                "routeName": e.route_name,
                "failedPredicates": e.predicate_results.iter().filter(|p| !p.passed).map(|p| json!({
                    "predicateId": p.predicate_id,
                    "source": p.source,
                    "reason": p.reason.clone().unwrap_or_else(|| "failed".into()),
                })).collect::<Vec<_>>(),
                "missDistance": e.predicate_results.iter().filter(|p| p.passed).count(),
            })
        })
        .collect();
    near_misses.sort_by(|a, b| {
        let da = a["missDistance"].as_u64().unwrap_or(0);
        let db = b["missDistance"].as_u64().unwrap_or(0);
        db.cmp(&da)
    });
    let explanation = json!({
        "normalizedRequest": {
            "method": request.method,
            "path": request.path,
            "decodedPath": request.path,
            "pathSegments": request.path.split('/').filter(|s| !s.is_empty()).collect::<Vec<_>>(),
            "query": request.query,
            "headerKeys": sorted_keys(&request.headers),
            "cookieKeys": sorted_keys_map(&request.cookies),
            "bodyContentType": request.content_type,
            "bodySizeBytes": request.body.as_ref().map(|b| b.len()).unwrap_or(0),
        },
        "candidates": selection.evaluations.iter().map(|e| json!({
            "routeId": e.route_id,
            "routeName": e.route_name,
            "priority": e.priority,
            "enabled": e.enabled,
            "methodMatch": e.method_match,
            "pathMatch": e.path_match,
            "predicateResults": e.predicate_results.iter().map(|p| json!({
                "predicateId": p.predicate_id,
                "groupId": "",
                "source": p.source,
                "operator": p.operator,
                "passed": p.passed,
                "evaluated": p.evaluated,
                "reason": p.reason,
            })).collect::<Vec<_>>(),
            "overallMatch": e.overall_match,
        })).collect::<Vec<_>>(),
        "policyDecision": {
            "policy": def.settings.selection.multiple_match_policy,
            "equalPriorityPolicy": def.settings.selection.equal_priority_policy,
            "matchedCount": matched_count,
            "highestPriority": highest,
            "tiedAtHighest": tied,
            "outcome": selection.outcome,
            "selectedRouteId": selection.selected_route_id,
            "selectedResponseId": selection.selected_response_id,
        },
        "nearMisses": near_misses,
    });

    if selection.outcome == "ambiguous" {
        let amb = &def.settings.selection.ambiguity_response;
        return EngineOutcome {
            status: amb.status,
            headers: static_headers(amb),
            body: amb.body.clone(),
            outcome: "ambiguous".into(),
            matched_route_id: None,
            matched_response_id: None,
            explanation,
            delay_ms: 0,
            fault: None,
            drop_response: false,
            pending_transition: None,
        };
    }

    if selection.outcome != "matched" {
        if def.settings.fallback.mode == "closest_match_debug" {
            let fb = &def.settings.fallback.unmatched_response;
            let debug_misses: Vec<Value> = near_misses
                .iter()
                .take(5)
                .map(|nm| {
                    let failed: Vec<Value> = nm
                        .get("failedPredicates")
                        .and_then(|v| v.as_array())
                        .cloned()
                        .unwrap_or_default()
                        .into_iter()
                        .take(8)
                        .map(|fp| {
                            json!({
                                "source": fp.get("source").cloned().unwrap_or(json!("")),
                                "reason": fp.get("reason").cloned().unwrap_or(json!("failed")),
                            })
                        })
                        .collect();
                    json!({
                        "routeId": nm.get("routeId").cloned().unwrap_or(json!("")),
                        "routeName": nm.get("routeName").cloned().unwrap_or(json!("")),
                        "missDistance": nm.get("missDistance").cloned().unwrap_or(json!(0)),
                        "failedPredicates": failed,
                    })
                })
                .collect();
            let hint = if debug_misses.is_empty() {
                "No near-miss candidates; check method, path, or base path."
            } else {
                "Closest candidates matched method/path but failed conditions."
            };
            let payload = json!({
                "error": "not_found",
                "mode": "closest_match_debug",
                "request": {
                    "method": request.method,
                    "path": request.path,
                },
                "nearMissCount": near_misses.len(),
                "nearMisses": debug_misses,
                "hint": hint,
            });
            let body = serde_json::to_string_pretty(&payload).unwrap_or_else(|_| payload.to_string());
            let mut headers = static_headers(fb);
            if !headers
                .iter()
                .any(|(k, _)| k.eq_ignore_ascii_case("content-type"))
            {
                headers.push(("Content-Type".into(), "application/json".into()));
            }
            return EngineOutcome {
                status: if fb.status == 0 { 404 } else { fb.status },
                headers,
                body,
                outcome: "unmatched".into(),
                matched_route_id: None,
                matched_response_id: None,
                explanation,
                delay_ms: 0,
                fault: None,
                drop_response: false,
                pending_transition: None,
            };
        }
        let fb = &def.settings.fallback.unmatched_response;
        return EngineOutcome {
            status: fb.status,
            headers: static_headers(fb),
            body: fb.body.clone(),
            outcome: "unmatched".into(),
            matched_route_id: None,
            matched_response_id: None,
            explanation,
            delay_ms: 0,
            fault: None,
            drop_response: false,
            pending_transition: None,
        };
    }

    let route_id = selection.selected_route_id.clone().unwrap();
    let route = def.routes.iter().find(|r| r.id == route_id).unwrap();
    let path_params = selection
        .evaluations
        .iter()
        .find(|e| e.route_id == route_id)
        .map(|e| e.path_params.clone())
        .unwrap_or_default();
    let variant = pick_variant(route, request, &path_params, runtime);
    let Some(variant) = variant else {
        let fb = &def.settings.fallback.unmatched_response;
        return EngineOutcome {
            status: fb.status,
            headers: static_headers(fb),
            body: fb.body.clone(),
            outcome: "unmatched".into(),
            matched_route_id: Some(route_id),
            matched_response_id: None,
            explanation,
            delay_ms: 0,
            fault: None,
            drop_response: false,
            pending_transition: None,
        };
    };

    *runtime
        .variant_match_counts
        .entry(variant.id.clone())
        .or_insert(0) += 1;

    let render_seed = format!("{}:{}", request.received_at, route.id);
    let delay_seed = format!("{}:{}:{}", request.received_at, route.id, request.path);
    let rendered = render_variant(variant, request, route, def, &runtime.scenario, &render_seed);
    let delay_ms = compute_delay_ms(variant, def.settings.limits.max_delay_ms, &delay_seed);
    let fault = variant.behavior.fault.clone().filter(|f| f != "none");
    let drop_response = matches!(fault.as_deref(), Some("timeout" | "close"));

    EngineOutcome {
        status: rendered.status,
        headers: rendered.headers,
        body: rendered.body,
        outcome: if fault.is_some() { "fault".into() } else { "matched".into() },
        matched_route_id: Some(route.id.clone()),
        matched_response_id: Some(variant.id.clone()),
        explanation,
        delay_ms,
        fault,
        drop_response,
        pending_transition: variant.transition.clone(),
    }
}

fn pick_variant<'a>(
    route: &'a crate::api_mock::types::Route,
    request: &CapturedRequest,
    path_params: &HashMap<String, String>,
    runtime: &mut EngineRuntime,
) -> Option<&'a Variant> {
    let enabled: Vec<&Variant> = route.responses.iter().filter(|v| v.enabled).collect();
    if enabled.is_empty() {
        return None;
    }
    let seed = format!("{}:{}:{}", request.received_at, route.id, request.path);
    let selected = match route.response_mode.as_str() {
        "sequence" => {
            let idx = runtime.sequence.positions.entry(route.id.clone()).or_insert(0);
            let chosen = enabled.get(*idx % enabled.len()).copied();
            *idx += 1;
            chosen
        }
        "weighted" => pick_weighted(&enabled, &seed),
        "state" => {
            let current = runtime
                .scenario
                .states
                .get(DEFAULT_STATE_KEY)
                .cloned()
                .unwrap_or_default();
            enabled
                .iter()
                .copied()
                .find(|v| {
                    v.transition
                        .as_ref()
                        .and_then(|t| t.current_state.as_ref())
                        .is_some_and(|g| g == &current)
                })
                .or_else(|| {
                    enabled.iter().copied().find(|v| {
                        v.transition
                            .as_ref()
                            .and_then(|t| t.current_state.as_ref())
                            .is_none()
                    })
                })
        }
        _ => enabled
            .iter()
            .copied()
            .find(|v| {
                !v.is_default
                    && v.conditions.as_ref().is_some_and(|c| {
                        !c.children.is_empty() && evaluate_predicate_group(c, request, path_params)
                    })
            })
            .or_else(|| enabled.iter().copied().find(|v| v.is_default))
            .or_else(|| enabled.first().copied()),
    };
    selected.map(|v| apply_eligibility(route, v, runtime, &seed))
}

fn apply_eligibility<'a>(
    route: &'a crate::api_mock::types::Route,
    selected: &'a Variant,
    runtime: &EngineRuntime,
    seed: &str,
) -> &'a Variant {
    if variant_eligible(selected, runtime, seed) {
        return selected;
    }
    route
        .responses
        .iter()
        .find(|v| {
            v.enabled && v.id != selected.id && variant_eligible(v, runtime, seed)
        })
        .unwrap_or(selected)
}

fn variant_eligible(variant: &Variant, runtime: &EngineRuntime, seed: &str) -> bool {
    let count = runtime
        .variant_match_counts
        .get(&variant.id)
        .copied()
        .unwrap_or(0);
    if let Some(max) = variant.behavior.max_matches {
        if count >= max {
            return false;
        }
    }
    if let Some(expires) = variant.behavior.expires_at.as_deref() {
        if let Ok(when) = chrono::DateTime::parse_from_rfc3339(expires) {
            if chrono::Utc::now() >= when.with_timezone(&chrono::Utc) {
                return false;
            }
        }
    }
    if let Some(prob) = variant.behavior.probability {
        if prob < 1.0 {
            let roll = seeded_js(&format!("{seed}:prob"), 0, 10_000) as f64 / 10_000.0;
            if roll > prob {
                return false;
            }
        }
    }
    true
}

fn pick_weighted<'a>(enabled: &[&'a Variant], seed: &str) -> Option<&'a Variant> {
    let eligible: Vec<&Variant> = enabled
        .iter()
        .copied()
        .filter(|v| v.weight.unwrap_or(0.0) > 0.0)
        .collect();
    if eligible.is_empty() {
        return enabled.first().copied();
    }
    let total: f64 = eligible.iter().map(|v| v.weight.unwrap_or(0.0)).sum();
    if total <= 0.0 {
        return eligible.first().copied();
    }
    let max_roll = (total.floor() as i64 - 1).max(0);
    let roll = seeded_js(seed, 0, max_roll) as f64;
    let mut cumulative = 0.0;
    for variant in &eligible {
        cumulative += variant.weight.unwrap_or(0.0);
        if roll < cumulative {
            return Some(*variant);
        }
    }
    eligible.last().copied()
}

fn compute_delay_ms(variant: &Variant, max_delay_ms: u64, seed: &str) -> u64 {
    let cap = if max_delay_ms == 0 {
        60_000
    } else {
        max_delay_ms
    };
    let base = variant.behavior.delay_ms.min(cap);
    let jitter_cap = variant.behavior.jitter_ms.min(cap);
    if jitter_cap == 0 {
        return base;
    }
    let delta = seeded_js(&format!("{seed}:jitter"), -(jitter_cap as i64), jitter_cap as i64);
    (base as i64 + delta).clamp(0, cap as i64) as u64
}

fn seeded_js(seed: &str, min: i64, max: i64) -> i64 {
    if max < min {
        return min;
    }
    let mut hash: i32 = 0;
    for ch in seed.chars() {
        hash = hash
            .wrapping_shl(5)
            .wrapping_sub(hash)
            .wrapping_add(ch as u32 as i32);
    }
    let span = max - min + 1;
    min + ((hash as u32 & 0x7fff_ffff) as i64 % span)
}

fn apply_transition(scenario: &mut ScenarioState, t: &StateTransition) {
    let current = scenario
        .states
        .get(DEFAULT_STATE_KEY)
        .cloned()
        .unwrap_or_default();
    if let Some(guard) = &t.current_state {
        if guard != &current {
            return;
        }
    }
    scenario
        .states
        .insert(DEFAULT_STATE_KEY.into(), t.target_state.clone());
    if let Some(updates) = &t.counter_updates {
        for u in updates {
            *scenario.counters.entry(u.key.clone()).or_insert(0) += u.delta;
        }
    }
}

fn static_headers(resp: &crate::api_mock::types::StaticResponse) -> Vec<(String, String)> {
    let mut headers: Vec<(String, String)> = resp
        .headers
        .iter()
        .filter(|h| h.enabled && !h.key.is_empty())
        .map(|h| (h.key.clone(), h.value.clone()))
        .collect();
    if let Some(ct) = &resp.content_type {
        if !headers
            .iter()
            .any(|(k, _)| k.eq_ignore_ascii_case("content-type"))
        {
            headers.push(("Content-Type".into(), ct.clone()));
        }
    }
    headers
}

fn sorted_keys(map: &HashMap<String, Vec<String>>) -> Vec<String> {
    let mut k: Vec<_> = map.keys().cloned().collect();
    k.sort();
    k
}

fn sorted_keys_map(map: &HashMap<String, String>) -> Vec<String> {
    let mut k: Vec<_> = map.keys().cloned().collect();
    k.sort();
    k
}
