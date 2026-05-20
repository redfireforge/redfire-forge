#[cfg(test)]
mod tests {
    use crate::date_helpers::{resolve_date, to_day_string, truncate_to_unit};
    use crate::deep_compare::deep_compare;
    use crate::http_helpers::{evaluate_header_op, find_header, get_json_type_name, matches_status_pattern};
    use crate::json_path::{get_by_path, path_exists};
    use crate::subset_match::deep_subset_match;
    use crate::validation_result::build_validation_result;
    use crate::validation_types::*;
    use serde_json::{json, Value};
    use std::collections::HashMap;
    use std::time::Instant;

    // ── Realistic scenario: extract path then check type ─────────

    #[test]
    fn extract_nested_value_and_check_type() {
        let body = json!({"data": {"users": [{"name": "Alice", "age": 30}]}});
        let val = get_by_path(&body, "$.data.users[0].name");
        assert_eq!(val, json!("Alice"));
        assert_eq!(get_json_type_name(&val), JsonTypeName::String);

        let age = get_by_path(&body, "data.users[0].age");
        assert_eq!(age, json!(30));
        assert_eq!(get_json_type_name(&age), JsonTypeName::Number);
    }

    // ── Realistic scenario: path_exists + deep_compare on extracted subtree ──

    #[test]
    fn path_exists_then_deep_compare_subtree() {
        let body = json!({"result": {"items": [1, 2, 3]}});
        assert!(path_exists(&body, "result.items"));
        assert!(!path_exists(&body, "result.missing"));

        let subtree = get_by_path(&body, "result.items");
        let expected = json!([1, 2, 3]);
        let mut failures = Vec::new();
        deep_compare(&expected, &subtree, "", &mut failures);
        assert!(failures.is_empty(), "identical subtrees should have 0 failures");
    }

    // ── Realistic scenario: wildcard + subset match ──────────────

    #[test]
    fn wildcard_extract_then_subset_match() {
        let body = json!({"orders": [
            {"id": 1, "status": "paid", "amount": 100},
            {"id": 2, "status": "pending", "amount": 50},
            {"id": 3, "status": "paid", "amount": 200},
        ]});
        let statuses = get_by_path(&body, "orders[*].status");
        assert_eq!(statuses, json!(["paid", "pending", "paid"]));

        let expected_subset = json!(["pending", "paid"]);
        let result = deep_subset_match(&statuses, &expected_subset, "");
        assert!(result.matched, "subset should match: {:?}", result.path);
    }

    // ── Realistic scenario: status pattern + header check ────────

    #[test]
    fn status_and_header_check_combined() {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json; charset=utf-8".to_string());
        headers.insert("X-Request-Id".to_string(), "abc-123".to_string());

        assert!(matches_status_pattern(200, "2xx"));
        assert!(matches_status_pattern(201, "200-299"));

        let ct = find_header(&headers, "content-type");
        assert_eq!(ct, Some("application/json; charset=utf-8"));

        let op_result = evaluate_header_op(ct, "contains", Some("json"));
        assert!(op_result.pass);

        let missing = find_header(&headers, "Authorization");
        assert!(missing.is_none());
        let exists_result = evaluate_header_op(missing, "exists", None);
        assert!(!exists_result.pass);
    }

    // ── Realistic scenario: date helpers for date assertion ──────

    #[test]
    fn date_assertion_workflow() {
        let body = json!({"created_at": "2024-06-15T10:30:00Z"});
        let raw_date = get_by_path(&body, "created_at");
        let day_str = to_day_string(&raw_date);
        assert_eq!(day_str, Some("2024-06-15".to_string()));

        let reference = DateReference::Fixed { iso: "2024-06-15".to_string() };
        let ref_str = resolve_date(&reference);
        assert_eq!(ref_str, "2024-06-15");

        assert_eq!(day_str.as_deref(), Some(ref_str.as_str()));
    }

    // ── Realistic scenario: epoch millis date + truncation ───────

    #[test]
    fn epoch_date_with_precision_truncation() {
        let body = json!({"timestamp": 1718451000123_i64});
        let raw = get_by_path(&body, "timestamp");
        let day = to_day_string(&raw);
        assert!(day.is_some());

        let millis = raw.as_i64().unwrap();
        let trunc_second = truncate_to_unit(millis, &DatePrecision::Second);
        let trunc_day = truncate_to_unit(millis, &DatePrecision::Day);
        assert!(trunc_second > trunc_day);
        assert_eq!(truncate_to_unit(millis, &DatePrecision::Millisecond), millis);
    }

    // ── Realistic scenario: deep_compare complex mismatch ────────

