//! Phase 7A contract round-trip tests.
//!
//! Verifies that all major input/output types in `types.rs` round-trip through
//! JSON serialisation/deserialisation without data loss.
//!
//! These tests run via `cargo test` (not tonic integration tests); no network
//! or gRPC server required.

#[cfg(test)]
mod tests {
    use crate::grpc::types::*;
    use std::collections::HashMap;

    // ─── Constants ───────────────────────────────────────────────────────────

    #[test]
    fn schema_version_constant_is_one() {
        assert_eq!(GRPC_TAURI_SCHEMA_VERSION, 1);
    }

    #[test]
    fn schema_mismatch_error_code_matches_ts() {
        assert_eq!(GRPC_TAURI_SCHEMA_MISMATCH, "GRPC_TAURI_SCHEMA_MISMATCH");
    }

    // ─── TLS / Auth / Target ─────────────────────────────────────────────────

    #[test]
    fn grpc_tauri_target_round_trip() {
        let json = r#"{
            "address": "localhost:50051",
            "tlsMode": "tls",
            "tlsConfig": {
                "serverCaPem": "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----",
                "clientCertPem": null,
                "clientKeyPem": null,
                "serverNameOverride": "example.com"
            }
        }"#;

        let target: GrpcTauriTarget = serde_json::from_str(json).expect("deserialise GrpcTauriTarget");
        assert_eq!(target.address, "localhost:50051");
        assert_eq!(target.tls_mode, GrpcTauriTlsMode::Tls);
        let tls = target.tls_config.as_ref().expect("tls_config present");
        assert_eq!(tls.server_name_override.as_deref(), Some("example.com"));
        // null JSON values for optional TLS fields must deserialise as None
        assert!(tls.client_cert_pem.is_none(), "null clientCertPem must deserialise as None");
        assert!(tls.client_key_pem.is_none(), "null clientKeyPem must deserialise as None");

