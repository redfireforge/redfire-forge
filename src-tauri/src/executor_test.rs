#[cfg(test)]
mod tests {
    use crate::executor::*;
    use crate::types::*;

    // ── Think Time ───────────────────────────────────────

    #[test]
    fn think_time_none_returns_zero() {
        assert_eq!(compute_think_time(&ThinkTimeConfig::None), 0);
    }

    #[test]
    fn think_time_constant_returns_exact() {
        assert_eq!(compute_think_time(&ThinkTimeConfig::Constant { delay_ms: 42 }), 42);
    }

    #[test]
    fn think_time_constant_zero() {
        assert_eq!(compute_think_time(&ThinkTimeConfig::Constant { delay_ms: 0 }), 0);
    }

    #[test]
    fn think_time_uniform_in_range() {
        for _ in 0..100 {
            let v = compute_think_time(&ThinkTimeConfig::Uniform {
                min_ms: 10,
                max_ms: 50,
            });
            assert!(v >= 10 && v <= 50, "got {v}");
        }
    }

    #[test]
    fn think_time_uniform_min_equals_max() {
        let v = compute_think_time(&ThinkTimeConfig::Uniform {
            min_ms: 25,
            max_ms: 25,
        });
        assert_eq!(v, 25);
    }

    #[test]
    fn think_time_uniform_inverted_range() {
        let v = compute_think_time(&ThinkTimeConfig::Uniform {
            min_ms: 50,
            max_ms: 10,
        });
        assert_eq!(v, 50);
    }

    #[test]
    fn think_time_gaussian_nonneg() {
        for _ in 0..500 {
            let v = compute_think_time(&ThinkTimeConfig::Gaussian {
                mean_ms: 100,
                std_dev_ms: 30,
            });
            // Must never be negative (guaranteed by .max(0.0))
            assert!(v < 10_000, "outlier {v}");
        }
    }

    #[test]
    fn think_time_gaussian_zero_stddev() {
        for _ in 0..50 {
            let v = compute_think_time(&ThinkTimeConfig::Gaussian {
                mean_ms: 42,
                std_dev_ms: 0,
            });
            assert_eq!(v, 42);
        }
    }

    // ── Circuit Breaker ──────────────────────────────────