    #[test]
    fn deep_compare_api_response_mismatch() {
        let expected = json!({
            "status": "success",
            "data": {
                "users": [
                    {"id": 1, "name": "Alice"},
                    {"id": 2, "name": "Bob"},
                ]
            }
        });
        let actual = json!({
            "status": "success",
            "data": {
                "users": [
                    {"id": 1, "name": "Alice"},
                    {"id": 2, "name": "Charlie"},
                ]
            }
        });
        let mut failures = Vec::new();
        deep_compare(&expected, &actual, "", &mut failures);
        assert_eq!(failures.len(), 1);
        assert_eq!(failures[0].path, "data.users[1].name");
        assert_eq!(failures[0].expected, "\"Bob\"");
        assert_eq!(failures[0].actual, "\"Charlie\"");
    }

    // ── Realistic scenario: subset match on nested API response ──

    #[test]
    fn subset_match_partial_api_response() {
        let actual = json!({
            "id": 42,
            "name": "Widget",
            "price": 9.99,
            "tags": ["sale", "new", "featured"],
            "metadata": {"color": "blue", "size": "large"}
        });
        let expected_subset = json!({
            "name": "Widget",
            "tags": ["new"],
            "metadata": {"color": "blue"}
        });
        let result = deep_subset_match(&actual, &expected_subset, "");
        assert!(result.matched, "partial match should pass");
    }

    // ── Serde round-trip: Assertion with all fields ──────────────