        let back = serde_json::to_string(&target).expect("serialise GrpcTauriTarget");
        assert!(back.contains("\"tlsMode\""));
        assert!(back.contains("localhost:50051"));
        // None TLS fields must be absent in serialized output (not null)
        assert!(!back.contains("clientCertPem"), "absent clientCertPem must be omitted, not null");
        assert!(!back.contains("clientKeyPem"), "absent clientKeyPem must be omitted, not null");
        assert!(!back.contains("null"), "no null values in serialized target");
    }

    #[test]
    fn grpc_tauri_auth_config_bearer_round_trip() {
        let json = r#"{
            "type": "bearer",
            "bearerToken": "my-secret-token"
        }"#;
        let auth: GrpcTauriAuthConfig = serde_json::from_str(json).expect("deserialise bearer auth");
        assert_eq!(auth.auth_type, GrpcTauriAuthType::Bearer);
        assert_eq!(auth.bearer_token.as_deref(), Some("my-secret-token"));

        let back = serde_json::to_string(&auth).expect("serialise bearer auth");
        // Verify rename = "type" is in effect and value is correct (not "authType":"bearer")
        assert!(back.contains("\"type\":\"bearer\""),
            "auth type must serialise as \"type\":\"bearer\", got: {back}");
        assert!(back.contains("my-secret-token"));
        // Verify skip_serializing_if: absent optional fields must NOT appear as null
        assert!(!back.contains("basicUsername"), "absent optional fields must be omitted");
        assert!(!back.contains("null"), "no null values in output");
    }

    #[test]
    fn grpc_tauri_auth_config_api_key_round_trip() {
        // Tests the "api_key" serde conversion: Rust ApiKey → JSON "api_key" (snake_case).
        let json = r#"{
            "type": "api_key",
            "apiKeyName": "X-Api-Key",
            "apiKeyValue": "secret-key"
        }"#;
        let auth: GrpcTauriAuthConfig = serde_json::from_str(json).expect("deserialise api_key auth");
        assert_eq!(auth.auth_type, GrpcTauriAuthType::ApiKey);
        assert_eq!(auth.api_key_name.as_deref(), Some("X-Api-Key"));
        assert_eq!(auth.api_key_value.as_deref(), Some("secret-key"));

        let back = serde_json::to_string(&auth).expect("serialise api_key auth");
        // Verify ApiKey → "api_key" under snake_case (most surprising serde conversion)
        assert!(back.contains("\"type\":\"api_key\""),
            "auth type must serialise as api_key, got: {back}");
        assert!(back.contains("\"apiKeyName\""));
        assert!(back.contains("X-Api-Key"));
    }

    #[test]
    fn grpc_tauri_auth_config_none_round_trip() {
        let json = r#"{ "type": "none" }"#;
        let auth: GrpcTauriAuthConfig = serde_json::from_str(json).expect("deserialise none auth");
        assert_eq!(auth.auth_type, GrpcTauriAuthType::None);
        assert!(auth.bearer_token.is_none());
    }

    #[test]
    fn grpc_tauri_auth_config_basic_round_trip() {
        let json = r#"{
            "type": "basic",
            "basicUsername": "user",
            "basicPassword": "pass"
        }"#;
        let auth: GrpcTauriAuthConfig = serde_json::from_str(json).expect("deserialise basic auth");
        assert_eq!(auth.auth_type, GrpcTauriAuthType::Basic);
        assert_eq!(auth.basic_username.as_deref(), Some("user"));
        assert_eq!(auth.basic_password.as_deref(), Some("pass"));

        let back = serde_json::to_string(&auth).expect("serialise basic auth");
        assert!(back.contains("\"type\":\"basic\""));
        assert!(back.contains("user"));
    }

    #[test]
    fn grpc_tauri_auth_config_oauth2_round_trip() {
        let json = r#"{
            "type": "oauth2",
            "oauth2": {
                "tokenUrl": "https://auth.example.com/token",
                "clientId": "my-client",
                "clientSecret": "my-secret",
                "scope": "openid"
            }
        }"#;
        let auth: GrpcTauriAuthConfig = serde_json::from_str(json).expect("deserialise oauth2 auth");
        assert_eq!(auth.auth_type, GrpcTauriAuthType::Oauth2);
        let oauth2 = auth.oauth2.as_ref().expect("oauth2 config present");
        assert_eq!(oauth2.token_url, "https://auth.example.com/token");
        assert_eq!(oauth2.scope.as_deref(), Some("openid"));

        let back = serde_json::to_string(&auth).expect("serialise oauth2 auth");
        assert!(back.contains("\"type\":\"oauth2\""));
        assert!(back.contains("\"tokenUrl\""));
    }

    // ─── Descriptor payload ──────────────────────────────────────────────────

    #[test]
    fn descriptor_payload_round_trip() {
        let json = r#"{
            "descriptorKey": "greeter-v1",
            "protosetBase64": "AAECBA==",
            "contentSha256": "abc123def456"
        }"#;
        let desc: GrpcTauriDescriptorPayload =
            serde_json::from_str(json).expect("deserialise descriptor");
        assert_eq!(desc.descriptor_key, "greeter-v1");
        assert_eq!(desc.protoset_base64, "AAECBA==");
        assert_eq!(desc.content_sha256, "abc123def456");

        let back = serde_json::to_string(&desc).expect("serialise descriptor");
        assert!(back.contains("\"descriptorKey\""));
        assert!(back.contains("greeter-v1"));
    }

    // ─── Command inputs ───────────────────────────────────────────────────────

    #[test]
    fn unary_request_round_trip() {
        let json = r#"{
            "schemaVersion": 1,
            "requestId": "req-001",
            "tabId": "tab-001",
            "target": { "address": "localhost:50051", "tlsMode": "disabled" },
            "service": "helloworld.Greeter",
            "method": "SayHello",
            "body": { "name": "World" },
            "metadata": { "x-request-id": "abc" },
            "timeoutMs": 5000,
            "descriptor": {
                "descriptorKey": "greeter-v1",
                "protosetBase64": "AAECBA==",
                "contentSha256": "abc123"
            }
        }"#;

        let req: GrpcTauriUnaryRequest =
            serde_json::from_str(json).expect("deserialise GrpcTauriUnaryRequest");
        assert_eq!(req.schema_version, 1);
        assert_eq!(req.request_id, "req-001");
        assert_eq!(req.tab_id, "tab-001");
        assert_eq!(req.service, "helloworld.Greeter");
        assert_eq!(req.method, "SayHello");
        assert_eq!(req.timeout_ms, Some(5000));
        let meta = req.metadata.as_ref().expect("metadata present");
        assert_eq!(meta.get("x-request-id").map(|s| s.as_str()), Some("abc"));
        // Verify body field is populated
        let body_obj = req.body.as_object().expect("body is a JSON object");
        assert_eq!(body_obj.get("name").and_then(|v| v.as_str()), Some("World"));
    }

    #[test]
    fn call_cancel_request_round_trip() {
        let json = r#"{
            "schemaVersion": 1,
            "requestId": "req-002",
            "tabId": "tab-001"
        }"#;
        let req: GrpcTauriCallCancelRequest =
            serde_json::from_str(json).expect("deserialise GrpcTauriCallCancelRequest");
        assert_eq!(req.request_id, "req-002");
        assert_eq!(req.tab_id, "tab-001");
    }

    #[test]
    fn stream_start_request_round_trip() {
        let json = r#"{
            "schemaVersion": 1,
            "requestId": "req-003",
            "tabId": "tab-002",
            "callType": "server_streaming",
            "target": { "address": "localhost:50051", "tlsMode": "disabled" },
            "service": "helloworld.Greeter",
            "method": "SayHelloServerStream",
            "body": { "name": "Stream" },
            "descriptor": {
                "descriptorKey": "greeter-v1",
                "protosetBase64": "AAECBA==",
                "contentSha256": "abc123"
            }
        }"#;
        let req: GrpcTauriStreamStartRequest =
            serde_json::from_str(json).expect("deserialise GrpcTauriStreamStartRequest");
        assert_eq!(req.call_type, GrpcTauriStreamingCallType::ServerStreaming);
        assert_eq!(req.request_id, "req-003");
    }

    #[test]
    fn stream_send_request_round_trip() {
        let json = r#"{
            "schemaVersion": 1,
            "streamId": "stream-abc",
            "tabId": "tab-002",
            "body": { "message": "hello" }
        }"#;
        let req: GrpcTauriStreamSendRequest =
            serde_json::from_str(json).expect("deserialise GrpcTauriStreamSendRequest");
        assert_eq!(req.stream_id, "stream-abc");
    }

    #[test]
    fn stream_end_request_round_trip() {
        let json = r#"{
            "schemaVersion": 1,
            "streamId": "stream-abc",
            "tabId": "tab-002"
        }"#;
        let req: GrpcTauriStreamEndRequest =
            serde_json::from_str(json).expect("deserialise GrpcTauriStreamEndRequest");
        assert_eq!(req.stream_id, "stream-abc");
    }

    #[test]
    fn stream_cancel_request_round_trip() {
        let json = r#"{
            "schemaVersion": 1,
            "streamId": "stream-xyz",
            "tabId": "tab-003"
        }"#;
        let req: GrpcTauriStreamCancelRequest =
            serde_json::from_str(json).expect("deserialise GrpcTauriStreamCancelRequest");
        assert_eq!(req.stream_id, "stream-xyz");
        assert_eq!(req.tab_id, "tab-003");
    }

    #[test]
    fn tab_cleanup_request_round_trip() {
        let json = r#"{ "schemaVersion": 1, "tabId": "tab-closing" }"#;
        let req: GrpcTauriTabCleanupRequest =
            serde_json::from_str(json).expect("deserialise GrpcTauriTabCleanupRequest");
        assert_eq!(req.tab_id, "tab-closing");
    }

    // ─── Result / envelope types ──────────────────────────────────────────────

    #[test]
    fn unary_result_serialises_correctly() {
        let result = GrpcTauriUnaryResult {
            call_type: "unary".to_string(),
            status: 0,
            status_message: "OK".to_string(),
            headers: HashMap::from([("content-type".to_string(), "application/grpc".to_string())]),
            trailers: HashMap::new(),
            body: Some(serde_json::json!({ "message": "Hello World" })),
            duration_ms: 42,
            error_detail: None,
            transport_used: "tauri".to_string(),
            request_id: "req-001".to_string(),
        };

        let json = serde_json::to_string(&result).expect("serialise GrpcTauriUnaryResult");
        assert!(json.contains("\"callType\""));
        assert!(json.contains("\"transportUsed\""));
        assert!(json.contains("\"requestId\""));
        assert!(json.contains("tauri"));
        assert!(json.contains("Hello World"));
        // error_detail is None — must be omitted, not serialised as null
        assert!(!json.contains("errorDetail"), "absent errorDetail must be omitted, not null");
    }

    #[test]
    fn stream_start_result_serialises_correctly() {
        let result = GrpcTauriStreamStartResult {
            stream_id: "stream-001".to_string(),
            request_id: "req-003".to_string(),
            tab_id: "tab-002".to_string(),
            transport_used: "tauri".to_string(),
        };

        let json = serde_json::to_string(&result).expect("serialise GrpcTauriStreamStartResult");
        assert!(json.contains("\"streamId\""));
        assert!(json.contains("stream-001"));
        assert!(json.contains("tauri"));
    }

    #[test]
    fn grpc_tauri_event_round_trip() {
        let event = GrpcTauriEvent {
            schema_version: GRPC_TAURI_SCHEMA_VERSION,
            event_type: GrpcTauriEventType::GrpcMessage,
            stream_id: "stream-001".to_string(),
            request_id: "req-003".to_string(),
            tab_id: "tab-002".to_string(),
            sequence: 1,
            timestamp: "2026-07-01T00:00:00.000Z".to_string(),
            data: Some(serde_json::json!({ "message": "Hello" })),
            direction: Some("inbound".to_string()),
            grpc_status: None,
            grpc_status_message: None,
            headers: None,
            trailers: None,
            error_detail: None,
            transport_used: Some("tauri".to_string()),
        };

        let json = serde_json::to_string(&event).expect("serialise GrpcTauriEvent");
        assert!(json.contains("\"schemaVersion\""));
        assert!(json.contains("\"type\""));
        assert!(json.contains("grpc-message"));
        assert!(json.contains("\"sequence\""));
        assert!(json.contains("\"streamId\""));
        assert!(json.contains("\"direction\":\"inbound\""));

        // None fields must be omitted entirely (not serialised as null)
        // to match TS optional field semantics.
        assert!(!json.contains("grpcStatus"), "absent grpcStatus must be omitted, not null");
        assert!(!json.contains("grpcStatusMessage"), "absent grpcStatusMessage must be omitted");
        assert!(!json.contains("\"headers\""), "absent headers must be omitted");
        assert!(!json.contains("\"trailers\""), "absent trailers must be omitted");
        assert!(!json.contains("errorDetail"), "absent errorDetail must be omitted");
        assert!(!json.contains("null"), "no null values in event output");

        // Verify deserialisable by renderer (all camelCase keys present)
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("parse event json");
        assert_eq!(parsed["schemaVersion"], 1);
        assert_eq!(parsed["type"], "grpc-message");
        assert_eq!(parsed["sequence"], 1);

        // Verify round-trip back to typed struct
        let event_back: GrpcTauriEvent =
            serde_json::from_str(&json).expect("re-deserialise GrpcTauriEvent");
        assert_eq!(event_back.event_type, GrpcTauriEventType::GrpcMessage);
        assert_eq!(event_back.sequence, 1);
        assert!(event_back.grpc_status.is_none());
    }

    #[test]
    fn grpc_tauri_event_grpc_end_round_trip() {
        let event = GrpcTauriEvent {
            schema_version: GRPC_TAURI_SCHEMA_VERSION,
            event_type: GrpcTauriEventType::GrpcEnd,
            stream_id: "stream-001".to_string(),
            request_id: "req-003".to_string(),
            tab_id: "tab-002".to_string(),
            sequence: 4,
            timestamp: "2026-07-01T00:00:01.000Z".to_string(),
            data: None,
            direction: None,
            grpc_status: Some(0),
            grpc_status_message: Some("OK".to_string()),
            headers: Some(HashMap::from([(
                "content-type".to_string(),
                "application/grpc".to_string(),
            )])),
            trailers: Some(HashMap::from([("x-trace".to_string(), "abc".to_string())])),
            error_detail: None,
            transport_used: Some("tauri".to_string()),
        };

        let json = serde_json::to_string(&event).expect("serialise grpc-end event");
        assert!(json.contains("\"type\":\"grpc-end\""));
        assert!(json.contains("\"grpcStatus\":0"));
        assert!(json.contains("\"grpcStatusMessage\":\"OK\""));
        assert!(json.contains("\"trailers\""));
        assert!(!json.contains("errorDetail"));

        let parsed: serde_json::Value = serde_json::from_str(&json).expect("parse grpc-end json");
        assert_eq!(parsed["type"], "grpc-end");
        assert_eq!(parsed["grpcStatus"], 0);

        let event_back: GrpcTauriEvent =
            serde_json::from_str(&json).expect("re-deserialise grpc-end event");
        assert_eq!(event_back.event_type, GrpcTauriEventType::GrpcEnd);
        assert_eq!(event_back.grpc_status, Some(0));
        assert_eq!(event_back.grpc_status_message.as_deref(), Some("OK"));
    }

    #[test]
    fn grpc_tauri_event_grpc_error_round_trip() {
        let event = GrpcTauriEvent {
            schema_version: GRPC_TAURI_SCHEMA_VERSION,
            event_type: GrpcTauriEventType::GrpcError,
            stream_id: "stream-001".to_string(),
            request_id: "req-003".to_string(),
            tab_id: "tab-002".to_string(),
            sequence: 5,
            timestamp: "2026-07-01T00:00:02.000Z".to_string(),
            data: None,
            direction: None,
            grpc_status: Some(13),
            grpc_status_message: Some("INTERNAL".to_string()),
            headers: None,
            trailers: Some(HashMap::from([("grpc-status-details-bin".to_string(), "abc".to_string())])),
            error_detail: Some("tonic transport failure".to_string()),
            transport_used: Some("tauri".to_string()),
        };

        let json = serde_json::to_string(&event).expect("serialise grpc-error event");
        assert!(json.contains("\"type\":\"grpc-error\""));
        assert!(json.contains("\"grpcStatus\":13"));
        assert!(json.contains("\"errorDetail\":\"tonic transport failure\""));
        assert!(!json.contains("\"data\""));

        let event_back: GrpcTauriEvent =
            serde_json::from_str(&json).expect("re-deserialise grpc-error event");
        assert_eq!(event_back.event_type, GrpcTauriEventType::GrpcError);
        assert_eq!(event_back.grpc_status, Some(13));
        assert_eq!(event_back.error_detail.as_deref(), Some("tonic transport failure"));
    }

    #[test]
    fn unary_request_omits_optional_fields() {
        let json = r#"{
            "schemaVersion": 1,
            "requestId": "req-min",
            "tabId": "tab-min",
            "target": { "address": "localhost:50051", "tlsMode": "disabled" },
            "service": "helloworld.Greeter",
            "method": "SayHello",
            "body": { "name": "Min" },
            "descriptor": {
                "descriptorKey": "greeter-v1",
                "protosetBase64": "AAECBA==",
                "contentSha256": "abc123"
            }
        }"#;

        let req: GrpcTauriUnaryRequest =
            serde_json::from_str(json).expect("deserialise minimal unary request");
        assert_eq!(req.request_id, "req-min");
        assert!(req.metadata.is_none());
        assert!(req.auth.is_none());
        assert!(req.timeout_ms.is_none());
    }

    #[test]
    fn grpc_tauri_success_envelope_serialises_correctly() {
        // Verifies: ok serialises as true, camelCase keys, data is forwarded.
        let envelope = GrpcTauriSuccessEnvelope {
            ok: true,
            op: "grpc_unary".to_string(),
            data: GrpcTauriStreamStartResult {
                stream_id: "stream-001".to_string(),
                request_id: "req-003".to_string(),
                tab_id: "tab-002".to_string(),
                transport_used: "tauri".to_string(),
            },
            meta: GrpcTauriEnvelopeMeta {
                timestamp: "2026-07-01T00:00:00.000Z".to_string(),
                duration_ms: Some(5),
                schema_version: GRPC_TAURI_SCHEMA_VERSION,
            },
        };

        let json = serde_json::to_string(&envelope).expect("serialise success envelope");
        // ok discriminant must be true
        assert!(json.contains("\"ok\":true"), "success envelope must have ok:true, got: {json}");
        assert!(json.contains("\"op\":\"grpc_unary\""));
        assert!(json.contains("\"streamId\""));
        assert!(json.contains("stream-001"));
        // duration_ms is Some — must be present
        assert!(json.contains("\"durationMs\":5"));
    }

    #[test]
    fn grpc_tauri_envelope_meta_omits_absent_duration() {
        // When durationMs is None it must be omitted from JSON, not serialised as null.
        let meta = GrpcTauriEnvelopeMeta {
            timestamp: "2026-07-01T00:00:00.000Z".to_string(),
            duration_ms: None,
            schema_version: GRPC_TAURI_SCHEMA_VERSION,
        };
        let json = serde_json::to_string(&meta).expect("serialise meta");
        assert!(!json.contains("durationMs"), "absent durationMs must be omitted, not null");
        assert!(!json.contains("null"));
    }

    #[test]
    fn grpc_tauri_error_envelope_serialises_correctly() {
        let envelope = GrpcTauriErrorEnvelope {
            ok: false,
            op: "grpc_unary".to_string(),
            error: GrpcTauriErrorBody {
                code: GRPC_TAURI_SCHEMA_MISMATCH.to_string(),
                message: "Schema version mismatch: expected 1, got 2".to_string(),
                retryable: Some(false),
                grpc_status: None,
                trailers: None,
            },
            meta: GrpcTauriEnvelopeMeta {
                timestamp: "2026-07-01T00:00:00.000Z".to_string(),
                duration_ms: Some(0),
                schema_version: GRPC_TAURI_SCHEMA_VERSION,
            },
        };

        let json = serde_json::to_string(&envelope).expect("serialise error envelope");
        assert!(json.contains("\"ok\":false"));
        assert!(json.contains("GRPC_TAURI_SCHEMA_MISMATCH"));
        assert!(json.contains("\"retryable\":false"));
        // None fields must not appear as null
        assert!(!json.contains("grpcStatus"), "absent grpcStatus must be omitted");
        assert!(!json.contains("\"trailers\""), "absent trailers must be omitted");
    }

    #[test]
    fn cancel_result_serialises_correctly() {
        let result = GrpcTauriCancelResult {
            request_id: "req-001".to_string(),
            cancelled: true,
            already_completed: Some(false),
        };
        let json = serde_json::to_string(&result).expect("serialise GrpcTauriCancelResult");
        assert!(json.contains("\"requestId\""));
        assert!(json.contains("\"cancelled\":true"));
        assert!(json.contains("\"alreadyCompleted\":false"));
    }

    #[test]
    fn stream_control_result_serialises_correctly() {
        let result = GrpcTauriStreamControlResult {
            stream_id: "stream-001".to_string(),
            tab_id: "tab-002".to_string(),
            op: GrpcTauriStreamControlOp::Cancel,
            acknowledged: true,
            already_terminal: None,
        };
        let json =
            serde_json::to_string(&result).expect("serialise GrpcTauriStreamControlResult");
        assert!(json.contains("\"streamId\""));
        assert!(json.contains("\"acknowledged\":true"));
        assert!(json.contains("\"op\":\"cancel\""),
            "op must serialise as cancel, got: {json}");
        // None alreadyTerminal must be omitted, not null
        assert!(!json.contains("alreadyTerminal"), "absent alreadyTerminal must be omitted");
    }

    #[test]
    fn tab_cleanup_result_serialises_correctly() {
        let result = GrpcTauriTabCleanupResult {
            tab_id: "tab-closing".to_string(),
            cancelled_streams: 3,
            released_channels: 1,
        };
        let json = serde_json::to_string(&result).expect("serialise GrpcTauriTabCleanupResult");
        assert!(json.contains("\"tabId\""));
        assert!(json.contains("\"cancelledStreams\":3"));
        assert!(json.contains("\"releasedChannels\":1"));
    }

    // ─── Streaming call type variants ─────────────────────────────────────────

    #[test]
    fn streaming_call_type_all_variants() {
        let variants = [
            (r#""server_streaming""#, GrpcTauriStreamingCallType::ServerStreaming),
            (r#""client_streaming""#, GrpcTauriStreamingCallType::ClientStreaming),
            (r#""bidi_streaming""#, GrpcTauriStreamingCallType::BidiStreaming),
        ];
        for (json_str, expected) in &variants {
            let parsed: GrpcTauriStreamingCallType =
                serde_json::from_str(json_str).expect("deserialise call type");
            assert_eq!(&parsed, expected);
        }
    }

    // ─── Schema version validation helper ────────────────────────────────────

    #[test]
    fn schema_version_mismatch_detected() {
        assert!(crate::grpc::types::validate_grpc_tauri_schema_version(1).is_ok());
        assert_eq!(
            crate::grpc::types::validate_grpc_tauri_schema_version(2).unwrap_err(),
            "GRPC_TAURI_SCHEMA_MISMATCH"
        );
        assert_eq!(
            crate::grpc::types::validate_grpc_tauri_schema_version(0).unwrap_err(),
            "GRPC_TAURI_SCHEMA_MISMATCH"
        );
    }

    // ─── Error code constants — cross-language protocol verification ─────────

    #[test]
    fn error_codes_all_match_ts_protocol() {
        // Verify every Rust constant matches the TS GRPC_TAURI_ERROR_CODES object value.
        // If any of these fail, TS and Rust are using different error code strings
        // and the protocol is broken before any I/O code is written.
        assert_eq!(GRPC_TAURI_SCHEMA_MISMATCH,      "GRPC_TAURI_SCHEMA_MISMATCH");
        assert_eq!(GRPC_TAURI_DESCRIPTOR_INTEGRITY, "GRPC_TAURI_DESCRIPTOR_INTEGRITY");
        assert_eq!(GRPC_TAURI_CHANNEL_BUILD,        "GRPC_TAURI_CHANNEL_BUILD");
        assert_eq!(GRPC_TAURI_CALL_FAILED,          "GRPC_TAURI_CALL_FAILED");
        assert_eq!(GRPC_TAURI_CANCELLED,            "GRPC_TAURI_CANCELLED");
        assert_eq!(GRPC_TAURI_REQUEST_NOT_FOUND,    "GRPC_TAURI_REQUEST_NOT_FOUND");
        assert_eq!(GRPC_TAURI_INVALID_REQUEST,      "GRPC_TAURI_INVALID_REQUEST");
        assert_eq!(GRPC_TAURI_STREAM_NOT_FOUND,     "GRPC_TAURI_STREAM_NOT_FOUND");
        assert_eq!(GRPC_TAURI_STREAM_OWNERSHIP,     "GRPC_TAURI_STREAM_OWNERSHIP");
        assert_eq!(GRPC_TAURI_TAB_CLEANUP,          "GRPC_TAURI_TAB_CLEANUP");
        assert_eq!(GRPC_TAURI_INTERNAL,             "GRPC_TAURI_INTERNAL");
        // All codes must carry the GRPC_TAURI_ prefix (mirrors TS prefix test)
        for code in [
            GRPC_TAURI_SCHEMA_MISMATCH, GRPC_TAURI_DESCRIPTOR_INTEGRITY,
            GRPC_TAURI_CHANNEL_BUILD, GRPC_TAURI_CALL_FAILED, GRPC_TAURI_CANCELLED,
            GRPC_TAURI_REQUEST_NOT_FOUND, GRPC_TAURI_INVALID_REQUEST,
            GRPC_TAURI_STREAM_NOT_FOUND, GRPC_TAURI_STREAM_OWNERSHIP,
            GRPC_TAURI_TAB_CLEANUP, GRPC_TAURI_INTERNAL,
        ] {
            assert!(
                code.starts_with("GRPC_TAURI_"),
                "error code must start with GRPC_TAURI_, got: {code}"
            );
        }
    }

    // ─── TLS mode all-variants serde ─────────────────────────────────────────

    #[test]
    fn grpc_tauri_tls_mode_all_variants() {
        // Verify all three TLS mode strings round-trip — covers disabled and mtls
        // which are not exercised by grpc_tauri_target_round_trip.
        let variants = [
            (r#""disabled""#, GrpcTauriTlsMode::Disabled),
            (r#""tls""#,      GrpcTauriTlsMode::Tls),
            (r#""mtls""#,     GrpcTauriTlsMode::Mtls),
        ];
        for (json_str, expected) in &variants {
            let parsed: GrpcTauriTlsMode =
                serde_json::from_str(json_str).expect("deserialise TLS mode");
            assert_eq!(&parsed, expected);
            let back = serde_json::to_string(&parsed).expect("serialise TLS mode");
            assert_eq!(back, *json_str);
        }
    }

    // ─── Event type all-variants serde ───────────────────────────────────────

    #[test]
    fn grpc_tauri_event_type_all_variants() {
        // Hyphenated values are the most error-prone serde encoding in the protocol.
        // All four must round-trip exactly.
        let variants = [
            (r#""grpc-message""#,   GrpcTauriEventType::GrpcMessage),
            (r#""grpc-end""#,       GrpcTauriEventType::GrpcEnd),
            (r#""grpc-error""#,     GrpcTauriEventType::GrpcError),
            (r#""grpc-heartbeat""#, GrpcTauriEventType::GrpcHeartbeat),
        ];
        for (json_str, expected) in &variants {
            let parsed: GrpcTauriEventType =
                serde_json::from_str(json_str).expect("deserialise event type");
            assert_eq!(&parsed, expected);
            let back = serde_json::to_string(&parsed).expect("serialise event type");
            assert_eq!(back, *json_str);
        }
    }

    // ─── Stream control op all-variants serde ────────────────────────────────

    #[test]
    fn grpc_tauri_stream_control_op_all_variants() {
        let variants = [
            (r#""end""#,    GrpcTauriStreamControlOp::End),
            (r#""cancel""#, GrpcTauriStreamControlOp::Cancel),
        ];
        for (json_str, expected) in &variants {
            let parsed: GrpcTauriStreamControlOp =
                serde_json::from_str(json_str).expect("deserialise stream control op");
            assert_eq!(&parsed, expected);
            let back = serde_json::to_string(&parsed).expect("serialise stream control op");
            assert_eq!(back, *json_str);
        }
    }

    // ─── OAuth2 config round-trip ─────────────────────────────────────────────

    #[test]
    fn grpc_tauri_oauth2_config_round_trip() {
        // Minimal config — scope absent.
        let json = r#"{
            "tokenUrl": "https://auth.example.com/token",
            "clientId": "my-client",
            "clientSecret": "my-secret"
        }"#;
        let cfg: GrpcTauriOAuth2Config =
            serde_json::from_str(json).expect("deserialise OAuth2 config");
        assert_eq!(cfg.token_url, "https://auth.example.com/token");
        assert_eq!(cfg.client_id, "my-client");
        assert!(cfg.scope.is_none());

        let back = serde_json::to_string(&cfg).expect("serialise OAuth2 config");
        assert!(back.contains("\"tokenUrl\""));
        assert!(back.contains("\"clientId\""));
        // scope is None — must be absent, not null
        assert!(!back.contains("scope"), "absent scope must be omitted, not null");
        assert!(!back.contains("null"), "no null values in OAuth2 output");

        // Verify scope is present when Some.
        let with_scope = GrpcTauriOAuth2Config {
            token_url: "https://auth.example.com/token".to_string(),
            client_id: "my-client".to_string(),
            client_secret: "my-secret".to_string(),
            scope: Some("openid profile".to_string()),
        };
        let back2 = serde_json::to_string(&with_scope).expect("serialise OAuth2 with scope");
        assert!(back2.contains("\"scope\":\"openid profile\""));
    }

    // ─── Cancel result — None omission ───────────────────────────────────────

    #[test]
    fn cancel_result_omits_already_completed_when_none() {
        let result = GrpcTauriCancelResult {
            request_id: "req-001".to_string(),
            cancelled: false,
            already_completed: None,
        };
        let json = serde_json::to_string(&result).expect("serialise cancel result with None");
        assert!(json.contains("\"cancelled\":false"));
        // alreadyCompleted is None — must be absent, not null
        assert!(!json.contains("alreadyCompleted"),
            "absent alreadyCompleted must be omitted, not null");
        assert!(!json.contains("null"), "no null values in cancel result output");
    }
}

