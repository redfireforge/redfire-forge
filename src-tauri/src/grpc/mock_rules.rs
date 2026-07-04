//! Native mock rule validation/evaluation (Phase 11M parity slice).

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const GRPC_MOCK_DEFAULT_STATUS_CODE: i32 = 12;
pub const GRPC_MOCK_DEFAULT_STATUS_MESSAGE: &str = "No matching mock rule";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum GrpcMockPredicate {
    MethodEquals { method: String },
    ServiceEquals { service: String },
    MetadataEquals { key: String, value: String },
    MetadataExists { key: String },
    BodyPathEquals { path: String, value: String },
    BodyPathExists { path: String },
    And { predicates: Vec<GrpcMockPredicate> },
    Or { predicates: Vec<GrpcMockPredicate> },
    Not { predicate: Box<GrpcMockPredicate> },
    Expression { expression: String },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcMockRuleResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub messages: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inter_message_delay_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcMockDefaultResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcMockRule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub priority: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallthrough: Option<bool>,
    pub predicate: GrpcMockPredicate,
    pub response: GrpcMockRuleResponse,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrpcMockRuleSet {
    pub rules: Vec<GrpcMockRule>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_response: Option<GrpcMockDefaultResponse>,
}

#[derive(Clone, Debug)]
pub struct GrpcMockEvaluationContext {
    pub service: String,
    pub method: String,
    pub metadata: std::collections::HashMap<String, String>,
    pub request_body: Value,
}

#[derive(Clone, Debug)]
pub struct GrpcMockRuleEvaluationResult {
    pub matched: bool,
    pub used_default: bool,
    pub rule_id: Option<String>,
    pub rule_name: Option<String>,
    pub fallthrough_chain: Vec<String>,
    pub response: GrpcMockRuleResponse,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TokenKind {
    Ident,
    String,
    Number,
    Boolean,
    Op,
    LParen,
    RParen,
    Eof,
}

#[derive(Clone, Debug)]
struct Token {
    kind: TokenKind,
    value: String,
    position: usize,
}

#[derive(Debug)]
enum ExpressionError {
    Parse(String),
    Security(String),
}

impl std::fmt::Display for ExpressionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExpressionError::Parse(message) | ExpressionError::Security(message) => {
                write!(f, "{message}")
            }
        }
    }
}

impl std::error::Error for ExpressionError {}

