#[cfg(test)]
mod tests {
    use crate::arrival_executor::compute_current_rps;
    use crate::types::*;

    // ── compute_current_rps ─────────────────────────────────

    #[test]
    fn no_ramp_returns_base_rps() {
        assert_eq!(compute_current_rps(50.0, 0.0, &None), 50.0);
        assert_eq!(compute_current_rps(50.0, 10.0, &None), 50.0);
        assert_eq!(compute_current_rps(50.0, 999.0, &None), 50.0);
    }

    #[test]
    fn ramp_start_returns_start_rps() {
        let ramp = Some(ArrivalRampConfig {
            start_rps: 10.0,
            end_rps: 100.0,
            ramp_duration_sec: 60,
        });
        let rps = compute_current_rps(50.0, 0.0, &ramp);
        assert!((rps - 10.0).abs() < 0.01);
    }

    #[test]
    fn ramp_midpoint_interpolates() {
        let ramp = Some(ArrivalRampConfig {
            start_rps: 10.0,
            end_rps: 100.0,
            ramp_duration_sec: 100,
        });
        let rps = compute_current_rps(50.0, 50.0, &ramp);
        assert!((rps - 55.0).abs() < 0.01, "Expected 55.0 got {rps}");
    }

    #[test]
    fn ramp_at_end_returns_end_rps() {
        let ramp = Some(ArrivalRampConfig {
            start_rps: 10.0,
            end_rps: 100.0,
            ramp_duration_sec: 60,
        });
        let rps = compute_current_rps(50.0, 60.0, &ramp);
        assert!((rps - 100.0).abs() < 0.01);
    }

    #[test]
    fn ramp_past_end_returns_end_rps() {
        let ramp = Some(ArrivalRampConfig {
            start_rps: 10.0,
            end_rps: 100.0,
            ramp_duration_sec: 60,
        });
        let rps = compute_current_rps(50.0, 120.0, &ramp);
        assert!((rps - 100.0).abs() < 0.01);
    }

    #[test]
    fn ramp_zero_duration_returns_end_rps() {
        let ramp = Some(ArrivalRampConfig {
            start_rps: 10.0,
            end_rps: 100.0,
            ramp_duration_sec: 0,
        });
        let rps = compute_current_rps(50.0, 0.0, &ramp);
        assert!((rps - 100.0).abs() < 0.01);
    }

    #[test]
    fn ramp_down_interpolates_correctly() {
        let ramp = Some(ArrivalRampConfig {
            start_rps: 100.0,
            end_rps: 10.0,
            ramp_duration_sec: 100,
        });
        let rps = compute_current_rps(50.0, 50.0, &ramp);
        assert!((rps - 55.0).abs() < 0.01, "Expected 55.0 got {rps}");
    }

    #[test]
    fn ramp_negative_start_clamped_to_zero() {
        let ramp = Some(ArrivalRampConfig {
            start_rps: -10.0,
            end_rps: 50.0,
            ramp_duration_sec: 100,
        });
        let rps = compute_current_rps(50.0, 0.0, &ramp);
        assert!((rps - 0.0).abs() < 0.01, "Expected 0.0 got {rps}");
    }

    #[test]
    fn ramp_negative_end_clamped_to_zero() {
        let ramp = Some(ArrivalRampConfig {
            start_rps: 50.0,
            end_rps: -10.0,
            ramp_duration_sec: 100,
        });
        let rps = compute_current_rps(50.0, 100.0, &ramp);
        assert!((rps - 0.0).abs() < 0.01, "Expected 0.0 got {rps}");
    }

    #[test]
    fn ramp_quarter_point() {
        let ramp = Some(ArrivalRampConfig {
            start_rps: 0.0,
            end_rps: 100.0,
            ramp_duration_sec: 100,
        });
        let rps = compute_current_rps(50.0, 25.0, &ramp);
        assert!((rps - 25.0).abs() < 0.01, "Expected 25.0 got {rps}");
    }

    #[test]
    fn compute_current_rps_nan_input_returns_nan() {
        let rps = compute_current_rps(f64::NAN, 5.0, &None);
        assert!(rps.is_nan(), "NaN base_rps should propagate");
    }

