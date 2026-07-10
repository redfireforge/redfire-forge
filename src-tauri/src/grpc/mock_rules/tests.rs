fn context_with(body: Value) -> GrpcMockEvaluationContext {
    GrpcMockEvaluationContext {
        service: "pkg.Service".to_string(),
        method: "Unary".to_string(),
        metadata: std::collections::HashMap::from([("x-mode".to_string(), "test".to_string())]),
        request_body: body,
    }
}

#[test]
fn validate_rejects_duplicate_rule_ids() {
    let rule_set = GrpcMockRuleSet {
        rules: vec![
            GrpcMockRule {
                id: "dup".to_string(),
                name: "one".to_string(),
                enabled: true,
                priority: 1,
                created_at: None,
                fallthrough: None,
                predicate: GrpcMockPredicate::MethodEquals {
                    method: "Unary".to_string(),
                },
                response: GrpcMockRuleResponse {
                    status_code: Some(0),
                    body: Some(serde_json::json!({ "ok": true })),
                    messages: None,
                    latency_ms: None,
                    inter_message_delay_ms: None,
                    message: None,
                },
            },
            GrpcMockRule {
                id: "dup".to_string(),
                name: "two".to_string(),
                enabled: true,
                priority: 2,
                created_at: None,
                fallthrough: None,
                predicate: GrpcMockPredicate::ServiceEquals {
                    service: "pkg.Service".to_string(),
                },
                response: GrpcMockRuleResponse {
                    status_code: Some(0),
                    body: Some(serde_json::json!({ "ok": true })),
                    messages: None,
                    latency_ms: None,
                    inter_message_delay_ms: None,
                    message: None,
                },
            },
        ],
        default_response: None,
    };

    let error = validate_grpc_mock_rule_set(&rule_set).expect_err("expected duplicate id validation error");
    assert!(error.contains("duplicate rule id"));
}

#[test]
fn evaluate_uses_first_non_fallthrough_match() {
    let rule_set = GrpcMockRuleSet {
        rules: vec![
            GrpcMockRule {
                id: "fallthrough".to_string(),
                name: "Fallthrough".to_string(),
                enabled: true,
                priority: 10,
                created_at: Some("2026-01-01T00:00:00.000Z".to_string()),
                fallthrough: Some(true),
                predicate: GrpcMockPredicate::MethodEquals {
                    method: "Unary".to_string(),
                },
                response: GrpcMockRuleResponse {
                    status_code: Some(5),
                    body: None,
                    messages: None,
                    latency_ms: None,
                    inter_message_delay_ms: None,
                    message: Some("fallthrough".to_string()),
                },
            },
            GrpcMockRule {
                id: "winner".to_string(),
                name: "Winner".to_string(),
                enabled: true,
                priority: 11,
                created_at: Some("2026-01-01T00:00:00.000Z".to_string()),
                fallthrough: Some(false),
                predicate: GrpcMockPredicate::MetadataEquals {
                    key: "x-mode".to_string(),
                    value: "test".to_string(),
                },
                response: GrpcMockRuleResponse {
                    status_code: Some(0),
                    body: Some(serde_json::json!({ "name": "winner" })),
                    messages: None,
                    latency_ms: None,
                    inter_message_delay_ms: None,
                    message: None,
                },
            },
        ],
        default_response: Some(GrpcMockDefaultResponse {
            status_code: Some(12),
            body: None,
            message: Some("default".to_string()),
        }),
    };

    let result = evaluate_grpc_mock_rule_set(&rule_set, &context_with(serde_json::json!({ "a": 1 })));
    assert!(result.matched);
    assert!(!result.used_default);
    assert_eq!(result.rule_id.as_deref(), Some("winner"));
    assert_eq!(result.fallthrough_chain, vec!["fallthrough".to_string()]);
}

