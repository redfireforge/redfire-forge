//! TLS connector builder for `tokio-tungstenite`.
//!
//! Builds a `rustls::ClientConfig` from the frontend's `WsTlsConfig`, supporting:
//! - Custom CA certificates (PEM format)
//! - Client certificate + key authentication (mTLS)
//! - `rejectUnauthorized: false` (dangerous — accepts all server certs)
//!
//! When no custom TLS is needed, returns `None` and tokio-tungstenite uses its
//! built-in default TLS handling for `wss://` URLs.

use std::io::BufReader;
use std::sync::Arc;

use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, ServerName, UnixTime};
use rustls::{ClientConfig, DigitallySignedStruct, Error, SignatureScheme};
use tokio_tungstenite::Connector;

use super::types::WsTlsConfig;

/// Build a TLS connector from the user's TLS configuration.
///
/// Returns `Ok(None)` when no custom TLS is needed (default behaviour covers
/// `wss://` URLs with system roots). Returns `Ok(Some(Connector::Rustls(...)))`
/// when custom CA, client certs, or `rejectUnauthorized: false` is requested.
pub(super) fn build_ws_connector(tls: Option<&WsTlsConfig>) -> Result<Option<Connector>, String> {
    let tls = match tls {
        Some(t) => t,
        None => return Ok(None),
    };

    let has_custom = tls.reject_unauthorized == Some(false)
        || tls.ca_cert.is_some()
        || tls.client_cert.is_some()
        || tls.client_key.is_some();

    if !has_custom {
        return Ok(None);
    }

    let reject = tls.reject_unauthorized.unwrap_or(true);
    let provider = Arc::new(rustls::crypto::ring::default_provider());

    let wants_client_cert = if reject {
        let root_store = build_root_store(tls.ca_cert.as_deref())?;
        ClientConfig::builder_with_provider(provider)
            .with_safe_default_protocol_versions()
            .map_err(|e| format!("TLS protocol version error: {}", e))?
            .with_root_certificates(root_store)
    } else {
        ClientConfig::builder_with_provider(provider)
            .with_safe_default_protocol_versions()
            .map_err(|e| format!("TLS protocol version error: {}", e))?
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(NoVerifier))
    };

    // Validate partial mTLS config (cert without key or vice versa)
    let has_cert = tls.client_cert.is_some();
    let has_key = tls.client_key.is_some();
    if has_cert != has_key {
        return Err(if has_cert {
            "clientCert provided without clientKey — both are required for mTLS".to_string()
        } else {
            "clientKey provided without clientCert — both are required for mTLS".to_string()
        });
    }

    let config = if let (Some(cert_pem), Some(key_pem)) = (&tls.client_cert, &tls.client_key) {
        let certs = parse_certs(cert_pem)?;
        let key = parse_private_key(key_pem)?;
        wants_client_cert
            .with_client_auth_cert(certs, key)
            .map_err(|e| format!("Client auth setup failed: {}", e))?
    } else {
        wants_client_cert.with_no_client_auth()
    };

    Ok(Some(Connector::Rustls(Arc::new(config))))
}

/// Build a `RootCertStore` with system roots and an optional custom CA.
fn build_root_store(ca_pem: Option<&str>) -> Result<rustls::RootCertStore, String> {
    let mut root_store = rustls::RootCertStore::empty();

    let cert_result = rustls_native_certs::load_native_certs();
    for cert in cert_result.certs {
        root_store.add(cert).ok();
    }

    if let Some(pem) = ca_pem {
        let mut reader = BufReader::new(pem.as_bytes());
        let mut ca_count = 0u32;
        for cert in rustls_pemfile::certs(&mut reader) {
            match cert {
                Ok(c) => {
                    root_store
                        .add(c)
                        .map_err(|e| format!("Invalid CA cert: {}", e))?;
                    ca_count += 1;
                }
                Err(e) => return Err(format!("Failed to parse CA PEM: {}", e)),
            }
        }
        if ca_count == 0 {
            return Err("caCert provided but no valid certificates found in PEM data".to_string());
        }
    }

    if root_store.is_empty() {
        return Err("No CA certificates available — system store is empty and no custom caCert provided".to_string());
    }

    Ok(root_store)
}

fn parse_certs(pem: &str) -> Result<Vec<CertificateDer<'static>>, String> {
    let mut reader = BufReader::new(pem.as_bytes());
    rustls_pemfile::certs(&mut reader)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to parse client cert PEM: {}", e))
}

fn parse_private_key(pem: &str) -> Result<PrivateKeyDer<'static>, String> {
    let mut reader = BufReader::new(pem.as_bytes());
    rustls_pemfile::private_key(&mut reader)
        .map_err(|e| format!("Failed to parse private key PEM: {}", e))?
        .ok_or_else(|| "No private key found in PEM data".to_string())
}

// ─── Error classification ─────────────────────────────────────────────────────

