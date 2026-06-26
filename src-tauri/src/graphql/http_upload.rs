//! Tauri command: GraphQL multipart file upload with custom TLS (skip-cert, CA, mTLS).

use std::collections::HashMap;

use base64::Engine;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::multipart;
use serde::Deserialize;

use crate::websocket::config::build_rustls_client_config;
use crate::websocket::types::WsTlsConfig;

use super::http_fetch::GqlHttpFetchResponse;

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlUploadPart {
    pub kind: String,
    pub name: String,
    pub value: Option<String>,
    pub filename: Option<String>,
    pub mime_type: Option<String>,
    pub data_base64: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlHttpUploadRequest {
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
    pub parts: Vec<GqlUploadPart>,
    pub skip_tls_verify: Option<bool>,
    pub ca_cert: Option<String>,
    pub client_cert: Option<String>,
    pub client_key: Option<String>,
}

fn tls_from_request(req: &GqlHttpUploadRequest) -> WsTlsConfig {
    WsTlsConfig {
        reject_unauthorized: if req.skip_tls_verify == Some(true) {
            Some(false)
        } else {
            None
        },
        ca_cert: req.ca_cert.clone(),
        client_cert: req.client_cert.clone(),
        client_key: req.client_key.clone(),
    }
}

fn build_header_map(headers: &HashMap<String, String>) -> Result<HeaderMap, String> {
    let mut map = HeaderMap::new();
    for (name, value) in headers {
        if name.eq_ignore_ascii_case("content-type") {
            continue;
        }
        let header_name = HeaderName::from_bytes(name.as_bytes())
            .map_err(|e| format!("Invalid header name '{}': {}", name, e))?;
        let header_value = HeaderValue::from_str(value)
            .map_err(|e| format!("Invalid header value for '{}': {}", name, e))?;
        map.insert(header_name, header_value);
    }
    Ok(map)
}

fn build_multipart_form(parts: &[GqlUploadPart]) -> Result<multipart::Form, String> {
    let mut form = multipart::Form::new();
    for part in parts {
        match part.kind.as_str() {
            "field" => {
                let value = part.value.as_deref().unwrap_or("");
                form = form.text(part.name.clone(), value.to_string());
            }
            "file" => {
                let data_b64 = part
                    .data_base64
                    .as_deref()
                    .ok_or_else(|| format!("file part '{}' missing dataBase64", part.name))?;
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(data_b64)
                    .map_err(|e| format!("Invalid base64 for file part '{}': {}", part.name, e))?;
                let filename = part
                    .filename
                    .clone()
                    .unwrap_or_else(|| "upload.bin".to_string());
                let mime = part.mime_type.as_deref().unwrap_or("application/octet-stream");
                let file_part = multipart::Part::bytes(bytes)
                    .file_name(filename)
                    .mime_str(mime)
                    .map_err(|e| format!("Invalid MIME type for '{}': {}", part.name, e))?;
                form = form.part(part.name.clone(), file_part);
            }
            other => return Err(format!("Unknown upload part kind: {}", other)),
        }
    }
    Ok(form)
}

async fn upload_with_client(
    client: reqwest::Client,
    req: &GqlHttpUploadRequest,
) -> Result<GqlHttpFetchResponse, String> {
    let form = build_multipart_form(&req.parts)?;
    let headers = build_header_map(req.headers.as_ref().unwrap_or(&HashMap::new()))?;

    let response = client
        .post(&req.url)
        .headers(headers)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("GraphQL upload request failed: {}", e))?;

    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let mut out_headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(v) = value.to_str() {
            out_headers.insert(key.as_str().to_string(), v.to_string());
        }
    }
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read upload response body: {}", e))?;

    Ok(GqlHttpFetchResponse {
        status: status.as_u16(),
        status_text,
        headers: out_headers,
        body,
        error: None,
    })
}

#[tauri::command]
pub async fn gql_http_upload(
    request: GqlHttpUploadRequest,
) -> Result<GqlHttpFetchResponse, String> {
    let tls = tls_from_request(&request);
    let rustls_cfg = build_rustls_client_config(&tls)?;

    let client = if let Some(cfg) = rustls_cfg {
        reqwest::Client::builder()
            .use_preconfigured_tls(cfg)
            .build()
            .map_err(|e| format!("Failed to build TLS HTTP client: {}", e))?
    } else {
        reqwest::Client::builder()
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?
    };

    upload_with_client(client, &request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_multipart_form_accepts_field_and_file_parts() {
        let parts = vec![
            GqlUploadPart {
                kind: "field".to_string(),
                name: "operations".to_string(),
                value: Some(r#"{"query":"mutation {m}"}"#.to_string()),
                filename: None,
                mime_type: None,
                data_base64: None,
            },
            GqlUploadPart {
                kind: "file".to_string(),
                name: "0".to_string(),
                value: None,
                filename: Some("test.txt".to_string()),
                mime_type: Some("text/plain".to_string()),
                data_base64: Some(base64::engine::general_purpose::STANDARD.encode(b"hello")),
            },
        ];
        let form = build_multipart_form(&parts).expect("multipart form");
        drop(form);
    }

    #[test]
    fn build_multipart_form_rejects_unknown_kind() {
        let parts = vec![GqlUploadPart {
            kind: "blob".to_string(),
            name: "x".to_string(),
            value: None,
            filename: None,
            mime_type: None,
            data_base64: None,
        }];
        assert!(build_multipart_form(&parts).is_err());
    }
}