    #[test]
    fn compute_current_rps_infinity_returns_infinity() {
        let rps = compute_current_rps(f64::INFINITY, 5.0, &None);
        assert!(rps.is_infinite(), "Infinity base_rps should propagate");
    }

    // ── ConstantArrival serde ───────────────────────────────

    #[test]
    fn constant_arrival_plan_serde_roundtrip() {
        let plan = ExecutionPlan::ConstantArrival {
            scenarios: vec![],
            target_rps: 50.0,
            duration_sec: 30,
            max_in_flight: 100,
            timeout_ms: 5000,
            retry_count: 0,
            retry_delay_ms: 0,
            think_time: ThinkTimeConfig::None,
            circuit_breaker: CircuitBreakerConfig::Continue,
            ramp_config: None,
            detail_level: DetailLevel::Full,
        };
        let json = serde_json::to_string(&plan).unwrap();
        assert!(json.contains("\"mode\":\"constant-arrival\""), "mode tag: {json}");
        assert!(json.contains("\"targetRps\":50.0"), "targetRps: {json}");
        assert!(json.contains("\"maxInFlight\":100"), "maxInFlight: {json}");

        let parsed: ExecutionPlan = serde_json::from_str(&json).unwrap();
        match parsed {
            ExecutionPlan::ConstantArrival { target_rps, max_in_flight, duration_sec, .. } => {
                assert_eq!(target_rps, 50.0);
                assert_eq!(max_in_flight, 100);
                assert_eq!(duration_sec, 30);
            }
            _ => panic!("Expected ConstantArrival"),
        }
    }

    #[test]
    fn constant_arrival_with_ramp_serde_roundtrip() {
        let plan = ExecutionPlan::ConstantArrival {
            scenarios: vec![],
            target_rps: 100.0,
            duration_sec: 60,
            max_in_flight: 200,
            timeout_ms: 3000,
            retry_count: 2,
            retry_delay_ms: 500,
            think_time: ThinkTimeConfig::Constant { delay_ms: 100 },
            circuit_breaker: CircuitBreakerConfig::StopFirst,
            ramp_config: Some(ArrivalRampConfig {
                start_rps: 10.0,
                end_rps: 100.0,
                ramp_duration_sec: 30,
            }),
            detail_level: DetailLevel::Sampled,
        };
        let json = serde_json::to_string(&plan).unwrap();
        assert!(json.contains("\"rampConfig\""), "rampConfig present: {json}");
        assert!(json.contains("\"startRps\":10.0"), "startRps: {json}");

        let parsed: ExecutionPlan = serde_json::from_str(&json).unwrap();
        match parsed {
            ExecutionPlan::ConstantArrival { ramp_config, .. } => {
                let rc = ramp_config.unwrap();
                assert_eq!(rc.start_rps, 10.0);
                assert_eq!(rc.end_rps, 100.0);
                assert_eq!(rc.ramp_duration_sec, 30);
            }
            _ => panic!("Expected ConstantArrival"),
        }
    }

    #[test]
    fn constant_arrival_without_ramp_omits_null() {
        let plan = ExecutionPlan::ConstantArrival {
            scenarios: vec![],
            target_rps: 25.0,
            duration_sec: 10,
            max_in_flight: 50,
            timeout_ms: 1000,
            retry_count: 0,
            retry_delay_ms: 0,
            think_time: ThinkTimeConfig::None,
            circuit_breaker: CircuitBreakerConfig::Continue,
            ramp_config: None,
            detail_level: DetailLevel::MetricsOnly,
        };
        let json = serde_json::to_string(&plan).unwrap();
        let parsed: ExecutionPlan = serde_json::from_str(&json).unwrap();
        match parsed {
            ExecutionPlan::ConstantArrival { ramp_config, detail_level, .. } => {
                assert!(ramp_config.is_none());
                assert_eq!(detail_level, DetailLevel::MetricsOnly);
            }
            _ => panic!("Expected ConstantArrival"),
        }
    }

    // ── ArrivalRampConfig serde ─────────────────────────────