struct Parser {
    tokens: Vec<Token>,
    index: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, index: 0 }
    }

    fn parse(mut self) -> Result<GrpcMockPredicate, ExpressionError> {
        let predicate = self.parse_or()?;
        if self.peek().kind != TokenKind::Eof {
            return Err(ExpressionError::Parse(format!(
                "Unexpected token at position {}",
                self.peek().position
            )));
        }
        Ok(predicate)
    }

    fn parse_or(&mut self) -> Result<GrpcMockPredicate, ExpressionError> {
        let mut predicates = vec![self.parse_and()?];
        while self.peek().kind == TokenKind::Op && self.peek().value == "OR" {
            self.consume();
            predicates.push(self.parse_and()?);
        }
        if predicates.len() == 1 {
            Ok(predicates.remove(0))
        } else {
            Ok(GrpcMockPredicate::Or { predicates })
        }
    }

    fn parse_and(&mut self) -> Result<GrpcMockPredicate, ExpressionError> {
        let mut predicates = vec![self.parse_not()?];
        while self.peek().kind == TokenKind::Op && self.peek().value == "AND" {
            self.consume();
            predicates.push(self.parse_not()?);
        }
        if predicates.len() == 1 {
            Ok(predicates.remove(0))
        } else {
            Ok(GrpcMockPredicate::And { predicates })
        }
    }

    fn parse_not(&mut self) -> Result<GrpcMockPredicate, ExpressionError> {
        if self.peek().kind == TokenKind::Op && self.peek().value == "NOT" {
            self.consume();
            return Ok(GrpcMockPredicate::Not {
                predicate: Box::new(self.parse_not()?),
            });
        }
        self.parse_comparison()
    }

    fn parse_comparison(&mut self) -> Result<GrpcMockPredicate, ExpressionError> {
        if self.peek().kind == TokenKind::LParen {
            self.consume();
            let inner = self.parse_or()?;
            self.consume_expect_kind(TokenKind::RParen)?;
            return Ok(inner);
        }
        self.parse_atomic_predicate()
    }

    fn parse_atomic_predicate(&mut self) -> Result<GrpcMockPredicate, ExpressionError> {
        let root = self.consume_expect_kind(TokenKind::Ident)?;

        if root.value == "method" {
            let op = self.consume_expect_op()?;
            let literal = self.parse_literal()?;
            let base = GrpcMockPredicate::MethodEquals { method: literal };
            return if op == "==" {
                Ok(base)
            } else {
                Ok(GrpcMockPredicate::Not {
                    predicate: Box::new(base),
                })
            };
        }

        if root.value == "service" {
            let op = self.consume_expect_op()?;
            let literal = self.parse_literal()?;
            let base = GrpcMockPredicate::ServiceEquals { service: literal };
            return if op == "==" {
                Ok(base)
            } else {
                Ok(GrpcMockPredicate::Not {
                    predicate: Box::new(base),
                })
            };
        }

        if root.value == "request" || root.value.starts_with("request.") {
            let path = if root.value == "request" {
                let token = self.consume_expect_kind(TokenKind::Ident)?;
                assert_safe_path_segment(&token.value, token.position)?
            } else {
                assert_safe_path_segment(&root.value["request.".len()..], root.position)?
            };

            if self.peek().kind == TokenKind::Op
                && (self.peek().value == "==" || self.peek().value == "!=")
            {
                let op = self.consume_expect_op()?;
                let literal = self.parse_literal()?;
                let base = GrpcMockPredicate::BodyPathEquals {
                    path,
                    value: literal,
                };
                return if op == "==" {
                    Ok(base)
                } else {
                    Ok(GrpcMockPredicate::Not {
                        predicate: Box::new(base),
                    })
                };
            }

            return Ok(GrpcMockPredicate::BodyPathExists { path });
        }

        if root.value == "metadata" || root.value.starts_with("metadata.") {
            let key = if root.value == "metadata" {
                let token = self.consume_expect_kind(TokenKind::Ident)?;
                assert_safe_metadata_key(&token.value, token.position)?
            } else {
                assert_safe_metadata_key(&root.value["metadata.".len()..], root.position)?
            };

            let op = self.consume_expect_op()?;
            let literal = self.parse_literal()?;
            let base = GrpcMockPredicate::MetadataEquals { key, value: literal };
            return if op == "==" {
                Ok(base)
            } else {
                Ok(GrpcMockPredicate::Not {
                    predicate: Box::new(base),
                })
            };
        }

        Err(ExpressionError::Parse(format!(
            "Unknown identifier '{}' at position {}",
            root.value, root.position
        )))
    }

    fn parse_literal(&mut self) -> Result<String, ExpressionError> {
        let token = self.consume();
        match token.kind {
            TokenKind::String | TokenKind::Number | TokenKind::Boolean => Ok(token.value),
            _ => Err(ExpressionError::Parse(format!(
                "Expected literal at position {}",
                token.position
            ))),
        }
    }

    fn consume_expect_kind(&mut self, expected: TokenKind) -> Result<Token, ExpressionError> {
        let token = self.consume();
        if token.kind == expected {
            return Ok(token);
        }
        Err(ExpressionError::Parse(format!(
            "Expected {:?} at position {}, found '{}'",
            expected, token.position, token.value
        )))
    }

    fn consume_expect_op(&mut self) -> Result<String, ExpressionError> {
        let token = self.consume_expect_kind(TokenKind::Op)?;
        if token.value == "==" || token.value == "!=" {
            return Ok(token.value);
        }
        Err(ExpressionError::Parse(format!(
            "Expected comparison operator at position {}",
            token.position
        )))
    }

    fn consume(&mut self) -> Token {
        let token = self.peek().clone();
        self.index += 1;
        token
    }

    fn peek(&self) -> &Token {
        self.tokens
            .get(self.index)
            .unwrap_or_else(|| self.tokens.last().expect("token stream has eof"))
    }
}

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

fn parse_grpc_mock_predicate_expression(
    expression: &str,
) -> Result<GrpcMockPredicate, ExpressionError> {
    assert_expression_is_safe(expression)?;
    let tokens = tokenize_expression(expression)?;
    Parser::new(tokens).parse()
}

fn assert_expression_is_safe(expression: &str) -> Result<(), ExpressionError> {
    let trimmed = expression.trim();
    if trimmed.is_empty() {
        return Err(ExpressionError::Parse("Expression cannot be empty".to_string()));
    }

    let scan_target = strip_quoted_literals_for_scan(trimmed);
    let scan_target_lower = scan_target.to_lowercase();

    if scan_target.contains("=>")
        || scan_target.contains(';')
        || scan_target.contains('`')
        || contains_word_ci(&scan_target, "eval")
        || contains_word_case_sensitive(&scan_target, "Function")
        || scan_target_lower.contains("new function")
        || contains_word_ci(&scan_target, "import")
        || contains_word_ci(&scan_target, "require")
        || contains_word_case_sensitive(&scan_target, "__proto__")
        || contains_word_case_sensitive(&scan_target, "constructor")
        || contains_word_case_sensitive(&scan_target, "prototype")
    {
        return Err(ExpressionError::Security(
            "Forbidden expression pattern detected".to_string(),
        ));
    }

    Ok(())
}

fn contains_word_case_sensitive(haystack: &str, word: &str) -> bool {
    haystack
        .split(|ch: char| !ch.is_ascii_alphanumeric() && ch != '_')
        .any(|part| part == word)
}

fn contains_word_ci(haystack: &str, word: &str) -> bool {
    let haystack_lower = haystack.to_lowercase();
    let word_lower = word.to_lowercase();
    haystack_lower
        .split(|ch: char| !ch.is_ascii_alphanumeric() && ch != '_')
        .any(|part| part == word_lower)
}