#[test]
fn evaluate_supports_body_path_and_default_response() {
    let rule_set = GrpcMockRuleSet {
        rules: vec![GrpcMockRule {
            id: "path-rule".to_string(),
            name: "Path Rule".to_string(),
            enabled: true,
            priority: 1,
            created_at: None,
            fallthrough: Some(false),
            predicate: GrpcMockPredicate::BodyPathEquals {
                path: "$.vehicle.vin".to_string(),
                value: "VIN-123".to_string(),
            },
            response: GrpcMockRuleResponse {
                status_code: Some(0),
                body: Some(serde_json::json!({ "matched": true })),
                messages: None,
                latency_ms: None,
                inter_message_delay_ms: None,
                message: None,
            },
        }],
        default_response: Some(GrpcMockDefaultResponse {
            status_code: Some(8),
            body: None,
            message: Some("resource exhausted".to_string()),
        }),
    };

    let matched = evaluate_grpc_mock_rule_set(
        &rule_set,
        &context_with(serde_json::json!({ "vehicle": { "vin": "VIN-123" } })),
    );
    assert!(matched.matched);
    assert_eq!(matched.rule_id.as_deref(), Some("path-rule"));

    let no_match = evaluate_grpc_mock_rule_set(
        &rule_set,
        &context_with(serde_json::json!({ "vehicle": { "vin": "OTHER" } })),
    );
    assert!(!no_match.matched);
    assert!(no_match.used_default);
    assert_eq!(no_match.response.status_code, Some(8));
    assert_eq!(no_match.response.message.as_deref(), Some("resource exhausted"));
}

#[test]
fn validate_rejects_invalid_expression_predicate() {
    let rule_set = GrpcMockRuleSet {
        rules: vec![GrpcMockRule {
            id: "expr-invalid".to_string(),
            name: "Expr Invalid".to_string(),
            enabled: true,
            priority: 1,
            created_at: None,
            fallthrough: None,
            predicate: GrpcMockPredicate::Expression {
                expression: "method ==".to_string(),
            },
            response: GrpcMockRuleResponse {
                status_code: Some(0),
                body: None,
                messages: None,
                latency_ms: None,
                inter_message_delay_ms: None,
                message: None,
            },
        }],
        default_response: None,
    };

    let error = validate_grpc_mock_rule_set(&rule_set).expect_err("expected invalid expression error");
    assert!(error.contains("expression"));
}

#[test]
fn evaluate_supports_expression_predicate() {
    let rule_set = GrpcMockRuleSet {
        rules: vec![GrpcMockRule {
            id: "expr-rule".to_string(),
            name: "Expression Rule".to_string(),
            enabled: true,
            priority: 1,
            created_at: None,
            fallthrough: Some(false),
            predicate: GrpcMockPredicate::Expression {
                expression: "method == 'Unary' AND metadata.x-mode == 'test'".to_string(),
            },
            response: GrpcMockRuleResponse {
                status_code: Some(0),
                body: Some(serde_json::json!({ "expr": true })),
                messages: None,
                latency_ms: None,
                inter_message_delay_ms: None,
                message: None,
            },
        }],
        default_response: Some(GrpcMockDefaultResponse {
            status_code: Some(12),
            body: None,
            message: Some("default".to_string()),
        }),
    };

    let matched = evaluate_grpc_mock_rule_set(&rule_set, &context_with(serde_json::json!({}))); 
    assert!(matched.matched);
    assert_eq!(matched.rule_id.as_deref(), Some("expr-rule"));

    let unmatched = evaluate_grpc_mock_rule_set(
        &rule_set,
        &GrpcMockEvaluationContext {
            service: "pkg.Service".to_string(),
            method: "Other".to_string(),
            metadata: std::collections::HashMap::from([("x-mode".to_string(), "test".to_string())]),
            request_body: serde_json::json!({}),
        },
    );
    assert!(!unmatched.matched);
    assert!(unmatched.used_default);
}