    #[test]
    fn assertion_serde_from_realistic_js_json() {
        let js = json!({
            "type": "arrayContains",
            "jsonPath": "$.data.items",
            "value": "{\"name\":\"Widget\"}",
            "mode": "any",
            "negate": true
        });
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::ArrayContains { negate, json_path, value, mode } => {
                assert!(negate);
                assert_eq!(json_path, "$.data.items");
                assert_eq!(value, "{\"name\":\"Widget\"}");
                assert_eq!(*mode, ArrayContainsMode::Any);
            }
            _ => panic!("expected ArrayContains"),
        }
        assert!(a.is_negated());
    }

    // ── Performance Benchmarks (Section 13) ─────────────────────

    const PERF_BODY_STR: &str = r#"{"data":{"id":"abc123def456","name":"Test User","count":42,"active":true,"email":"user@example.com","role":"admin","score":95.5,"tags":["alpha","beta","gamma","delta","epsilon"],"items":[{"name":"Widget A","price":9.99},{"name":"Widget B","price":19.99},{"name":"Widget C","price":29.99},{"name":"Widget D","price":39.99},{"name":"Widget E","price":49.99}],"metadata":{"version":"1.0","region":"us-east"},"timestamp":"2024-01-01T00:00:00Z"}}"#;

    fn perf_body() -> Value {
        serde_json::from_str(PERF_BODY_STR).unwrap()
    }

    fn perf_selective_config() -> ValidationConfig {
        ValidationConfig {
            mode: ValidationMode::Selective,
            expected_json: None,
            expected_fields: Some(vec![
                ExpectedField {
                    json_path: "$.data.active".into(),
                    expected_value: "true".into(),
                    operator: Some(FieldOperator::Equals),
                    operator_value: None,
                    negate: None,
                    expression: None,
                },
                ExpectedField {
                    json_path: "$.data.role".into(),
                    expected_value: "admin".into(),
                    operator: Some(FieldOperator::Equals),
                    operator_value: None,
                    negate: None,
                    expression: None,
                },
                ExpectedField {
                    json_path: "$.data.score".into(),
                    expected_value: "95.5".into(),
                    operator: Some(FieldOperator::GreaterThanOrEqual),
                    operator_value: None,
                    negate: None,
                    expression: None,
                },
                ExpectedField {
                    json_path: "$.data.email".into(),
                    expected_value: "example".into(),
                    operator: Some(FieldOperator::Contains),
                    operator_value: None,
                    negate: None,
                    expression: None,
                },
            ]),
            unordered_arrays: None,
        }
    }

    fn perf_primary_assertions() -> Vec<Assertion> {
        vec![
            Assertion::Status { negate: false, expected: "200".into() },
            Assertion::ResponseTime { negate: false, max_ms: 500.0 },
            Assertion::Numeric {
                negate: false,
                json_path: "$.data.count".into(),
                operator: ComparisonOperator::Gt,
                value: 0.0,
            },
            Assertion::Regex {
                negate: false,
                json_path: "$.data.id".into(),
                pattern: "^[a-f0-9]+$".into(),
            },
            Assertion::Existence {
                negate: false,
                json_path: "$.data.name".into(),
                expect_exists: true,
            },
        ]
    }

    fn perf_primary_assertions_no_status() -> Vec<Assertion> {
        perf_primary_assertions().into_iter().filter(|a| {
            !matches!(a, Assertion::Status { .. })
        }).collect()
    }

    fn print_perf(label: &str, iterations: usize, elapsed: std::time::Duration) {
        let ms = elapsed.as_secs_f64() * 1000.0;
        let us_per_iter = (elapsed.as_micros() as f64) / (iterations as f64);
        println!("[PERF] {label}: {ms:.2} ms total, {us_per_iter:.2} µs/iter ({iterations} iterations)");
    }

    #[test]
    fn perf_benchmark_a() {
        let body = perf_body();
        let config = perf_selective_config();
        let assertions = perf_primary_assertions();
        let headers: HashMap<String, String> = HashMap::new();
        let iterations = 10_000;

        // Warmup
        for _ in 0..100 {
            build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
        }

        let start = Instant::now();
        let mut pass_count = 0u32;
        for _ in 0..iterations {
            let result = build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
            if result.passed { pass_count += 1; }
        }
        let elapsed = start.elapsed();

        assert_eq!(pass_count, iterations as u32, "all iterations should pass");
        print_perf("Benchmark A (selective + 5 assertions)", iterations, elapsed);

        assert!(elapsed.as_secs() < 2, "regression guard: Benchmark A took {:?}, expected < 2s", elapsed);
    }

    #[test]
    fn perf_benchmark_b() {
        let config = perf_selective_config();
        let assertions = perf_primary_assertions();
        let headers: HashMap<String, String> = HashMap::new();
        let iterations = 10_000;

        // Warmup
        for _ in 0..100 {
            let body: Value = serde_json::from_str(PERF_BODY_STR).unwrap();
            build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
        }

        let start = Instant::now();
        let mut pass_count = 0u32;
        for _ in 0..iterations {
            let body: Value = serde_json::from_str(PERF_BODY_STR).unwrap();
            let result = build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
            if result.passed { pass_count += 1; }
        }
        let elapsed = start.elapsed();

        assert_eq!(pass_count, iterations as u32, "all iterations should pass");
        print_perf("Benchmark B (full pipeline + JSON parse)", iterations, elapsed);
    }

    #[test]
    fn perf_benchmark_c() {
        let body = perf_body();
        let config = perf_selective_config();
        let assertions_pass = perf_primary_assertions();
        let assertions_fail = perf_primary_assertions_no_status();
        let headers: HashMap<String, String> = HashMap::new();
        let iterations = 10_000;

        // Warmup
        for i in 0..100 {
            let (status, a) = if i % 10 < 7 { (200u16, &assertions_pass) } else { (500u16, &assertions_fail) };
            build_validation_result(status, 45.0, &headers, PERF_BODY_STR, &body, None, &config, a);
        }

        let start = Instant::now();
        let mut pass_count = 0u32;
        let mut fail_count = 0u32;
        for i in 0..iterations {
            let (status, a) = if i % 10 < 7 { (200u16, &assertions_pass) } else { (500u16, &assertions_fail) };
            let result = build_validation_result(status, 45.0, &headers, PERF_BODY_STR, &body, None, &config, a);
            if result.passed { pass_count += 1; } else { fail_count += 1; }
        }
        let elapsed = start.elapsed();

        assert_eq!(pass_count, 7000, "expected 7000 passing");
        assert_eq!(fail_count, 3000, "expected 3000 failing");
        print_perf("Benchmark C (mixed 70/30 pass/fail)", iterations, elapsed);
    }

    #[test]
    fn perf_benchmark_d() {
        let body = perf_body();
        let config = ValidationConfig {
            mode: ValidationMode::Full,
            expected_json: Some(PERF_BODY_STR.to_string()),
            expected_fields: None,
            unordered_arrays: None,
        };
        let assertions = vec![
            Assertion::Status { negate: false, expected: "200".into() },
            Assertion::ResponseTime { negate: false, max_ms: 500.0 },
        ];
        let headers: HashMap<String, String> = HashMap::new();
        let iterations = 5_000;

        for _ in 0..100 {
            build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
        }

        let start = Instant::now();
        for _ in 0..iterations {
            let result = build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
            assert!(result.passed);
        }
        let elapsed = start.elapsed();

        print_perf("Benchmark D (full mode — deep compare)", iterations, elapsed);
    }

    #[test]
    fn perf_benchmark_e() {
        let body = perf_body();
        let config = ValidationConfig {
            mode: ValidationMode::None,
            expected_json: None,
            expected_fields: None,
            unordered_arrays: None,
        };
        let schema = r#"{"type":"object","required":["data"],"properties":{"data":{"type":"object","required":["id","count"],"properties":{"id":{"type":"string"},"count":{"type":"number"}}}}}"#;
        let assertions = vec![
            Assertion::JsonSchema { negate: false, schema: schema.into() },
            Assertion::ContainsSubset {
                negate: false,
                json_path: "$.data".into(),
                expected: r#"{"active":true,"role":"admin"}"#.into(),
            },
            Assertion::Each {
                negate: false,
                json_path: "$.data.items".into(),
                field_path: "price".into(),
                operator: FieldOperator::GreaterThan,
                value: Some("0".into()),
            },
            Assertion::ArrayContains {
                negate: false,
                json_path: "$.data.tags".into(),
                value: "alpha".into(),
                mode: ArrayContainsMode::Any,
            },
            Assertion::ArrayLength {
                negate: false,
                json_path: "$.data.tags".into(),
                operator: ComparisonOperator::Eq,
                value: 5.0,
            },
        ];
        let headers: HashMap<String, String> = HashMap::new();
        let iterations = 2_000;

        for _ in 0..100 {
            build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
        }

        let start = Instant::now();
        for _ in 0..iterations {
            let result = build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
            assert!(result.passed);
        }
        let elapsed = start.elapsed();

        print_perf("Benchmark E (heavy assertions — schema+subset+each)", iterations, elapsed);
    }

    #[test]
    fn perf_benchmark_f() {
        let body = perf_body();
        let config = ValidationConfig {
            mode: ValidationMode::Selective,
            expected_json: None,
            expected_fields: Some(vec![
                ExpectedField {
                    json_path: "$.data.items[0].name".into(),
                    expected_value: "Widget C".into(),
                    operator: Some(FieldOperator::Equals),
                    operator_value: None,
                    negate: None,
                    expression: None,
                },
                ExpectedField {
                    json_path: "$.data.items[0].price".into(),
                    expected_value: "29.99".into(),
                    operator: Some(FieldOperator::Equals),
                    operator_value: None,
                    negate: None,
                    expression: None,
                },
                ExpectedField {
                    json_path: "$.data.items[1].name".into(),
                    expected_value: "Widget A".into(),
                    operator: Some(FieldOperator::Equals),
                    operator_value: None,
                    negate: None,
                    expression: None,
                },
            ]),
            unordered_arrays: Some(true),
        };
        let assertions = vec![
            Assertion::Status { negate: false, expected: "200".into() },
            Assertion::ResponseTime { negate: false, max_ms: 500.0 },
        ];
        let headers: HashMap<String, String> = HashMap::new();
        let iterations = 5_000;

        for _ in 0..100 {
            build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
        }

        let start = Instant::now();
        for _ in 0..iterations {
            let result = build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
            assert!(result.passed);
        }
        let elapsed = start.elapsed();

        print_perf("Benchmark F (selective + unorderedArrays)", iterations, elapsed);
    }

    #[test]
    fn perf_benchmark_g() {
        let body = perf_body();
        let config = ValidationConfig {
            mode: ValidationMode::None,
            expected_json: None,
            expected_fields: None,
            unordered_arrays: None,
        };
        let assertions = vec![
            Assertion::Header {
                negate: false,
                name: "content-type".into(),
                operator: AssertionOperator::Contains,
                value: Some("json".into()),
            },
            Assertion::Date {
                negate: false,
                json_path: "$.data.timestamp".into(),
                operator: ComparisonOperator::Lte,
                reference: DateReference::Fixed { iso: "2025-01-01".into() },
            },
            Assertion::TypeCheck {
                negate: false,
                json_path: "$.data.count".into(),
                expected_type: JsonTypeName::Number,
            },
            Assertion::BodySize {
                negate: false,
                operator: ComparisonOperator::Lt,
                value: 10.0,
                unit: SizeUnit::Kb,
            },
            Assertion::DatePrecise {
                negate: false,
                json_path: "$.data.timestamp".into(),
                operator: ComparisonOperator::Lte,
                reference: "2025-01-01T00:00:00Z".into(),
                precision: DatePrecision::Day,
            },
        ];
        let mut headers: HashMap<String, String> = HashMap::new();
        headers.insert("content-type".into(), "application/json; charset=utf-8".into());
        headers.insert("x-request-id".into(), "abc-123".into());
        let iterations = 5_000;

        for _ in 0..100 {
            build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
        }

        let start = Instant::now();
        for _ in 0..iterations {
            let result = build_validation_result(200, 45.0, &headers, PERF_BODY_STR, &body, None, &config, &assertions);
            assert!(result.passed);
        }
        let elapsed = start.elapsed();

        print_perf("Benchmark G (header+date+typeCheck+bodySize+datePrecise)", iterations, elapsed);
    }
}