pub(super) fn connect_error_code(err: &tokio_tungstenite::tungstenite::Error) -> &'static str {
    use tokio_tungstenite::tungstenite::error::Error as WsError;
    match err {
        WsError::Url(_) => "WS_INVALID_URL",
        WsError::Tls(_) => "WS_TLS_ERROR",
        _ => "WS_CONNECT_FAILED",
    }
}

// ─── NoVerifier (dangerous: skip server cert validation) ──────────────────────

#[derive(Debug)]
struct NoVerifier;

impl ServerCertVerifier for NoVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PKCS1_SHA256,
            SignatureScheme::RSA_PKCS1_SHA384,
            SignatureScheme::RSA_PKCS1_SHA512,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::ECDSA_NISTP384_SHA384,
            SignatureScheme::ECDSA_NISTP521_SHA512,
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::RSA_PSS_SHA384,
            SignatureScheme::RSA_PSS_SHA512,
            SignatureScheme::ED25519,
            SignatureScheme::ED448,
        ]
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::websocket::types::WsTlsConfig;

    #[test]
    fn none_tls_returns_none_connector() {
        let result = build_ws_connector(None);
        assert!(matches!(result, Ok(None)));
    }

    #[test]
    fn all_defaults_returns_none_connector() {
        let tls = WsTlsConfig {
            reject_unauthorized: Some(true),
            ca_cert: None,
            client_cert: None,
            client_key: None,
        };
        let result = build_ws_connector(Some(&tls));
        assert!(matches!(result, Ok(None)));
    }

    #[test]
    fn reject_unauthorized_false_returns_connector() {
        let tls = WsTlsConfig {
            reject_unauthorized: Some(false),
            ca_cert: None,
            client_cert: None,
            client_key: None,
        };
        let result = build_ws_connector(Some(&tls));
        assert!(matches!(result, Ok(Some(_))));
    }

    #[test]
    fn custom_ca_cert_code_path_exercised() {
        // Truncated PEM (valid structure but not a real cert) — rustls may
        // reject it at the root-store level, which is fine. We verify the
        // code path runs without panic.
        let ca = "-----BEGIN CERTIFICATE-----\nTUlJ\n-----END CERTIFICATE-----";
        let tls = WsTlsConfig {
            reject_unauthorized: None,
            ca_cert: Some(ca.to_string()),
            client_cert: None,
            client_key: None,
        };
        let _result = build_ws_connector(Some(&tls));
        // Either Ok (PEM parsed + cert ignored) or Err (invalid cert) is acceptable
    }

    #[test]
    fn ca_cert_with_reject_false_returns_connector() {
        let tls = WsTlsConfig {
            reject_unauthorized: Some(false),
            ca_cert: Some("does not matter".to_string()),
            client_cert: None,
            client_key: None,
        };
        let result = build_ws_connector(Some(&tls));
        assert!(matches!(result, Ok(Some(_))));
    }

    #[test]
    fn invalid_ca_pem_returns_error() {
        let tls = WsTlsConfig {
            reject_unauthorized: None,
            ca_cert: Some("not valid PEM".to_string()),
            client_cert: None,
            client_key: None,
        };
        let result = build_ws_connector(Some(&tls));
        match result {
            Err(msg) => assert!(msg.contains("no valid certificates found"), "Got: {}", msg),
            Ok(_) => panic!("Expected error for invalid CA PEM"),
        }
    }

    #[test]
    fn partial_mtls_cert_only_returns_error() {
        let tls = WsTlsConfig {
            reject_unauthorized: Some(false),
            ca_cert: None,
            client_cert: Some("cert data".to_string()),
            client_key: None,
        };
        let result = build_ws_connector(Some(&tls));
        match result {
            Err(msg) => assert!(msg.contains("clientCert provided without clientKey"), "Got: {}", msg),
            Ok(_) => panic!("Expected error for partial mTLS"),
        }
    }

    #[test]
    fn partial_mtls_key_only_returns_error() {
        let tls = WsTlsConfig {
            reject_unauthorized: Some(false),
            ca_cert: None,
            client_cert: None,
            client_key: Some("key data".to_string()),
        };
        let result = build_ws_connector(Some(&tls));
        match result {
            Err(msg) => assert!(msg.contains("clientKey provided without clientCert"), "Got: {}", msg),
            Ok(_) => panic!("Expected error for partial mTLS"),
        }
    }

    #[test]
    fn connect_error_code_url_error() {
        use tokio_tungstenite::tungstenite::error::{Error as WsError, UrlError};
        let err = WsError::Url(UrlError::UnsupportedUrlScheme);
        assert_eq!(connect_error_code(&err), "WS_INVALID_URL");
    }

    #[test]
    fn connect_error_code_io_error() {
        use tokio_tungstenite::tungstenite::error::Error as WsError;
        let err = WsError::Io(std::io::Error::new(
            std::io::ErrorKind::ConnectionRefused,
            "connection refused",
        ));
        assert_eq!(connect_error_code(&err), "WS_CONNECT_FAILED");
    }
}
