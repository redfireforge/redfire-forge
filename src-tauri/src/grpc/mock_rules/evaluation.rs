use serde_json::Value;

use super::expression::parse_grpc_mock_predicate_expression;
use super::types::*;

pub fn validate_grpc_mock_rule_set(rule_set: &GrpcMockRuleSet) -> Result<(), String> {
    let mut seen_ids = std::collections::HashSet::<String>::new();
    for (index, rule) in rule_set.rules.iter().enumerate() {
        let path = format!("rules[{index}]");
        if rule.id.trim().is_empty() {
            return Err(format!("{path}.id is required"));
        }
        if rule.name.trim().is_empty() {
            return Err(format!("{path}.name is required"));
        }
        if !seen_ids.insert(rule.id.clone()) {
            return Err(format!("{path}.id duplicate rule id: {}", rule.id));
        }
        if let Some(code) = rule.response.status_code {
            if code < 0 {
                return Err(format!("{path}.response.statusCode must be non-negative"));
            }
        }
        validate_predicate(&rule.predicate, &format!("{path}.predicate"))?;
    }

    if let Some(default_response) = &rule_set.default_response {
        if let Some(code) = default_response.status_code {
            if code < 0 {
                return Err("defaultResponse.statusCode must be non-negative".to_string());
            }
        }
    }

    Ok(())
}

pub fn evaluate_grpc_mock_rule_set(
    rule_set: &GrpcMockRuleSet,
    context: &GrpcMockEvaluationContext,
) -> GrpcMockRuleEvaluationResult {
    let mut ordered: Vec<(usize, &GrpcMockRule)> = rule_set.rules.iter().enumerate().collect();
    ordered.sort_by(|(left_index, left), (right_index, right)| {
        left.priority
            .cmp(&right.priority)
            .then_with(|| left.created_at.as_deref().unwrap_or("").cmp(right.created_at.as_deref().unwrap_or("")))
            .then_with(|| left_index.cmp(right_index))
    });

    let mut fallthrough_chain: Vec<String> = Vec::new();
    let mut fallthrough_candidate: Option<&GrpcMockRule> = None;

    for (_, rule) in ordered {
        if !rule.enabled {
            continue;
        }
        if !evaluate_predicate(&rule.predicate, context) {
            continue;
        }

        if rule.fallthrough.unwrap_or(false) {
            fallthrough_chain.push(rule.id.clone());
            fallthrough_candidate = Some(rule);
            continue;
        }

        return GrpcMockRuleEvaluationResult {
            matched: true,
            used_default: false,
            rule_id: Some(rule.id.clone()),
            rule_name: Some(rule.name.clone()),
            fallthrough_chain,
            response: rule.response.clone(),
        };
    }

    if let Some(rule) = fallthrough_candidate {
        return GrpcMockRuleEvaluationResult {
            matched: true,
            used_default: false,
            rule_id: Some(rule.id.clone()),
            rule_name: Some(rule.name.clone()),
            fallthrough_chain,
            response: rule.response.clone(),
        };
    }

    GrpcMockRuleEvaluationResult {
        matched: false,
        used_default: true,
        rule_id: None,
        rule_name: None,
        fallthrough_chain: Vec::new(),
        response: default_response_from(rule_set.default_response.as_ref()),
    }
}

fn validate_predicate(predicate: &GrpcMockPredicate, path: &str) -> Result<(), String> {
    match predicate {
        GrpcMockPredicate::MethodEquals { method } => {
            if method.trim().is_empty() {
                return Err(format!("{path}.method is required"));
            }
        }
        GrpcMockPredicate::ServiceEquals { service } => {
            if service.trim().is_empty() {
                return Err(format!("{path}.service is required"));
            }
        }
        GrpcMockPredicate::MetadataEquals { key, .. } | GrpcMockPredicate::MetadataExists { key } => {
            if key.trim().is_empty() {
                return Err(format!("{path}.key is required"));
            }
        }
        GrpcMockPredicate::BodyPathEquals { path: body_path, .. }
        | GrpcMockPredicate::BodyPathExists { path: body_path } => {
            if body_path.trim().is_empty() {
                return Err(format!("{path}.path is required"));
            }
        }
        GrpcMockPredicate::And { predicates } | GrpcMockPredicate::Or { predicates } => {
            if predicates.is_empty() {
                return Err(format!("{path}.predicates must be non-empty"));
            }
            for (index, child) in predicates.iter().enumerate() {
                validate_predicate(child, &format!("{path}.predicates[{index}]"))?;
            }
        }
        GrpcMockPredicate::Not { predicate } => {
            validate_predicate(predicate, &format!("{path}.predicate"))?;
        }
        GrpcMockPredicate::Expression { expression } => {
            if expression.trim().is_empty() {
                return Err(format!("{path}.expression is required"));
            }
            parse_grpc_mock_predicate_expression(expression)
                .map_err(|error| format!("{path}.expression {error}"))?;
        }
    }
    Ok(())
}

