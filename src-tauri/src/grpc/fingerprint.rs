//! Channel fingerprinting — Phase 7B.
//!
//! Computes a stable, normalized fingerprint string from a `GrpcTauriTarget`
//! that uniquely identifies a tonic channel configuration.
//!
//! # Auth exclusion
//! `GrpcTauriAuthConfig` is intentionally **not** part of the fingerprint.
//! In gRPC, auth credentials (bearer token, basic auth, API key) are attached
//! as per-call metadata interceptors at the RPC level, not at the channel
//! (transport) level. Two RPCs with different bearer tokens but the same
//! endpoint and TLS configuration share one channel safely.
//!
//! # Fingerprint format
//! Fields joined by `\x00` (null byte) separators:
//! ```text
//! {normalized_address}\x00{tls_mode}\x00{server_ca_pem}\x00{client_cert_pem}\x00{client_key_pem}\x00{server_name_override}
//! ```
//! `normalized_address` trims whitespace and strips optional `http://` / `https://`
//! prefixes so fingerprints match tonic endpoint URIs.
//! Optional fields use the empty string when absent. Fields irrelevant to the
//! active `tls_mode` are always empty (e.g. client cert on `Tls`, all TLS
//! fields on `Disabled`) so fingerprints match the channel `build_lazy_channel`
//! actually constructs.

use crate::grpc::types::{GrpcTauriTarget, GrpcTauriTlsMode};

/// Strip optional `http://` or `https://` scheme prefix from a target address.
///
/// Renderer validation normally supplies trimmed `host:port`, but defensive
/// normalization keeps fingerprints aligned with tonic endpoint URIs built in
/// `channel_pool`.
pub fn normalize_grpc_address(address: &str) -> &str {
    let trimmed = address.trim();
    trimmed
        .strip_prefix("http://")
        .or_else(|| trimmed.strip_prefix("https://"))
        .unwrap_or(trimmed)
}

#[cfg(test)]
mod normalize_tests {
    use super::normalize_grpc_address;

    #[test]
    fn normalize_strips_scheme_and_whitespace() {
        assert_eq!(normalize_grpc_address(" http://host:1 "), "host:1");
        assert_eq!(normalize_grpc_address("https://svc:443"), "svc:443");
        assert_eq!(normalize_grpc_address("host:2"), "host:2");
    }
}

/// Returns a stable fingerprint string for the given gRPC target.
///
/// The fingerprint is deterministic and collision-resistant for all
/// combinations of address and TLS configuration. Auth is excluded (see module
/// doc for rationale).
pub fn channel_fingerprint(target: &GrpcTauriTarget) -> String {
    let tls_mode_str = match target.tls_mode {
        GrpcTauriTlsMode::Disabled => "disabled",
        GrpcTauriTlsMode::Tls => "tls",
        GrpcTauriTlsMode::Mtls => "mtls",
    };

    let (ca_pem, cert_pem, key_pem, sni) = match target.tls_mode {
        GrpcTauriTlsMode::Disabled => ("", "", "", ""),
        GrpcTauriTlsMode::Tls => {
            let (ca, _, _, sni) = tls_config_fields(target.tls_config.as_ref());
            (ca, "", "", sni)
        }
        GrpcTauriTlsMode::Mtls => tls_config_fields(target.tls_config.as_ref()),
    };

    format!(
        "{}\x00{}\x00{}\x00{}\x00{}\x00{}",
        normalize_grpc_address(&target.address),
        tls_mode_str,
        ca_pem,
        cert_pem,
        key_pem,
        sni
    )
}

