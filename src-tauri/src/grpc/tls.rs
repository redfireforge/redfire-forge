//! TLS connector builder for tonic gRPC channels — Phase 7B.
//!
//! Converts a `GrpcTauriTarget` into a `tonic::transport::ClientTlsConfig`
//! for use in [`ChannelPool`].
//!
//! # Mapping from `GrpcTauriTlsMode`
//! - `Disabled` → `Ok(None)` — plain HTTP/2, no TLS.
//! - `Tls` → `Ok(Some(...))` — TLS with optional custom CA cert and SNI override;
//!   no custom CA means tonic uses the default webpki/system root store.
//! - `Mtls` → `Ok(Some(...))` — TLS + client certificate authentication.
//!   Requires `clientCertPem` + `clientKeyPem` in `tlsConfig`. Returns `Err`
//!   if the client cert pair is absent or incomplete.
//!
//! Mirrors the pattern in `websocket/config.rs` but targets tonic's TLS
//! abstraction rather than tokio-tungstenite's `Connector`.

use tonic::transport::{Certificate, ClientTlsConfig, Identity};

use crate::grpc::types::{GrpcTauriTlsConfig, GrpcTauriTlsMode, GrpcTauriTarget};

/// Build a `ClientTlsConfig` from the transport-level config in a `GrpcTauriTarget`.
///
/// Returns `Ok(None)` for `TlsMode::Disabled` (plain HTTP/2).
/// Returns `Ok(Some(...))` for TLS and mTLS modes.
/// Returns `Err(description)` for invalid mTLS configuration.
pub fn build_client_tls_config(
    target: &GrpcTauriTarget,
) -> Result<Option<ClientTlsConfig>, String> {
    match target.tls_mode {
        GrpcTauriTlsMode::Disabled => Ok(None),
        GrpcTauriTlsMode::Tls => build_tls(target.tls_config.as_ref(), false),
        GrpcTauriTlsMode::Mtls => build_tls(target.tls_config.as_ref(), true),
    }
}

