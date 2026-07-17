//! Tauri command: GraphQL HTTP fetch with custom TLS (skip-cert, CA, mTLS).
//!
//! Mirrors WebSocket native TLS — used by GraphQL Studio introspection and execute
//! when the frontend cannot apply PEM settings via the webview HTTP stack.

use std::collections::HashMap;
use std::time::Instant;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};

use crate::websocket::config::build_rustls_client_config;
use crate::websocket::types::WsTlsConfig;

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlHttpFetchRequest {
    pub url: String,
    pub method: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub skip_tls_verify: Option<bool>,
    pub ca_cert: Option<String>,
    pub client_cert: Option<String>,
    pub client_key: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlHttpFetchResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn tls_from_request(req: &GqlHttpFetchRequest) -> WsTlsConfig {
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
        let header_name = HeaderName::from_bytes(name.as_bytes())
            .map_err(|e| format!("Invalid header name '{}': {}", name, e))?;
        let header_value = HeaderValue::from_str(value)
            .map_err(|e| format!("Invalid header value for '{}': {}", name, e))?;
        map.insert(header_name, header_value);
    }
    Ok(map)
}

async fn fetch_with_client(
    client: reqwest::Client,
    req: &GqlHttpFetchRequest,
) -> Result<GqlHttpFetchResponse, String> {
    let method = req.method.to_uppercase();
    let headers = build_header_map(req.headers.as_ref().unwrap_or(&HashMap::new()))?;

    let mut builder = client.request(
        reqwest::Method::from_bytes(method.as_bytes())
            .map_err(|e| format!("Invalid HTTP method: {}", e))?,
        &req.url,
    );
    builder = builder.headers(headers);
    if let Some(body) = &req.body {
        if method != "GET" && method != "HEAD" {
            builder = builder.body(body.clone());
        }
    }

    let started = Instant::now();
    let response = builder
        .send()
        .await
        .map_err(|e| format!("GraphQL HTTP request failed: {}", e))?;
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
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    let _elapsed = started.elapsed();

    Ok(GqlHttpFetchResponse {
        status: status.as_u16(),
        status_text,
        headers: out_headers,
        body,
        error: None,
    })
}

#[tauri::command]
pub async fn gql_http_fetch(request: GqlHttpFetchRequest) -> Result<GqlHttpFetchResponse, String> {
    let tls = tls_from_request(&request);
    let rustls_cfg = build_rustls_client_config(&tls)?;

    // Loopback GraphQL (lessons, local Docker) must bypass the OS HTTP proxy — corporate
    // proxies often reject CONNECT to 127.0.0.1/localhost and break introspection.
    let client = if let Some(cfg) = rustls_cfg {
        reqwest::Client::builder()
            .no_proxy()
            // reqwest rejects Arc<ClientConfig> — pass an owned config (see reqwest#2622).
            .use_preconfigured_tls((*cfg).clone())
            .build()
            .map_err(|e| format!("Failed to build TLS HTTP client: {}", e))?
    } else {
        reqwest::Client::builder()
            .no_proxy()
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?
    };

    fetch_with_client(client, &request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tls_from_request_maps_skip_tls_verify() {
        let req = GqlHttpFetchRequest {
            url: "https://localhost/graphql".to_string(),
            method: "POST".to_string(),
            headers: None,
            body: None,
            skip_tls_verify: Some(true),
            ca_cert: None,
            client_cert: None,
            client_key: None,
        };
        let tls = tls_from_request(&req);
        assert_eq!(tls.reject_unauthorized, Some(false));
    }

    #[test]
    fn tls_from_request_maps_mtls_fields() {
        let req = GqlHttpFetchRequest {
            url: "https://localhost:4445/graphql".to_string(),
            method: "POST".to_string(),
            headers: None,
            body: Some("{}".to_string()),
            skip_tls_verify: None,
            ca_cert: Some("ca".to_string()),
            client_cert: Some("cert".to_string()),
            client_key: Some("key".to_string()),
        };
        let tls = tls_from_request(&req);
        assert_eq!(tls.ca_cert.as_deref(), Some("ca"));
        assert_eq!(tls.client_cert.as_deref(), Some("cert"));
        assert_eq!(tls.client_key.as_deref(), Some("key"));
    }

    #[test]
    fn reqwest_accepts_owned_rustls_config_not_arc() {
        let req = GqlHttpFetchRequest {
            url: "https://localhost:4443/graphql".to_string(),
            method: "POST".to_string(),
            headers: None,
            body: None,
            skip_tls_verify: Some(true),
            ca_cert: None,
            client_cert: None,
            client_key: None,
        };
        let cfg = build_rustls_client_config(&tls_from_request(&req))
            .expect("rustls config")
            .expect("skip-verify config");
        let built = reqwest::Client::builder()
            .no_proxy()
            .use_preconfigured_tls((*cfg).clone())
            .build();
        assert!(built.is_ok(), "owned ClientConfig must build: {:?}", built.err());
        // Arc wrapper is rejected by reqwest (UnknownPreconfigured → builder error).
        let arc_fail = reqwest::Client::builder()
            .no_proxy()
            .use_preconfigured_tls(cfg)
            .build();
        assert!(arc_fail.is_err());
    }

    /// Live integration — requires `gql-tls-proxy` on https://localhost:4443.
    #[tokio::test]
    #[ignore = "requires gql-tls-proxy docker stack on :4443"]
    async fn live_skip_verify_post_to_tls_proxy() {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());
        let req = GqlHttpFetchRequest {
            url: "https://localhost:4443/graphql".to_string(),
            method: "POST".to_string(),
            headers: Some(headers),
            body: Some(r#"{"query":"{ __typename }"}"#.to_string()),
            skip_tls_verify: Some(true),
            ca_cert: None,
            client_cert: None,
            client_key: None,
        };
        let resp = gql_http_fetch(req).await.expect("fetch should succeed");
        assert_eq!(resp.status, 200, "body: {}", resp.body);
        assert!(resp.body.contains("__typename"), "body: {}", resp.body);
    }

    /// Live mTLS — requires `gql-mtls-proxy` on https://localhost:4445 and PEM files in /tmp.
    #[tokio::test]
    #[ignore = "requires gql-mtls-proxy docker stack on :4445 and /tmp/gql-client.{crt,key}, /tmp/gql-ca.crt"]
    async fn live_mtls_post_to_mtls_proxy() {
        let ca = std::fs::read_to_string("/tmp/gql-ca.crt").expect("ca cert");
        let client_cert = std::fs::read_to_string("/tmp/gql-client.crt").expect("client cert");
        let client_key = std::fs::read_to_string("/tmp/gql-client.key").expect("client key");
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());
        let req = GqlHttpFetchRequest {
            url: "https://localhost:4445/graphql".to_string(),
            method: "POST".to_string(),
            headers: Some(headers),
            body: Some(r#"{"query":"{ __typename }"}"#.to_string()),
            skip_tls_verify: None,
            ca_cert: Some(ca),
            client_cert: Some(client_cert),
            client_key: Some(client_key),
        };
        let resp = gql_http_fetch(req).await.expect("mTLS fetch should succeed");
        assert_eq!(resp.status, 200, "body: {}", resp.body);
        assert!(resp.body.contains("__typename"), "body: {}", resp.body);
    }
}