    #[test]
    fn breaker_continue_never_trips() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::Continue);
        for _ in 0..100 {
            b.record(true);
        }
        assert!(!b.should_stop());
    }

    #[test]
    fn breaker_stop_first_on_error() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopFirst);
        b.record(false);
        assert!(!b.should_stop());
        b.record(true);
        assert!(b.should_stop());
    }

    #[test]
    fn breaker_stop_first_no_error() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopFirst);
        b.record(false);
        b.record(false);
        assert!(!b.should_stop());
    }

    #[test]
    fn breaker_threshold_trips_on_count() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopThreshold {
            max_errors: 3,
            max_error_rate: 1.0,
            min_sample_size: 100,
        });
        b.record(true);
        b.record(true);
        assert!(!b.should_stop());
        b.record(true);
        assert!(b.should_stop());
    }

    #[test]
    fn breaker_threshold_trips_on_rate() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopThreshold {
            max_errors: 100,
            max_error_rate: 0.5,
            min_sample_size: 4,
        });
        b.record(true);
        b.record(true);
        b.record(false);
        assert!(!b.should_stop()); // 3 samples < 4 min
        b.record(true);
        assert!(b.should_stop()); // 3/4 = 0.75 >= 0.5
    }

    #[test]
    fn breaker_threshold_respects_min_sample() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopThreshold {
            max_errors: 100,
            max_error_rate: 0.3,
            min_sample_size: 10,
        });
        for _ in 0..3 {
            b.record(true);
        }
        for _ in 0..2 {
            b.record(false);
        }
        assert!(!b.should_stop());
    }

    #[test]
    fn breaker_threshold_exact_boundary() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopThreshold {
            max_errors: 100,
            max_error_rate: 0.5,
            min_sample_size: 2,
        });
        b.record(true);
        b.record(false);
        // 1/2 = 0.5 which is >= 0.5 threshold
        assert!(b.should_stop());
    }

    #[test]
    fn breaker_stays_tripped() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopFirst);
        b.record(true);
        assert!(b.should_stop());
        // Successes after tripping don't un-trip
        b.record(false);
        b.record(false);
        assert!(b.should_stop());
    }

    // ── Weighted Pool ────────────────────────────────────

    fn make_scenario(id: &str, weight: Option<f64>) -> RustScenario {
        RustScenario {
            id: id.to_string(),
            name: id.to_string(),
            url: format!("http://example.com/{id}"),
            method: "GET".to_string(),
            headers: Default::default(),
            body: None,
            feature_group_name: None,
            group_name: None,
            weight,
            data_row_id: None,
            data_row_label: None,
            validation: Default::default(),
            assertions: vec![],
        }
    }

    #[test]
    fn weighted_pool_uniform() {
        let scenarios = vec![make_scenario("a", None), make_scenario("b", None)];
        let pool = build_weighted_pool(&scenarios);
        assert_eq!(pool.len(), 2);
        assert!(pool.contains(&0));
        assert!(pool.contains(&1));
    }

    #[test]
    fn weighted_pool_respects_weights() {
        let scenarios = vec![
            make_scenario("a", Some(3.0)),
            make_scenario("b", Some(1.0)),
        ];
        let pool = build_weighted_pool(&scenarios);
        assert_eq!(pool.len(), 4);
        let a_count = pool.iter().filter(|&&i| i == 0).count();
        let b_count = pool.iter().filter(|&&i| i == 1).count();
        assert_eq!(a_count, 3);
        assert_eq!(b_count, 1);
    }

    #[test]
    fn weighted_pool_empty() {
        let pool = build_weighted_pool(&[]);
        assert!(pool.is_empty());
    }

    #[test]
    fn weighted_pool_zero_weight() {
        let scenarios = vec![make_scenario("a", Some(0.0))];
        let pool = build_weighted_pool(&scenarios);
        // weight=0 → treated as 1
        assert_eq!(pool.len(), 1);
        assert_eq!(pool[0], 0);
    }

    #[test]
    fn weighted_pool_negative_weight() {
        let scenarios = vec![make_scenario("a", Some(-5.0))];
        let pool = build_weighted_pool(&scenarios);
        // .max(0.0) → 0.0 → treated as 1
        assert_eq!(pool.len(), 1);
    }

    #[test]
    fn weighted_pool_single_scenario() {
        let scenarios = vec![make_scenario("only", Some(5.0))];
        let pool = build_weighted_pool(&scenarios);
        assert_eq!(pool.len(), 5);
        assert!(pool.iter().all(|&i| i == 0));
    }

    // ── Target Concurrency ───────────────────────────────

    #[test]
    fn sustained_constant() {
        assert_eq!(get_target_concurrency("sustained", 100, 5.0, 60, None, None, None, None), 100);
    }

    #[test]
    fn sustained_unknown_type() {
        assert_eq!(get_target_concurrency("unknown-type", 100, 5.0, 60, None, None, None, None), 100);
    }

    #[test]
    fn ramp_up_affine() {
        // JS formula: ceil(1 + (M-1) * t) — affine 1→M, not linear from 0
        assert_eq!(get_target_concurrency("ramp-up", 100, 0.0, 60, Some(60), None, None, None), 1);
        // t=0.5 → ceil(1 + 99*0.5) = ceil(50.5) = 51
        assert_eq!(get_target_concurrency("ramp-up", 100, 30.0, 60, Some(60), None, None, None), 51);
        assert_eq!(get_target_concurrency("ramp-up", 100, 60.0, 60, Some(60), None, None, None), 100);
        // Beyond ramp → stays at max
        assert_eq!(get_target_concurrency("ramp-up", 100, 90.0, 60, Some(60), None, None, None), 100);
    }

    #[test]
    fn ramp_up_zero_ramp() {
        // rampUpSec=0 → use durationSec as ramp (match JS `|| durationSec`)
        // t=0 with ramp=60 → ceil(1 + 99*0) = 1
        assert_eq!(get_target_concurrency("ramp-up", 100, 0.0, 60, Some(0), None, None, None), 1);
    }

    #[test]
    fn ramp_up_no_ramp_specified() {
        // None → use durationSec=60 as ramp, t=0.5 → ceil(1 + 99*0.5) = 51
        assert_eq!(get_target_concurrency("ramp-up", 100, 30.0, 60, None, None, None, None), 51);
    }

    #[test]
    fn spike_inside_window() {
        let c = get_target_concurrency(
            "spike", 100, 15.0, 60, None, Some(500), Some(10), Some(20),
        );
        assert_eq!(c, 500);
    }

    #[test]
    fn spike_outside_window() {
        let c = get_target_concurrency(
            "spike", 100, 35.0, 60, None, Some(500), Some(10), Some(20),
        );
        assert_eq!(c, 100);
    }

    #[test]
    fn spike_before_window() {
        let c = get_target_concurrency(
            "spike", 100, 5.0, 60, None, Some(500), Some(10), Some(20),
        );
        assert_eq!(c, 100);
    }

    #[test]
    fn spike_at_exact_boundary() {
        // At spike_start_sec boundary → should be spike concurrency
        let c = get_target_concurrency(
            "spike", 100, 10.0, 60, None, Some(500), Some(10), Some(20),
        );
        assert_eq!(c, 500);
        // At spike_end boundary (10+20=30) → back to normal
        let c2 = get_target_concurrency(
            "spike", 100, 30.0, 60, None, Some(500), Some(10), Some(20),
        );
        assert_eq!(c2, 100);
    }

    #[test]
    fn concurrency_zero_clamped_to_one() {
        assert_eq!(get_target_concurrency("sustained", 0, 5.0, 60, None, None, None, None), 1);
        assert_eq!(get_target_concurrency("ramp-up", 0, 30.0, 60, Some(60), None, None, None), 1);
        // spike: raw 0*3=0 → spike_c.max(1)=1 inside window [18, 30); baseline max(0,1)=1 outside
        assert_eq!(get_target_concurrency("spike", 0, 20.0, 60, None, None, None, None), 1);
        assert_eq!(get_target_concurrency("spike", 0, 5.0, 60, None, None, None, None), 1);
    }

    #[test]
    fn spike_defaults() {
        // Match JS: start=floor(60*0.3)=18, dur=ceil(60*0.2)=12, peak=100*3=300
        // elapsed=5.0 is before spike window [18, 30) → baseline=100
        let before = get_target_concurrency("spike", 100, 5.0, 60, None, None, None, None);
        assert_eq!(before, 100);
        // elapsed=20.0 is inside spike window [18, 30) → peak=300
        let during = get_target_concurrency("spike", 100, 20.0, 60, None, None, None, None);
        assert_eq!(during, 300);
        // elapsed=35.0 is after spike window → baseline=100
        let after = get_target_concurrency("spike", 100, 35.0, 60, None, None, None, None);
        assert_eq!(after, 100);
    }

    #[test]
    fn spike_defaults_dur100_max5() {
        // Match JS test: durationSec=100, maxConcurrency=5
        // start=floor(100*0.3)=30, dur=ceil(100*0.2)=20, peak=5*3=15
        // Window is [30, 50)
        assert_eq!(get_target_concurrency("spike", 5, 10.0, 100, None, None, None, None), 5);
        assert_eq!(get_target_concurrency("spike", 5, 35.0, 100, None, None, None, None), 15);
    }

    #[test]
    fn ramp_up_m1_constant() {
        // maxConcurrency=1 → ceil(1 + 0*t) = 1 always
        assert_eq!(get_target_concurrency("ramp-up", 1, 0.0, 60, Some(60), None, None, None), 1);
        assert_eq!(get_target_concurrency("ramp-up", 1, 30.0, 60, Some(60), None, None, None), 1);
        assert_eq!(get_target_concurrency("ramp-up", 1, 60.0, 60, Some(60), None, None, None), 1);
    }

    #[test]
    fn ramp_up_small_values() {
        // M=10, ramp=10, t=0.5 → ceil(1 + 9*0.5) = ceil(5.5) = 6
        assert_eq!(get_target_concurrency("ramp-up", 10, 5.0, 60, Some(10), None, None, None), 6);
        // M=10, ramp=10, t=0.1 → ceil(1 + 9*0.1) = ceil(1.9) = 2
        assert_eq!(get_target_concurrency("ramp-up", 10, 1.0, 60, Some(10), None, None, None), 2);
    }

    #[test]
    fn ramp_up_duration_zero() {
        // durationSec=0 with None rampUpSec → ramp=0 → ramp<=0 → return max_c
        assert_eq!(get_target_concurrency("ramp-up", 100, 0.0, 0, None, None, None, None), 100);
    }

    // ── Body Capping ─────────────────────────────────────

    #[test]
    fn cap_body_short() {
        let short = "hello".to_string();
        assert_eq!(crate::executor::cap_body(&short), "hello");
    }

    #[test]
    fn cap_body_long() {
        let long = "x".repeat(5000);
        let capped = crate::executor::cap_body(&long);
        assert_eq!(capped.len(), 2000);
    }

    #[test]
    fn cap_body_exact_limit() {
        let exact = "x".repeat(2000);
        assert_eq!(crate::executor::cap_body(&exact).len(), 2000);
    }

    #[test]
    fn cap_body_empty() {
        assert_eq!(crate::executor::cap_body(""), "");
    }

    #[test]
    fn cap_body_multibyte_utf8() {
        // Each emoji is 4 bytes; 501 emojis = 2004 bytes > 2000
        let emojis = "🔥".repeat(501);
        let capped = crate::executor::cap_body(&emojis);
        // Must not panic, and must be valid UTF-8
        assert!(capped.len() <= 2000);
        assert!(capped.is_char_boundary(capped.len()));
        // Should be 500 emojis = 2000 bytes
        assert_eq!(capped.len(), 2000);
        assert_eq!(capped.chars().count(), 500);
    }

    #[test]
    fn cap_body_mixed_multibyte() {
        // 'é' is 2 bytes in UTF-8. 1001 of them = 2002 bytes
        let s = "é".repeat(1001);
        let capped = crate::executor::cap_body(&s);
        assert!(capped.len() <= 2000);
        // Should be 1000 chars = 2000 bytes
        assert_eq!(capped.len(), 2000);
    }

    // ── Response Time Rounding ───────────────────────────

    #[test]
    fn round_ms_precision() {
        use crate::executor::round_ms;
        assert_eq!(round_ms(1.2345), 1.23);
        assert_eq!(round_ms(1.235), 1.24);
        assert_eq!(round_ms(0.0), 0.0);
        assert_eq!(round_ms(100.0), 100.0);
        assert_eq!(round_ms(-0.005), -0.01); // negative edge
    }

    // ── Result Counter ───────────────────────────────────

    #[test]
    fn result_counter_reset_and_increment() {
        use crate::executor::reset_result_counter;
        reset_result_counter();
        // After reset, next IDs should start from 0
        let id1 = crate::executor::next_result_id();
        let id2 = crate::executor::next_result_id();
        assert!(id1.starts_with("rr-"));
        assert!(id2.starts_with("rr-"));
        // IDs should be sequential
        let n1: u64 = id1.strip_prefix("rr-").unwrap().parse().unwrap();
        let n2: u64 = id2.strip_prefix("rr-").unwrap().parse().unwrap();
        assert_eq!(n2, n1 + 1);
    }

    // ── Apply Think Time ─────────────────────────────────

    #[tokio::test]
    async fn apply_think_time_none_returns_immediately() {
        let cancel = tokio_util::sync::CancellationToken::new();
        let start = std::time::Instant::now();
        crate::executor::apply_think_time(&ThinkTimeConfig::None, &cancel).await;
        assert!(start.elapsed().as_millis() < 50);
    }

    #[tokio::test]
    async fn apply_think_time_cancelled_returns_immediately() {
        let cancel = tokio_util::sync::CancellationToken::new();
        cancel.cancel();
        let start = std::time::Instant::now();
        crate::executor::apply_think_time(
            &ThinkTimeConfig::Constant { delay_ms: 5000 },
            &cancel,
        ).await;
        assert!(start.elapsed().as_millis() < 50);
    }

    #[tokio::test]
    async fn apply_think_time_constant_sleeps() {
        let cancel = tokio_util::sync::CancellationToken::new();
        let start = std::time::Instant::now();
        crate::executor::apply_think_time(
            &ThinkTimeConfig::Constant { delay_ms: 50 },
            &cancel,
        ).await;
        let elapsed = start.elapsed().as_millis();
        assert!(elapsed >= 40, "slept only {elapsed}ms");
        assert!(elapsed < 200, "slept too long: {elapsed}ms");
    }

    // ── Cap Body Edge Cases ───────────────────────────────

    #[test]
    fn cap_body_3byte_char_boundary() {
        // 'あ' is 3 bytes. 667*3=2001 bytes > 2000
        let s = "あ".repeat(667);
        let capped = crate::executor::cap_body(&s);
        assert!(capped.len() <= 2000);
        assert!(capped.is_char_boundary(capped.len()));
        // Should be 666 chars = 1998 bytes (backs off from 2000 which is mid-char)
        assert_eq!(capped.len(), 1998);
        assert_eq!(capped.chars().count(), 666);
    }

    // ── Serde Round-Trip ─────────────────────────────────

    #[test]
    fn execution_plan_pool_serializes_camel_case_fields() {
        let plan = ExecutionPlan::Pool {
            scenarios: vec![],
            concurrency: 10,
            timeout_ms: 5000,
            retry_count: 2,
            retry_delay_ms: 100,
            think_time: ThinkTimeConfig::None,
            circuit_breaker: CircuitBreakerConfig::Continue,
        };
        let json = serde_json::to_string(&plan).unwrap();
        assert!(json.contains("timeoutMs"), "Expected camelCase: {json}");
        assert!(json.contains("retryCount"), "Expected camelCase: {json}");
        assert!(json.contains("retryDelayMs"), "Expected camelCase: {json}");
        assert!(json.contains("thinkTime"), "Expected camelCase: {json}");
        assert!(json.contains("circuitBreaker"), "Expected camelCase: {json}");
        assert!(!json.contains("timeout_ms"), "No snake_case: {json}");
        assert!(!json.contains("retry_count"), "No snake_case: {json}");
    }

    #[test]
    fn execution_plan_deserializes_from_js_camel_case() {
        let json = r#"{
            "mode": "pool",
            "scenarios": [],
            "concurrency": 5,
            "timeoutMs": 3000,
            "retryCount": 1,
            "retryDelayMs": 200,
            "thinkTime": { "type": "constant", "delayMs": 50 },
            "circuitBreaker": { "policy": "stop-first" }
        }"#;
        let plan: ExecutionPlan = serde_json::from_str(json).unwrap();
        match plan {
            ExecutionPlan::Pool { concurrency, timeout_ms, retry_count, .. } => {
                assert_eq!(concurrency, 5);
                assert_eq!(timeout_ms, 3000);
                assert_eq!(retry_count, 1);
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn load_profile_deserializes_from_js_camel_case() {
        let json = r#"{
            "mode": "load-profile",
            "scenarios": [],
            "concurrency": 50,
            "durationSec": 120,
            "timeoutMs": 5000,
            "retryCount": 0,
            "retryDelayMs": 0,
            "thinkTime": { "type": "uniform", "minMs": 10, "maxMs": 100 },
            "circuitBreaker": { "policy": "stop-threshold", "maxErrors": 5, "maxErrorRate": 0.1, "minSampleSize": 20 },
            "profileType": "ramp-up",
            "rampUpSec": 30
        }"#;
        let plan: ExecutionPlan = serde_json::from_str(json).unwrap();
        match plan {
            ExecutionPlan::LoadProfile { duration_sec, profile_type, ramp_up_sec, .. } => {
                assert_eq!(duration_sec, 120);
                assert_eq!(profile_type, "ramp-up");
                assert_eq!(ramp_up_sec, Some(30));
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn execution_plan_pool_roundtrip() {
        let plan = ExecutionPlan::Pool {
            scenarios: vec![make_scenario("a", Some(1.0))],
            concurrency: 10,
            timeout_ms: 5000,
            retry_count: 2,
            retry_delay_ms: 100,
            think_time: ThinkTimeConfig::Constant { delay_ms: 50 },
            circuit_breaker: CircuitBreakerConfig::StopFirst,
        };
        let json = serde_json::to_string(&plan).unwrap();
        assert!(json.contains(r#""mode":"pool""#));
        let parsed: ExecutionPlan = serde_json::from_str(&json).unwrap();
        match parsed {
            ExecutionPlan::Pool { concurrency, .. } => assert_eq!(concurrency, 10),
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn execution_plan_sequential_roundtrip() {
        let plan = ExecutionPlan::Sequential {
            scenarios: vec![make_scenario("a", None)],
            timeout_ms: 3000,
            retry_count: 0,
            retry_delay_ms: 0,
            think_time: ThinkTimeConfig::None,
            circuit_breaker: CircuitBreakerConfig::Continue,
        };
        let json = serde_json::to_string(&plan).unwrap();
        assert!(json.contains(r#""mode":"sequential""#));
        let parsed: ExecutionPlan = serde_json::from_str(&json).unwrap();
        match parsed {
            ExecutionPlan::Sequential { timeout_ms, .. } => assert_eq!(timeout_ms, 3000),
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn execution_plan_load_profile_roundtrip() {
        let plan = ExecutionPlan::LoadProfile {
            scenarios: vec![],
            concurrency: 50,
            duration_sec: 120,
            timeout_ms: 3000,
            retry_count: 0,
            retry_delay_ms: 0,
            think_time: ThinkTimeConfig::Uniform { min_ms: 10, max_ms: 100 },
            circuit_breaker: CircuitBreakerConfig::StopThreshold {
                max_errors: 5,
                max_error_rate: 0.1,
                min_sample_size: 20,
            },
            profile_type: "ramp-up".to_string(),
            ramp_up_sec: Some(30),
            spike_concurrency: None,
            spike_start_sec: None,
            spike_duration_sec: None,
        };
        let json = serde_json::to_string(&plan).unwrap();
        assert!(json.contains(r#""mode":"load-profile""#));
        let parsed: ExecutionPlan = serde_json::from_str(&json).unwrap();
        match parsed {
            ExecutionPlan::LoadProfile { duration_sec, .. } => assert_eq!(duration_sec, 120),
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn think_time_serde_roundtrip() {
        let configs = vec![
            ThinkTimeConfig::None,
            ThinkTimeConfig::Constant { delay_ms: 500 },
            ThinkTimeConfig::Uniform { min_ms: 10, max_ms: 100 },
            ThinkTimeConfig::Gaussian { mean_ms: 50, std_dev_ms: 10 },
        ];
        for c in &configs {
            let json = serde_json::to_string(c).unwrap();
            let parsed: ThinkTimeConfig = serde_json::from_str(&json).unwrap();
            assert_eq!(
                serde_json::to_string(&parsed).unwrap(),
                json
            );
        }
    }

    #[test]
    fn think_time_serializes_camel_case() {
        let json = serde_json::to_string(&ThinkTimeConfig::Constant { delay_ms: 42 }).unwrap();
        assert!(json.contains("delayMs"), "Expected camelCase: {json}");
        assert!(!json.contains("delay_ms"), "No snake_case: {json}");

        let json2 = serde_json::to_string(&ThinkTimeConfig::Gaussian { mean_ms: 50, std_dev_ms: 10 }).unwrap();
        assert!(json2.contains("meanMs"), "Expected camelCase: {json2}");
        assert!(json2.contains("stdDevMs"), "Expected camelCase: {json2}");
    }

    #[test]
    fn breaker_config_serializes_camel_case() {
        let json = serde_json::to_string(&CircuitBreakerConfig::StopThreshold {
            max_errors: 5, max_error_rate: 0.1, min_sample_size: 20,
        }).unwrap();
        assert!(json.contains("maxErrors"), "Expected camelCase: {json}");
        assert!(json.contains("maxErrorRate"), "Expected camelCase: {json}");
        assert!(json.contains("minSampleSize"), "Expected camelCase: {json}");
    }

    #[test]
    fn breaker_config_serde_roundtrip() {
        let configs = vec![
            CircuitBreakerConfig::Continue,
            CircuitBreakerConfig::StopFirst,
            CircuitBreakerConfig::StopThreshold {
                max_errors: 10,
                max_error_rate: 0.25,
                min_sample_size: 50,
            },
        ];
        for c in &configs {
            let json = serde_json::to_string(c).unwrap();
            let parsed: CircuitBreakerConfig = serde_json::from_str(&json).unwrap();
            assert_eq!(
                serde_json::to_string(&parsed).unwrap(),
                json
            );
        }
    }

    #[test]
    fn rust_scenario_serializes_to_camel_case() {
        let s = make_scenario("a", Some(2.0));
        let json = serde_json::to_string(&s).unwrap();
        // With rename_all = "camelCase", field should be featureGroupName, not feature_group_name
        assert!(json.contains("featureGroupName"), "Expected camelCase in JSON: {json}");
        assert!(json.contains("groupName"), "Expected camelCase in JSON: {json}");
        assert!(json.contains("dataRowId"), "Expected camelCase in JSON: {json}");
        assert!(!json.contains("feature_group_name"), "Should NOT have snake_case: {json}");
        assert!(!json.contains("group_name"), "Should NOT have snake_case: {json}");
        assert!(!json.contains("data_row_id"), "Should NOT have snake_case: {json}");
    }

    #[test]
    fn rust_scenario_serde_missing_optional_fields() {
        // JS may omit optional fields entirely — serde treats missing Option<T> as None
        let json = r#"{
            "id": "s1",
            "name": "test",
            "url": "http://example.com",
            "method": "GET",
            "headers": {}
        }"#;
        let s: RustScenario = serde_json::from_str(json).unwrap();
        assert_eq!(s.id, "s1");
        assert!(s.body.is_none());
        assert!(s.feature_group_name.is_none());
        assert!(s.weight.is_none());
        assert!(s.data_row_id.is_none());
        assert!(s.data_row_label.is_none());
    }

    #[test]
    fn rust_scenario_serde_with_optional_nulls() {
        let json = r#"{
            "id": "s1",
            "name": "test",
            "url": "http://example.com",
            "method": "POST",
            "headers": {"content-type": "application/json"},
            "body": "{\"key\":1}",
            "featureGroupName": null,
            "groupName": null,
            "weight": null,
            "dataRowId": null,
            "dataRowLabel": null
        }"#;
        let s: RustScenario = serde_json::from_str(json).unwrap();
        assert_eq!(s.id, "s1");
        assert_eq!(s.method, "POST");
        assert!(s.feature_group_name.is_none());
        assert!(s.weight.is_none());
        assert_eq!(s.headers.get("content-type").unwrap(), "application/json");
        assert_eq!(s.body.as_deref(), Some("{\"key\":1}"));
    }

    #[test]
    fn execution_result_serializes_camel_case() {
        let result = ExecutionResult {
            id: "rr-0".into(),
            scenario_id: "s1".into(),
            scenario_name: "test".into(),
            feature_group_name: None,
            group_name: None,
            url: "http://example.com".into(),
            method: "GET".into(),
            http_status: 200,
            response_time_ms: 12.34,
            response_body: "".into(),
            response_headers: Default::default(),
            timestamp: 0,
            error_message: None,
            data_row_id: None,
            data_row_label: None,
            request_log: RequestLog { headers: Default::default(), body: None },
            timing: TimingBreakdown { dns_lookup: 0.0, tcp_connect: 0.0, tls_handshake: 0.0, ttfb: 0.0, download: 0.0, total: 0.0 },
            retry_count: 0,
            passed: None,
            failure_details: vec![],
            validation_mode: String::new(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("scenarioId"), "Expected camelCase: {json}");
        assert!(json.contains("httpStatus"), "Expected camelCase: {json}");
        assert!(json.contains("responseTimeMs"), "Expected camelCase: {json}");
        assert!(json.contains("responseBody"), "Expected camelCase: {json}");
        assert!(json.contains("errorMessage"), "Expected camelCase: {json}");
        assert!(json.contains("requestLog"), "Expected camelCase: {json}");
        assert!(json.contains("retryCount"), "Expected camelCase: {json}");
        assert!(!json.contains("scenario_id"), "No snake_case: {json}");
        assert!(!json.contains("http_status"), "No snake_case: {json}");
    }

    #[test]
    fn execution_result_serde_roundtrip() {
        let result = ExecutionResult {
            id: "rr-1".into(),
            scenario_id: "s1".into(),
            scenario_name: "test".into(),
            feature_group_name: Some("group".into()),
            group_name: None,
            url: "http://example.com".into(),
            method: "GET".into(),
            http_status: 200,
            response_time_ms: 12.34,
            response_body: "{\"ok\":true}".into(),
            response_headers: [("content-type".into(), "application/json".into())].into(),
            timestamp: 1234567890,
            error_message: None,
            data_row_id: Some("row-1".into()),
            data_row_label: Some("Row 1".into()),
            request_log: RequestLog {
                headers: Default::default(),
                body: None,
            },
            timing: TimingBreakdown {
                dns_lookup: 0.0,
                tcp_connect: 1.5,
                tls_handshake: 2.3,
                ttfb: 8.0,
                download: 4.34,
                total: 12.34,
            },
            retry_count: 1,
            passed: None,
            failure_details: vec![],
            validation_mode: String::new(),
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: ExecutionResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.http_status, 200);
        assert_eq!(parsed.retry_count, 1);
        assert_eq!(parsed.feature_group_name.as_deref(), Some("group"));
    }

    #[test]
    fn progress_batch_serde_roundtrip() {
        let batch = ProgressBatch {
            completed: 5,
            total: 10,
            results: vec![],
            elapsed_ms: 1234.56,
            current_in_flight: 3,
            target_concurrency: 10,
            breaker_tripped: false,
        };
        let json = serde_json::to_string(&batch).unwrap();
        let parsed: ProgressBatch = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.completed, 5);
        assert_eq!(parsed.total, 10);
    }

    #[test]
    fn completion_summary_serde_roundtrip() {
        let summary = CompletionSummary {
            total_results: 42,
            duration_ms: 5000.0,
            breaker_tripped: true,
        };
        let json = serde_json::to_string(&summary).unwrap();
        let parsed: CompletionSummary = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.total_results, 42);
        assert!(parsed.breaker_tripped);
    }
}