#[test]
fn expression_allows_metadata_function_key() {
    let rule_set = GrpcMockRuleSet {
        rules: vec![GrpcMockRule {
            id: "expr-function-key".to_string(),
            name: "Expr Function Key".to_string(),
            enabled: true,
            priority: 1,
            created_at: None,
            fallthrough: Some(false),
            predicate: GrpcMockPredicate::Expression {
                expression: "metadata.function == 'billing'".to_string(),
            },
            response: GrpcMockRuleResponse {
                status_code: Some(0),
                body: Some(serde_json::json!({ "ok": true })),
                messages: None,
                latency_ms: None,
                inter_message_delay_ms: None,
                message: None,
            },
        }],
        default_response: None,
    };

    validate_grpc_mock_rule_set(&rule_set).expect("metadata.function expression should be valid");
    let result = evaluate_grpc_mock_rule_set(
        &rule_set,
        &GrpcMockEvaluationContext {
            service: "pkg.Service".to_string(),
            method: "Unary".to_string(),
            metadata: std::collections::HashMap::from([("function".to_string(), "billing".to_string())]),
            request_body: serde_json::json!({}),
        },
    );
    assert!(result.matched);
}

#[test]
fn expression_rejects_eval_call_payload() {
    let rule_set = GrpcMockRuleSet {
        rules: vec![GrpcMockRule {
            id: "expr-eval".to_string(),
            name: "Expr Eval".to_string(),
            enabled: true,
            priority: 1,
            created_at: None,
            fallthrough: None,
            predicate: GrpcMockPredicate::Expression {
                expression: "eval('1')".to_string(),
            },
            response: GrpcMockRuleResponse {
                status_code: Some(0),
                body: None,
                messages: None,
                latency_ms: None,
                inter_message_delay_ms: None,
                message: None,
            },
        }],
        default_response: None,
    };

    let error = validate_grpc_mock_rule_set(&rule_set).expect_err("eval payload should be rejected");
    assert!(error.contains("Forbidden expression pattern"));
}

#[test]
fn expression_allows_reserved_word_inside_string_literal() {
    let rule_set = GrpcMockRuleSet {
        rules: vec![GrpcMockRule {
            id: "expr-literal-eval".to_string(),
            name: "Expr Literal Eval".to_string(),
            enabled: true,
            priority: 1,
            created_at: None,
            fallthrough: None,
            predicate: GrpcMockPredicate::Expression {
                expression: "method == 'eval'".to_string(),
            },
            response: GrpcMockRuleResponse {
                status_code: Some(0),
                body: Some(serde_json::json!({ "ok": true })),
                messages: None,
                latency_ms: None,
                inter_message_delay_ms: None,
                message: None,
            },
        }],
        default_response: None,
    };

    validate_grpc_mock_rule_set(&rule_set).expect("quoted reserved words should be allowed");
    let result = evaluate_grpc_mock_rule_set(
        &rule_set,
        &GrpcMockEvaluationContext {
            service: "pkg.Service".to_string(),
            method: "eval".to_string(),
            metadata: std::collections::HashMap::new(),
            request_body: serde_json::json!({}),
        },
    );
    assert!(result.matched);
}

#[test]
fn expression_rejects_function_constructor_payload() {
    let rule_set = GrpcMockRuleSet {
        rules: vec![GrpcMockRule {
            id: "expr-function-ctor".to_string(),
            name: "Expr Function Constructor".to_string(),
            enabled: true,
            priority: 1,
            created_at: None,
            fallthrough: None,
            predicate: GrpcMockPredicate::Expression {
                expression: "Function('return 1')()".to_string(),
            },
            response: GrpcMockRuleResponse {
                status_code: Some(0),
                body: None,
                messages: None,
                latency_ms: None,
                inter_message_delay_ms: None,
                message: None,
            },
        }],
        default_response: None,
    };

    let error = validate_grpc_mock_rule_set(&rule_set)
        .expect_err("Function constructor payload should be rejected");
    assert!(error.contains("Forbidden expression pattern"));
}