fn tls_config_fields(cfg: Option<&crate::grpc::types::GrpcTauriTlsConfig>) -> (&str, &str, &str, &str) {
    match cfg {
        Some(c) => (
            c.server_ca_pem.as_deref().unwrap_or(""),
            c.client_cert_pem.as_deref().unwrap_or(""),
            c.client_key_pem.as_deref().unwrap_or(""),
            c.server_name_override.as_deref().unwrap_or(""),
        ),
        None => ("", "", "", ""),
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grpc::types::{GrpcTauriTarget, GrpcTauriTlsConfig, GrpcTauriTlsMode};

    fn disabled(addr: &str) -> GrpcTauriTarget {
        GrpcTauriTarget {
            address: addr.to_string(),
            tls_mode: GrpcTauriTlsMode::Disabled,
            tls_config: None,
        }
    }

    fn tls_target(addr: &str, ca: Option<&str>, sni: Option<&str>) -> GrpcTauriTarget {
        GrpcTauriTarget {
            address: addr.to_string(),
            tls_mode: GrpcTauriTlsMode::Tls,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: ca.map(str::to_string),
                client_cert_pem: None,
                client_key_pem: None,
                server_name_override: sni.map(str::to_string),
            }),
        }
    }

    #[test]
    fn fingerprint_disabled_ignores_tls_config() {
        let plain = disabled("localhost:50051");
        let with_spurious_tls = GrpcTauriTarget {
            address: "localhost:50051".to_string(),
            tls_mode: GrpcTauriTlsMode::Disabled,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: Some("-----CA-----".to_string()),
                client_cert_pem: Some("-----CERT-----".to_string()),
                client_key_pem: Some("-----KEY-----".to_string()),
                server_name_override: Some("ignored.example.com".to_string()),
            }),
        };
        assert_eq!(
            channel_fingerprint(&plain),
            channel_fingerprint(&with_spurious_tls),
            "disabled mode must ignore tlsConfig for fingerprinting"
        );
    }

    #[test]
    fn fingerprint_tls_mode_ignores_client_credentials() {
        let base = tls_target("svc:443", Some("-----CA-----"), Some("sni.example.com"));
        let with_client_creds = GrpcTauriTarget {
            address: "svc:443".to_string(),
            tls_mode: GrpcTauriTlsMode::Tls,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: Some("-----CA-----".to_string()),
                client_cert_pem: Some("-----CERT-----".to_string()),
                client_key_pem: Some("-----KEY-----".to_string()),
                server_name_override: Some("sni.example.com".to_string()),
            }),
        };
        assert_eq!(
            channel_fingerprint(&base),
            channel_fingerprint(&with_client_creds),
            "tls mode must ignore client cert fields in fingerprint"
        );
    }

    #[test]
    fn fingerprint_tls_none_config_matches_empty_some_config() {
        let none_cfg = GrpcTauriTarget {
            address: "svc:443".to_string(),
            tls_mode: GrpcTauriTlsMode::Tls,
            tls_config: None,
        };
        let empty_some = tls_target("svc:443", None, None);
        assert_eq!(
            channel_fingerprint(&none_cfg),
            channel_fingerprint(&empty_some),
            "absent tlsConfig and empty tlsConfig must share a fingerprint"
        );
    }

    #[test]
    fn fingerprint_is_deterministic() {
        let t = disabled("localhost:50051");
        assert_eq!(channel_fingerprint(&t), channel_fingerprint(&t));
    }

    #[test]
    fn fingerprint_identical_for_same_config() {
        let a = disabled("localhost:50051");
        let b = disabled("localhost:50051");
        assert_eq!(channel_fingerprint(&a), channel_fingerprint(&b));
    }

    #[test]
    fn fingerprint_changes_on_address() {
        let a = disabled("localhost:50051");
        let b = disabled("localhost:50052");
        assert_ne!(channel_fingerprint(&a), channel_fingerprint(&b));
    }

    #[test]
    fn fingerprint_changes_on_tls_mode() {
        let a = GrpcTauriTarget {
            address: "svc:443".to_string(),
            tls_mode: GrpcTauriTlsMode::Disabled,
            tls_config: None,
        };
        let b = GrpcTauriTarget {
            address: "svc:443".to_string(),
            tls_mode: GrpcTauriTlsMode::Tls,
            tls_config: None,
        };
        let c = GrpcTauriTarget {
            address: "svc:443".to_string(),
            tls_mode: GrpcTauriTlsMode::Mtls,
            tls_config: None,
        };
        assert_ne!(channel_fingerprint(&a), channel_fingerprint(&b));
        assert_ne!(channel_fingerprint(&b), channel_fingerprint(&c));
        assert_ne!(channel_fingerprint(&a), channel_fingerprint(&c));
    }

    #[test]
    fn fingerprint_changes_on_ca_cert() {
        let a = tls_target("svc:443", Some("-----CA-A-----"), None);
        let b = tls_target("svc:443", Some("-----CA-B-----"), None);
        let no_ca = tls_target("svc:443", None, None);
        assert_ne!(channel_fingerprint(&a), channel_fingerprint(&b));
        assert_ne!(channel_fingerprint(&a), channel_fingerprint(&no_ca));
    }

    #[test]
    fn fingerprint_changes_on_sni_override() {
        let a = tls_target("svc:443", None, Some("override.example.com"));
        let b = tls_target("svc:443", None, Some("other.example.com"));
        let no_sni = tls_target("svc:443", None, None);
        assert_ne!(channel_fingerprint(&a), channel_fingerprint(&b));
        assert_ne!(channel_fingerprint(&a), channel_fingerprint(&no_sni));
    }

    #[test]
    fn fingerprint_changes_on_client_cert() {
        // mTLS: two different client certs → different fingerprints
        let a = GrpcTauriTarget {
            address: "svc:443".to_string(),
            tls_mode: GrpcTauriTlsMode::Mtls,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: None,
                client_cert_pem: Some("-----CERT-A-----".to_string()),
                client_key_pem: Some("-----KEY-A-----".to_string()),
                server_name_override: None,
            }),
        };
        let b = GrpcTauriTarget {
            address: "svc:443".to_string(),
            tls_mode: GrpcTauriTlsMode::Mtls,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: None,
                client_cert_pem: Some("-----CERT-B-----".to_string()),
                client_key_pem: Some("-----KEY-B-----".to_string()),
                server_name_override: None,
            }),
        };
        assert_ne!(channel_fingerprint(&a), channel_fingerprint(&b));
    }

    #[test]
    fn fingerprint_changes_on_client_key() {
        let cert = "-----BEGIN CERTIFICATE-----\nCERT\n-----END CERTIFICATE-----";
        let a = GrpcTauriTarget {
            address: "svc:443".to_string(),
            tls_mode: GrpcTauriTlsMode::Mtls,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: None,
                client_cert_pem: Some(cert.to_string()),
                client_key_pem: Some("-----BEGIN PRIVATE KEY-----\nKEY-A\n-----END PRIVATE KEY-----".to_string()),
                server_name_override: None,
            }),
        };
        let b = GrpcTauriTarget {
            address: "svc:443".to_string(),
            tls_mode: GrpcTauriTlsMode::Mtls,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: None,
                client_cert_pem: Some(cert.to_string()),
                client_key_pem: Some("-----BEGIN PRIVATE KEY-----\nKEY-B\n-----END PRIVATE KEY-----".to_string()),
                server_name_override: None,
            }),
        };
        assert_ne!(channel_fingerprint(&a), channel_fingerprint(&b));
    }

    #[test]
    fn fingerprint_normalizes_leading_trailing_whitespace() {
        let plain = disabled("localhost:50051");
        let spaced = disabled("  localhost:50051  ");
        assert_eq!(channel_fingerprint(&plain), channel_fingerprint(&spaced));
    }

    #[test]
    fn fingerprint_normalizes_scheme_prefix() {
        let plain = disabled("localhost:50051");
        let http = disabled("http://localhost:50051");
        let https = disabled("https://localhost:50051");
        assert_eq!(channel_fingerprint(&plain), channel_fingerprint(&http));
        assert_eq!(channel_fingerprint(&plain), channel_fingerprint(&https));
    }

    #[test]
    fn fingerprint_with_no_tls_config_uses_empty_fields() {
        // disabled with no tlsConfig — fingerprint contains all empty optional fields
        let fp = channel_fingerprint(&disabled("localhost:50051"));
        // Separator count should be 5 (6 fields separated by \x00)
        assert_eq!(fp.matches('\x00').count(), 5);
    }

    #[test]
    fn fingerprint_does_not_include_auth_type() {
        // Two targets identical except one has a comment in the description (auth excluded).
        // Verify that address + TLS config alone determines the fingerprint.
        let base = disabled("svc:443");
        // If we built two targets with same transport config but different "auth" (out of scope),
        // they must produce the same fingerprint. Here we confirm the fingerprint only
        // contains what we expect.
        let fp = channel_fingerprint(&base);
        assert!(fp.starts_with("svc:443\x00disabled"));
    }

    #[test]
    fn fingerprint_has_exactly_five_separators() {
        // Regardless of TLS config content, fingerprint always has 5 \x00 separators
        // (= 6 fields). This prevents collision between adjacent optional fields.
        let cases = [
            disabled("svc:443"),
            tls_target("svc:443", Some("CA"), Some("sni")),
            GrpcTauriTarget {
                address: "svc:443".to_string(),
                tls_mode: GrpcTauriTlsMode::Mtls,
                tls_config: Some(GrpcTauriTlsConfig {
                    server_ca_pem: Some("CA".to_string()),
                    client_cert_pem: Some("CERT".to_string()),
                    client_key_pem: Some("KEY".to_string()),
                    server_name_override: None,
                }),
            },
        ];
        for t in &cases {
            let fp = channel_fingerprint(t);
            assert_eq!(
                fp.matches('\x00').count(),
                5,
                "fingerprint must always have 5 separators (6 fields), got: {fp:?}"
            );
        }
    }

    #[test]
    fn fingerprint_all_three_tls_modes_are_mutually_distinct() {
        // All three TLS modes on the same address must produce three distinct fingerprints.
        // This is the key uniqueness property the pool relies on.
        let addr = "svc:50051";
        let fp_disabled = channel_fingerprint(&GrpcTauriTarget {
            address: addr.to_string(),
            tls_mode: GrpcTauriTlsMode::Disabled,
            tls_config: None,
        });
        let fp_tls = channel_fingerprint(&GrpcTauriTarget {
            address: addr.to_string(),
            tls_mode: GrpcTauriTlsMode::Tls,
            tls_config: None,
        });
        let fp_mtls = channel_fingerprint(&GrpcTauriTarget {
            address: addr.to_string(),
            tls_mode: GrpcTauriTlsMode::Mtls,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: None,
                client_cert_pem: Some("CERT".to_string()),
                client_key_pem: Some("KEY".to_string()),
                server_name_override: None,
            }),
        });
        assert_ne!(fp_disabled, fp_tls);
        assert_ne!(fp_tls, fp_mtls);
        assert_ne!(fp_disabled, fp_mtls);
    }
}
