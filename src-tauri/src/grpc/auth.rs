//! Auth metadata resolution for native gRPC unary calls — Phase 7C.
//!
//! Mirrors `mergeGrpcExecuteMetadata` from the renderer auth policy. OAuth2 token
//! acquisition remains on Express in 7C — native returns a validation error.

use std::collections::HashMap;

use base64::Engine;

use crate::grpc::types::{GrpcTauriAuthConfig, GrpcTauriAuthType};

#[derive(Debug)]
pub enum AuthResolveError {
    Validation { field: String, message: String },
}

pub fn merge_auth_metadata(
    manual_metadata: Option<&HashMap<String, String>>,
    auth: Option<&GrpcTauriAuthConfig>,
) -> Result<HashMap<String, String>, AuthResolveError> {
    let mut merged = normalize_metadata_keys(manual_metadata);

    let Some(auth) = auth else {
        return Ok(merged);
    };

    match auth.auth_type {
        GrpcTauriAuthType::None => Ok(merged),
        GrpcTauriAuthType::Bearer => {
            let token = auth
                .bearer_token
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or(AuthResolveError::Validation {
                    field: "auth.bearerToken".to_string(),
                    message: "Bearer token is required".to_string(),
                })?;
            merged.insert("authorization".to_string(), format!("Bearer {token}"));
            Ok(merged)
        }
        GrpcTauriAuthType::Basic => {
            let username = auth
                .basic_username
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or(AuthResolveError::Validation {
                    field: "auth.basicUsername".to_string(),
                    message: "Basic auth username is required".to_string(),
                })?;
            let password = auth.basic_password.as_deref().unwrap_or("");
            let encoded = base64::engine::general_purpose::STANDARD
                .encode(format!("{username}:{password}"));
            merged.insert("authorization".to_string(), format!("Basic {encoded}"));
            Ok(merged)
        }
        GrpcTauriAuthType::ApiKey => {
            let name = auth
                .api_key_name
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or(AuthResolveError::Validation {
                    field: "auth.apiKeyName".to_string(),
                    message: "API key header name is required".to_string(),
                })?
                .to_lowercase();
            let value = auth.api_key_value.as_deref().unwrap_or("");
            if value.trim().is_empty() {
                return Err(AuthResolveError::Validation {
                    field: "auth.apiKeyValue".to_string(),
                    message: "API key value is required".to_string(),
                });
            }
            merged.insert(name, value.to_string());
            Ok(merged)
        }
        GrpcTauriAuthType::Oauth2 => Err(AuthResolveError::Validation {
            field: "auth.oauth2".to_string(),
            message: "OAuth2 token acquisition is not supported in native gRPC transport yet — use Express proxy or bearer token".to_string(),
        }),
    }
}

fn normalize_metadata_keys(
    metadata: Option<&HashMap<String, String>>,
) -> HashMap<String, String> {
    let mut normalized = HashMap::new();
    if let Some(metadata) = metadata {
        for (key, value) in metadata {
            let trimmed = key.trim().to_lowercase();
            if trimmed.is_empty() {
                continue;
            }
            normalized.insert(trimmed, value.clone());
        }
    }
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grpc::types::GrpcTauriAuthType;

    fn auth_config(auth_type: GrpcTauriAuthType) -> GrpcTauriAuthConfig {
        GrpcTauriAuthConfig {
            auth_type,
            bearer_token: Some("secret-token".to_string()),
            basic_username: Some("alice".to_string()),
            basic_password: Some("pass".to_string()),
            api_key_name: Some("x-api-key".to_string()),
            api_key_value: Some("key-value".to_string()),
            oauth2: None,
        }
    }

    #[test]
    fn bearer_auth_overrides_manual_authorization() {
        let mut manual = HashMap::new();
        manual.insert("Authorization".to_string(), "Bearer manual".to_string());
        let merged = merge_auth_metadata(Some(&manual), Some(&auth_config(GrpcTauriAuthType::Bearer)))
            .expect("bearer merge");
        assert_eq!(merged.get("authorization"), Some(&"Bearer secret-token".to_string()));
    }

    #[test]
    fn oauth2_returns_validation_error() {
        let err = merge_auth_metadata(None, Some(&auth_config(GrpcTauriAuthType::Oauth2)))
            .expect_err("oauth2 unsupported");
        assert!(matches!(err, AuthResolveError::Validation { .. }));
    }

    #[test]
    fn api_key_header_is_lowercased() {
        let mut cfg = auth_config(GrpcTauriAuthType::ApiKey);
        cfg.api_key_name = Some("X-Custom-Key".to_string());
        let merged = merge_auth_metadata(None, Some(&cfg)).expect("api key merge");
        assert_eq!(merged.get("x-custom-key"), Some(&"key-value".to_string()));
    }
}