fn strip_quoted_literals_for_scan(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '"' || ch == '\'' {
            let quote = ch;
            output.push(quote);
            while let Some(next) = chars.next() {
                if next == '\\' {
                    let _ = chars.next();
                    continue;
                }
                if next == quote {
                    output.push(quote);
                    break;
                }
            }
            continue;
        }
        output.push(ch);
    }

    output
}

fn tokenize_expression(expression: &str) -> Result<Vec<Token>, ExpressionError> {
    let mut tokens: Vec<Token> = Vec::new();
    let chars: Vec<char> = expression.chars().collect();
    let mut index = 0usize;

    while index < chars.len() {
        let ch = chars[index];
        if ch.is_whitespace() {
            index += 1;
            continue;
        }

        if ch == '(' {
            tokens.push(Token {
                kind: TokenKind::LParen,
                value: "(".to_string(),
                position: index,
            });
            index += 1;
            continue;
        }
        if ch == ')' {
            tokens.push(Token {
                kind: TokenKind::RParen,
                value: ")".to_string(),
                position: index,
            });
            index += 1;
            continue;
        }

        if ch == '"' || ch == '\'' {
            let quote = ch;
            let start = index;
            index += 1;
            let mut value = String::new();
            while index < chars.len() {
                let current = chars[index];
                if current == '\\' {
                    if index + 1 >= chars.len() {
                        break;
                    }
                    value.push(chars[index + 1]);
                    index += 2;
                    continue;
                }
                if current == quote {
                    index += 1;
                    break;
                }
                value.push(current);
                index += 1;
            }
            if index > chars.len() || (index == chars.len() && chars[index - 1] != quote) {
                return Err(ExpressionError::Parse(format!(
                    "Unterminated string at position {start}"
                )));
            }
            tokens.push(Token {
                kind: TokenKind::String,
                value,
                position: start,
            });
            continue;
        }

        if ch == '=' && index + 1 < chars.len() && chars[index + 1] == '=' {
            tokens.push(Token {
                kind: TokenKind::Op,
                value: "==".to_string(),
                position: index,
            });
            index += 2;
            continue;
        }
        if ch == '!' && index + 1 < chars.len() && chars[index + 1] == '=' {
            tokens.push(Token {
                kind: TokenKind::Op,
                value: "!=".to_string(),
                position: index,
            });
            index += 2;
            continue;
        }

        if ch.is_ascii_digit() || (ch == '-' && index + 1 < chars.len() && chars[index + 1].is_ascii_digit()) {
            let start = index;
            index += 1;
            while index < chars.len() && (chars[index].is_ascii_digit() || chars[index] == '.') {
                index += 1;
            }
            tokens.push(Token {
                kind: TokenKind::Number,
                value: chars[start..index].iter().collect(),
                position: start,
            });
            continue;
        }

        if ch.is_ascii_alphabetic() || ch == '_' {
            let start = index;
            index += 1;
            while index < chars.len()
                && (chars[index].is_ascii_alphanumeric()
                    || chars[index] == '_'
                    || chars[index] == '.'
                    || chars[index] == '-'
                    || chars[index] == '['
                    || chars[index] == ']')
            {
                index += 1;
            }
            let value: String = chars[start..index].iter().collect();
            let upper = value.to_uppercase();
            if upper == "AND" || upper == "OR" || upper == "NOT" {
                tokens.push(Token {
                    kind: TokenKind::Op,
                    value: upper,
                    position: start,
                });
            } else if upper == "TRUE" || upper == "FALSE" {
                tokens.push(Token {
                    kind: TokenKind::Boolean,
                    value: upper.to_lowercase(),
                    position: start,
                });
            } else {
                tokens.push(Token {
                    kind: TokenKind::Ident,
                    value,
                    position: start,
                });
            }
            continue;
        }

        return Err(ExpressionError::Parse(format!(
            "Unexpected character '{}' at position {}",
            ch, index
        )));
    }

    tokens.push(Token {
        kind: TokenKind::Eof,
        value: String::new(),
        position: expression.len(),
    });
    Ok(tokens)
}

fn normalize_path_segment(value: &str) -> &str {
    if let Some(stripped) = value.strip_prefix('.') {
        stripped
    } else {
        value
    }
}

fn assert_safe_path_segment(value: &str, position: usize) -> Result<String, ExpressionError> {
    let normalized = normalize_path_segment(value).trim();
    if normalized.is_empty()
        || normalized.contains("__proto__")
        || normalized.contains("constructor")
        || normalized.contains("prototype")
    {
        return Err(ExpressionError::Security(format!(
            "Unsafe path segment at position {position}"
        )));
    }
    Ok(normalized.to_string())
}

fn assert_safe_metadata_key(value: &str, position: usize) -> Result<String, ExpressionError> {
    let normalized = normalize_path_segment(value).trim();
    if normalized.is_empty() || normalized.contains("__proto__") {
        return Err(ExpressionError::Security(format!(
            "Unsafe metadata key at position {position}"
        )));
    }
    Ok(normalized.to_string())
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

#[cfg(test)]
mod tests {
    use super::*;

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
}