    #[test]
    fn arrival_ramp_config_serde_roundtrip() {
        let cfg = ArrivalRampConfig {
            start_rps: 5.0,
            end_rps: 200.0,
            ramp_duration_sec: 120,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"startRps\":5.0"), "camelCase: {json}");
        assert!(json.contains("\"endRps\":200.0"), "camelCase: {json}");
        assert!(json.contains("\"rampDurationSec\":120"), "camelCase: {json}");

        let parsed: ArrivalRampConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.start_rps, 5.0);
        assert_eq!(parsed.end_rps, 200.0);
        assert_eq!(parsed.ramp_duration_sec, 120);
    }

    // ── ProgressBatch new fields ────────────────────────────

    #[test]
    fn progress_batch_new_fields_omitted_when_none() {
        let batch = ProgressBatch {
            completed: 10,
            total: -1,
            results: vec![],
            elapsed_ms: 500.0,
            current_in_flight: 5,
            target_concurrency: 100,
            breaker_tripped: false,
            metrics: None,
            target_rps: None,
            actual_rps: None,
            dropped_requests: None,
        };
        let json = serde_json::to_string(&batch).unwrap();
        assert!(!json.contains("targetRps"), "None fields omitted: {json}");
        assert!(!json.contains("actualRps"), "None fields omitted: {json}");
        assert!(!json.contains("droppedRequests"), "None fields omitted: {json}");
    }

    #[test]
    fn progress_batch_new_fields_present_when_set() {
        let batch = ProgressBatch {
            completed: 50,
            total: -1,
            results: vec![],
            elapsed_ms: 2000.0,
            current_in_flight: 10,
            target_concurrency: 100,
            breaker_tripped: false,
            metrics: None,
            target_rps: Some(50.0),
            actual_rps: Some(48.5),
            dropped_requests: Some(3),
        };
        let json = serde_json::to_string(&batch).unwrap();
        assert!(json.contains("\"targetRps\":50.0"), "targetRps present: {json}");
        assert!(json.contains("\"actualRps\":48.5"), "actualRps present: {json}");
        assert!(json.contains("\"droppedRequests\":3"), "droppedRequests present: {json}");
    }

    #[test]
    fn progress_batch_backward_compat_deserialize_without_new_fields() {
        let json = r#"{
            "completed": 10,
            "total": 100,
            "results": [],
            "elapsedMs": 500.0,
            "currentInFlight": 5,
            "targetConcurrency": 10,
            "breakerTripped": false
        }"#;
        let parsed: ProgressBatch = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.completed, 10);
        assert!(parsed.target_rps.is_none());
        assert!(parsed.actual_rps.is_none());
        assert!(parsed.dropped_requests.is_none());
        assert!(parsed.metrics.is_none());
    }

    // ── ConstantArrival deserialization from JS payloads ─────

    #[test]
    fn constant_arrival_from_js_payload() {
        let json = r#"{
            "mode": "constant-arrival",
            "scenarios": [],
            "targetRps": 100.0,
            "durationSec": 30,
            "maxInFlight": 200,
            "timeoutMs": 5000,
            "retryCount": 0,
            "retryDelayMs": 0,
            "thinkTime": {"type": "none"},
            "circuitBreaker": {"policy": "continue"},
            "rampConfig": null,
            "detailLevel": "sampled"
        }"#;
        let parsed: ExecutionPlan = serde_json::from_str(json).unwrap();
        match parsed {
            ExecutionPlan::ConstantArrival {
                target_rps,
                duration_sec,
                max_in_flight,
                ramp_config,
                detail_level,
                ..
            } => {
                assert_eq!(target_rps, 100.0);
                assert_eq!(duration_sec, 30);
                assert_eq!(max_in_flight, 200);
                assert!(ramp_config.is_none());
                assert_eq!(detail_level, DetailLevel::Sampled);
            }
            _ => panic!("Expected ConstantArrival"),
        }
    }

    #[test]
    fn constant_arrival_from_js_payload_with_ramp() {
        let json = r#"{
            "mode": "constant-arrival",
            "scenarios": [],
            "targetRps": 200.0,
            "durationSec": 120,
            "maxInFlight": 500,
            "timeoutMs": 10000,
            "retryCount": 3,
            "retryDelayMs": 1000,
            "thinkTime": {"type": "constant", "delayMs": 50},
            "circuitBreaker": {"policy": "stop-threshold", "maxErrors": 10, "maxErrorRate": 0.5, "minSampleSize": 20},
            "rampConfig": {"startRps": 10.0, "endRps": 200.0, "rampDurationSec": 60},
            "detailLevel": "metrics-only"
        }"#;
        let parsed: ExecutionPlan = serde_json::from_str(json).unwrap();
        match parsed {
            ExecutionPlan::ConstantArrival {
                target_rps,
                ramp_config,
                detail_level,
                retry_count,
                think_time,
                circuit_breaker,
                ..
            } => {
                assert_eq!(target_rps, 200.0);
                assert_eq!(retry_count, 3);
                assert_eq!(detail_level, DetailLevel::MetricsOnly);

                let rc = ramp_config.unwrap();
                assert_eq!(rc.start_rps, 10.0);
                assert_eq!(rc.end_rps, 200.0);

                match think_time {
                    ThinkTimeConfig::Constant { delay_ms } => assert_eq!(delay_ms, 50),
                    _ => panic!("Expected Constant think time"),
                }

                match circuit_breaker {
                    CircuitBreakerConfig::StopThreshold { max_errors, .. } => assert_eq!(max_errors, 10),
                    _ => panic!("Expected StopThreshold"),
                }
            }
            _ => panic!("Expected ConstantArrival"),
        }
    }

    #[test]
    fn constant_arrival_default_detail_level() {
        let json = r#"{
            "mode": "constant-arrival",
            "scenarios": [],
            "targetRps": 10.0,
            "durationSec": 5,
            "maxInFlight": 20,
            "timeoutMs": 1000,
            "retryCount": 0,
            "retryDelayMs": 0,
            "thinkTime": {"type": "none"},
            "circuitBreaker": {"policy": "continue"},
            "rampConfig": null
        }"#;
        let parsed: ExecutionPlan = serde_json::from_str(json).unwrap();
        match parsed {
            ExecutionPlan::ConstantArrival { detail_level, .. } => {
                assert_eq!(detail_level, DetailLevel::Full);
            }
            _ => panic!("Expected ConstantArrival"),
        }
    }

    #[test]
    fn constant_arrival_ramp_config_missing_from_json() {
        let json = r#"{
            "mode": "constant-arrival",
            "scenarios": [],
            "targetRps": 10.0,
            "durationSec": 5,
            "maxInFlight": 20,
            "timeoutMs": 1000,
            "retryCount": 0,
            "retryDelayMs": 0,
            "thinkTime": {"type": "none"},
            "circuitBreaker": {"policy": "continue"}
        }"#;
        let parsed: ExecutionPlan = serde_json::from_str(json).unwrap();
        match parsed {
            ExecutionPlan::ConstantArrival { ramp_config, detail_level, .. } => {
                assert!(ramp_config.is_none(), "Missing rampConfig should default to None");
                assert_eq!(detail_level, DetailLevel::Full);
            }
            _ => panic!("Expected ConstantArrival"),
        }
    }

    // ── Edge cases ───────────────────────────────────────────

    #[test]
    fn empty_scenarios_returns_empty() {
        let plan = ExecutionPlan::ConstantArrival {
            scenarios: vec![],
            target_rps: 50.0,
            duration_sec: 10,
            max_in_flight: 100,
            timeout_ms: 5000,
            retry_count: 0,
            retry_delay_ms: 0,
            think_time: ThinkTimeConfig::None,
            circuit_breaker: CircuitBreakerConfig::Continue,
            ramp_config: None,
            detail_level: DetailLevel::Full,
        };
        let json = serde_json::to_string(&plan).unwrap();
        let parsed: ExecutionPlan = serde_json::from_str(&json).unwrap();
        match parsed {
            ExecutionPlan::ConstantArrival { scenarios, .. } => {
                assert!(scenarios.is_empty());
            }
            _ => panic!("Expected ConstantArrival"),
        }
    }

    #[test]
    fn zero_duration_plan_serializes() {
        let plan = ExecutionPlan::ConstantArrival {
            scenarios: vec![],
            target_rps: 10.0,
            duration_sec: 0,
            max_in_flight: 50,
            timeout_ms: 1000,
            retry_count: 0,
            retry_delay_ms: 0,
            think_time: ThinkTimeConfig::None,
            circuit_breaker: CircuitBreakerConfig::Continue,
            ramp_config: None,
            detail_level: DetailLevel::Full,
        };
        let json = serde_json::to_string(&plan).unwrap();
        assert!(json.contains("\"durationSec\":0"), "zero duration: {json}");
    }

    #[test]
    fn fractional_target_rps() {
        let plan = ExecutionPlan::ConstantArrival {
            scenarios: vec![],
            target_rps: 0.5,
            duration_sec: 10,
            max_in_flight: 5,
            timeout_ms: 5000,
            retry_count: 0,
            retry_delay_ms: 0,
            think_time: ThinkTimeConfig::None,
            circuit_breaker: CircuitBreakerConfig::Continue,
            ramp_config: None,
            detail_level: DetailLevel::Sampled,
        };
        let json = serde_json::to_string(&plan).unwrap();
        assert!(json.contains("\"targetRps\":0.5"), "fractional rps: {json}");
        let parsed: ExecutionPlan = serde_json::from_str(&json).unwrap();
        match parsed {
            ExecutionPlan::ConstantArrival { target_rps, .. } => {
                assert!((target_rps - 0.5).abs() < 0.001);
            }
            _ => panic!("Expected ConstantArrival"),
        }
    }

    #[test]
    fn max_in_flight_one() {
        let plan = ExecutionPlan::ConstantArrival {
            scenarios: vec![],
            target_rps: 100.0,
            duration_sec: 5,
            max_in_flight: 1,
            timeout_ms: 1000,
            retry_count: 0,
            retry_delay_ms: 0,
            think_time: ThinkTimeConfig::None,
            circuit_breaker: CircuitBreakerConfig::Continue,
            ramp_config: None,
            detail_level: DetailLevel::Full,
        };
        let json = serde_json::to_string(&plan).unwrap();
        let parsed: ExecutionPlan = serde_json::from_str(&json).unwrap();
        match parsed {
            ExecutionPlan::ConstantArrival { max_in_flight, .. } => {
                assert_eq!(max_in_flight, 1);
            }
            _ => panic!("Expected ConstantArrival"),
        }
    }

    // ── Existing plan modes still deserialize ───────────────

    #[test]
    fn pool_plan_still_works() {
        let json = r#"{
            "mode": "pool",
            "scenarios": [],
            "concurrency": 10,
            "timeoutMs": 5000,
            "retryCount": 0,
            "retryDelayMs": 0,
            "thinkTime": {"type": "none"},
            "circuitBreaker": {"policy": "continue"}
        }"#;
        let parsed: ExecutionPlan = serde_json::from_str(json).unwrap();
        match parsed {
            ExecutionPlan::Pool { concurrency, .. } => assert_eq!(concurrency, 10),
            _ => panic!("Expected Pool"),
        }
    }

    #[test]
    fn load_profile_plan_still_works() {
        let json = r#"{
            "mode": "load-profile",
            "scenarios": [],
            "concurrency": 20,
            "durationSec": 60,
            "timeoutMs": 5000,
            "retryCount": 0,
            "retryDelayMs": 0,
            "thinkTime": {"type": "none"},
            "circuitBreaker": {"policy": "continue"},
            "profileType": "sustained"
        }"#;
        let parsed: ExecutionPlan = serde_json::from_str(json).unwrap();
        match parsed {
            ExecutionPlan::LoadProfile { concurrency, duration_sec, .. } => {
                assert_eq!(concurrency, 20);
                assert_eq!(duration_sec, 60);
            }
            _ => panic!("Expected LoadProfile"),
        }
    }
}