fn build_tls(
    cfg: Option<&GrpcTauriTlsConfig>,
    require_client_cert: bool,
) -> Result<Option<ClientTlsConfig>, String> {
    // Fail fast for mTLS with no config at all
    if require_client_cert && cfg.is_none() {
        return Err("mTLS: tlsMode is mtls but tlsConfig is absent".to_string());
    }

    let mut tls = ClientTlsConfig::new();

    if let Some(c) = cfg {
        // Custom CA certificate
        if let Some(ca_pem) = &c.server_ca_pem {
            tls = tls.ca_certificate(Certificate::from_pem(ca_pem.as_bytes()));
        }

        // SNI override
        if let Some(sni) = &c.server_name_override {
            tls = tls.domain_name(sni);
        }

        // Client certificate (mTLS)
        if require_client_cert {
            match (&c.client_cert_pem, &c.client_key_pem) {
                (Some(cert_pem), Some(key_pem)) => {
                    let identity = Identity::from_pem(cert_pem.as_bytes(), key_pem.as_bytes());
                    tls = tls.identity(identity);
                }
                (Some(_), None) => {
                    return Err(
                        "mTLS: clientCertPem provided without clientKeyPem".to_string()
                    );
                }
                (None, Some(_)) => {
                    return Err(
                        "mTLS: clientKeyPem provided without clientCertPem".to_string()
                    );
                }
                (None, None) => {
                    return Err(
                        "mTLS: tlsMode is mtls but no client certificate provided in tlsConfig"
                            .to_string(),
                    );
                }
            }
        }
    }

    Ok(Some(tls))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grpc::types::{GrpcTauriTarget, GrpcTauriTlsConfig, GrpcTauriTlsMode};

    fn target(mode: GrpcTauriTlsMode, cfg: Option<GrpcTauriTlsConfig>) -> GrpcTauriTarget {
        GrpcTauriTarget {
            address: "svc:443".to_string(),
            tls_mode: mode,
            tls_config: cfg,
        }
    }

    fn full_tls_config(cert: bool, key: bool, ca: bool, sni: bool) -> GrpcTauriTlsConfig {
        GrpcTauriTlsConfig {
            server_ca_pem: if ca {
                Some("-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----".to_string())
            } else {
                None
            },
            client_cert_pem: if cert {
                Some("-----BEGIN CERTIFICATE-----\nCERT\n-----END CERTIFICATE-----".to_string())
            } else {
                None
            },
            client_key_pem: if key {
                Some("-----BEGIN PRIVATE KEY-----\nKEY\n-----END PRIVATE KEY-----".to_string())
            } else {
                None
            },
            server_name_override: if sni {
                Some("override.example.com".to_string())
            } else {
                None
            },
        }
    }

    #[test]
    fn disabled_tls_returns_none() {
        let result = build_client_tls_config(&target(GrpcTauriTlsMode::Disabled, None));
        assert!(result.is_ok());
        assert!(result.unwrap().is_none(), "disabled TLS must return None");
    }

    #[test]
    fn tls_mode_no_config_returns_some() {
        // No custom CA — tonic uses default root store.
        let result = build_client_tls_config(&target(GrpcTauriTlsMode::Tls, None));
        assert!(result.is_ok());
        assert!(result.unwrap().is_some(), "tls mode must return Some(ClientTlsConfig)");
    }

    #[test]
    fn tls_mode_with_ca_cert_returns_some() {
        let cfg = full_tls_config(false, false, true, false);
        let result = build_client_tls_config(&target(GrpcTauriTlsMode::Tls, Some(cfg)));
        assert!(result.is_ok());
        assert!(result.unwrap().is_some());
    }

    #[test]
    fn tls_mode_with_sni_override_returns_some() {
        let cfg = full_tls_config(false, false, false, true);
        let result = build_client_tls_config(&target(GrpcTauriTlsMode::Tls, Some(cfg)));
        assert!(result.is_ok());
        assert!(result.unwrap().is_some());
    }

    #[test]
    fn mtls_no_config_returns_error() {
        let result = build_client_tls_config(&target(GrpcTauriTlsMode::Mtls, None));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("mtls") || msg.contains("mTLS"),
            "error must mention mTLS, got: {msg}"
        );
        assert!(msg.contains("absent"), "error must mention absent tlsConfig, got: {msg}");
    }

    #[test]
    fn mtls_no_client_cert_returns_error() {
        // tlsConfig present but no clientCertPem/clientKeyPem
        let cfg = full_tls_config(false, false, true, false); // CA only, no client cert
        let result = build_client_tls_config(&target(GrpcTauriTlsMode::Mtls, Some(cfg)));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("no client certificate"),
            "error must mention missing client cert, got: {msg}"
        );
    }

    #[test]
    fn mtls_cert_without_key_returns_error() {
        let cfg = full_tls_config(true, false, false, false); // cert but no key
        let result = build_client_tls_config(&target(GrpcTauriTlsMode::Mtls, Some(cfg)));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("clientKeyPem"),
            "error must mention missing clientKeyPem, got: {msg}"
        );
    }

    #[test]
    fn mtls_key_without_cert_returns_error() {
        let cfg = full_tls_config(false, true, false, false); // key but no cert
        let result = build_client_tls_config(&target(GrpcTauriTlsMode::Mtls, Some(cfg)));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("clientCertPem"),
            "error must mention missing clientCertPem, got: {msg}"
        );
    }

    #[test]
    fn mtls_with_full_client_cert_returns_some() {
        use crate::grpc::test_pem::{TEST_CLIENT_CERT_PEM, TEST_CLIENT_KEY_PEM};
        use crate::grpc::types::GrpcTauriTlsConfig;

        let cfg = GrpcTauriTlsConfig {
            server_ca_pem: None,
            client_cert_pem: Some(TEST_CLIENT_CERT_PEM.to_string()),
            client_key_pem: Some(TEST_CLIENT_KEY_PEM.to_string()),
            server_name_override: None,
        };
        let result = build_client_tls_config(&target(GrpcTauriTlsMode::Mtls, Some(cfg)));
        assert!(result.is_ok());
        assert!(result.unwrap().is_some(), "valid mTLS config must return Some");
    }

    #[tokio::test]
    async fn mtls_valid_pem_builds_lazy_channel_via_pool() {
        use crate::grpc::channel_pool::ChannelPool;
        use crate::grpc::test_pem::{TEST_CLIENT_CERT_PEM, TEST_CLIENT_KEY_PEM};
        use crate::grpc::types::GrpcTauriTlsConfig;

        let pool = ChannelPool::new();
        let target = GrpcTauriTarget {
            address: "svc:50051".to_string(),
            tls_mode: GrpcTauriTlsMode::Mtls,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: None,
                client_cert_pem: Some(TEST_CLIENT_CERT_PEM.to_string()),
                client_key_pem: Some(TEST_CLIENT_KEY_PEM.to_string()),
                server_name_override: None,
            }),
        };

        pool.get_or_connect(&target)
            .expect("valid mTLS PEM must apply to lazy endpoint");
        assert_eq!(pool.stats().size, 1);
    }
}
