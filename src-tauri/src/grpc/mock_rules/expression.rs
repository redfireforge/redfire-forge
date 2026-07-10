use super::types::GrpcMockPredicate;

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
pub(crate) enum ExpressionError {
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

pub(crate) fn parse_grpc_mock_predicate_expression(
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