fn evaluate_predicate(predicate: &GrpcMockPredicate, context: &GrpcMockEvaluationContext) -> bool {
    match predicate {
        GrpcMockPredicate::MethodEquals { method } => context.method == *method,
        GrpcMockPredicate::ServiceEquals { service } => context.service == *service,
        GrpcMockPredicate::MetadataEquals { key, value } => {
            context.metadata.get(key).map(|existing| existing == value).unwrap_or(false)
        }
        GrpcMockPredicate::MetadataExists { key } => context.metadata.get(key).is_some(),
        GrpcMockPredicate::BodyPathEquals { path, value } => {
            value_to_comparable_string(resolve_body_path_value(&context.request_body, path)) == *value
        }
        GrpcMockPredicate::BodyPathExists { path } => {
            resolve_body_path_value(&context.request_body, path).is_some()
        }
        GrpcMockPredicate::And { predicates } => {
            predicates.iter().all(|predicate| evaluate_predicate(predicate, context))
        }
        GrpcMockPredicate::Or { predicates } => {
            predicates.iter().any(|predicate| evaluate_predicate(predicate, context))
        }
        GrpcMockPredicate::Not { predicate } => !evaluate_predicate(predicate, context),
        GrpcMockPredicate::Expression { expression } => {
            match parse_grpc_mock_predicate_expression(expression) {
                Ok(parsed) => evaluate_predicate(&parsed, context),
                Err(_) => false,
            }
        }
    }
}

fn default_response_from(default_response: Option<&GrpcMockDefaultResponse>) -> GrpcMockRuleResponse {
    GrpcMockRuleResponse {
        status_code: Some(default_response.and_then(|response| response.status_code).unwrap_or(GRPC_MOCK_DEFAULT_STATUS_CODE)),
        body: default_response.and_then(|response| response.body.clone()),
        messages: None,
        latency_ms: None,
        inter_message_delay_ms: None,
        message: Some(
            default_response
                .and_then(|response| response.message.clone())
                .unwrap_or_else(|| GRPC_MOCK_DEFAULT_STATUS_MESSAGE.to_string()),
        ),
    }
}

fn value_to_comparable_string(value: Option<&Value>) -> String {
    match value {
        None => String::new(),
        Some(Value::Null) => String::new(),
        Some(Value::Bool(flag)) => {
            if *flag {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        Some(Value::Number(number)) => number.to_string(),
        Some(Value::String(text)) => text.clone(),
        Some(other) => other.to_string(),
    }
}

fn resolve_body_path_value<'a>(root: &'a Value, path: &str) -> Option<&'a Value> {
    if path.contains("__proto__") || path.contains("constructor") || path.contains("prototype") {
        return None;
    }

    let trimmed = path.trim();
    let normalized = if let Some(stripped) = trimmed.strip_prefix("$.") {
        stripped
    } else if trimmed == "$" {
        ""
    } else {
        trimmed
    };

    if normalized.is_empty() {
        return Some(root);
    }

    let pointer = to_json_pointer(normalized);
    root.pointer(&pointer)
}

fn to_json_pointer(path: &str) -> String {
    let mut tokens: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut chars = path.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '.' => {
                if !current.is_empty() {
                    tokens.push(current.clone());
                    current.clear();
                }
            }
            '[' => {
                if !current.is_empty() {
                    tokens.push(current.clone());
                    current.clear();
                }
                let mut index_text = String::new();
                while let Some(next) = chars.next() {
                    if next == ']' {
                        break;
                    }
                    index_text.push(next);
                }
                if !index_text.is_empty() {
                    tokens.push(index_text);
                }
            }
            _ => current.push(ch),
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    let escaped: Vec<String> = tokens
        .into_iter()
        .map(|token| token.replace('~', "~0").replace('/', "~1"))
        .collect();

    if escaped.is_empty() {
        String::new()
    } else {
        format!("/{}", escaped.join("/"))
    }
}
