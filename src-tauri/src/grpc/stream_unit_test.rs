//! Unit tests for gRPC stream command handlers.

#[cfg(test)]
mod tests {
    use tokio::sync::mpsc;

    use crate::grpc::state::GrpcState;
    use crate::grpc::stream::{
        execute_grpc_stream_cancel, execute_grpc_stream_end, execute_grpc_stream_send,
        execute_grpc_stream_start, StreamEventEmitter, OUTBOUND_CHANNEL_CAPACITY,
    };
    use crate::grpc::stream_registry::{StreamRegistryStatus, TryRegisterStreamOutcome};
    use crate::grpc::test_echo_protoset::echo_descriptor_payload;
    use crate::grpc::types::{
        GrpcTauriAuthConfig, GrpcTauriAuthType, GrpcTauriEvent, GrpcTauriEventType,
        GrpcTauriOAuth2Config, GrpcTauriStreamCancelRequest, GrpcTauriStreamEndRequest,
        GrpcTauriStreamSendRequest, GrpcTauriStreamStartRequest, GrpcTauriStreamingCallType,
        GrpcTauriTarget, GrpcTauriTlsMode, GRPC_TAURI_INVALID_REQUEST, GRPC_TAURI_STREAM_OWNERSHIP,
    };

    fn make_test_emitter() -> (StreamEventEmitter, mpsc::UnboundedReceiver<GrpcTauriEvent>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (StreamEventEmitter::Test(tx), rx)
    }

    fn register_active_client_stream(state: &GrpcState, stream_id: &str, tab_id: &str) {
        let (outbound_tx, _outbound_rx) = mpsc::channel(OUTBOUND_CHANNEL_CAPACITY);
        assert!(matches!(
            state.stream_registry.try_register(
                stream_id,
                &format!("req-{stream_id}"),
                tab_id,
                GrpcTauriStreamingCallType::ClientStreaming,
                "echo.EchoService".to_string(),
                "ClientStream".to_string(),
                echo_descriptor_payload(),
                Some(outbound_tx),
            ),
            TryRegisterStreamOutcome::Registered { .. }
        ));
    }

    #[tokio::test]
    async fn stream_end_unknown_stream_returns_already_terminal() {
        let state = GrpcState::new();

        let envelope = execute_grpc_stream_end(
            &state,
            GrpcTauriStreamEndRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                stream_id: "missing-stream".to_string(),
                tab_id: "tab-a".to_string(),
            },
        )
        .await;

        assert_eq!(envelope["ok"], true);
        assert_eq!(envelope["data"]["alreadyTerminal"], true);
        assert_eq!(envelope["data"]["acknowledged"], false);
    }

    #[tokio::test]
    async fn stream_send_after_half_close_returns_invalid_request() {
        let state = GrpcState::new();
        let (emitter, _rx) = make_test_emitter();
        register_active_client_stream(&state, "s1", "tab-a");

        let end = execute_grpc_stream_end(
            &state,
            GrpcTauriStreamEndRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                stream_id: "s1".to_string(),
                tab_id: "tab-a".to_string(),
            },
        )
        .await;
        assert_eq!(end["ok"], true);
        assert_eq!(end["data"]["acknowledged"], true);

        let send = execute_grpc_stream_send(
            &state,
            GrpcTauriStreamSendRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                stream_id: "s1".to_string(),
                tab_id: "tab-a".to_string(),
                body: serde_json::json!({ "message": "late" }),
            },
            emitter,
        )
        .await;

        assert_eq!(send["ok"], false);
        assert_eq!(send["error"]["code"], GRPC_TAURI_INVALID_REQUEST);
        assert_eq!(
            send["error"]["message"].as_str(),
            Some("send is not valid after client stream EOF")
        );
    }

    #[tokio::test]
    async fn stream_cancel_unknown_stream_returns_already_terminal() {
        let state = GrpcState::new();

        let envelope = execute_grpc_stream_cancel(
            &state,
            GrpcTauriStreamCancelRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                stream_id: "missing-stream".to_string(),
                tab_id: "tab-a".to_string(),
            },
            None,
        )
        .await;

        assert_eq!(envelope["ok"], true);
        assert_eq!(envelope["data"]["alreadyTerminal"], true);
        assert_eq!(envelope["data"]["acknowledged"], false);
    }

    #[tokio::test]
    async fn stream_end_double_half_close_returns_already_terminal() {
        let state = GrpcState::new();
        register_active_client_stream(&state, "s1", "tab-a");

        let first = execute_grpc_stream_end(
            &state,
            GrpcTauriStreamEndRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                stream_id: "s1".to_string(),
                tab_id: "tab-a".to_string(),
            },
        )
        .await;
        assert_eq!(first["ok"], true);
        assert_eq!(first["data"]["acknowledged"], true);

        let second = execute_grpc_stream_end(
            &state,
            GrpcTauriStreamEndRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                stream_id: "s1".to_string(),
                tab_id: "tab-a".to_string(),
            },
        )
        .await;
        assert_eq!(second["ok"], true);
        assert_eq!(second["data"]["alreadyTerminal"], true);
        assert_eq!(second["data"]["acknowledged"], false);
    }

    #[tokio::test]
    async fn stream_end_is_idempotent_on_terminal_stream() {
        let state = GrpcState::new();
        register_active_client_stream(&state, "s1", "tab-a");
        state
            .stream_registry
            .mark_terminal("s1", StreamRegistryStatus::Ended);

        let envelope = execute_grpc_stream_end(
            &state,
            GrpcTauriStreamEndRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                stream_id: "s1".to_string(),
                tab_id: "tab-a".to_string(),
            },
        )
        .await;

        assert_eq!(envelope["ok"], true);
        assert_eq!(envelope["data"]["alreadyTerminal"], true);
        assert_eq!(envelope["data"]["acknowledged"], false);
    }

    #[tokio::test]
    async fn stream_cancel_is_idempotent_on_terminal_stream() {
        let state = GrpcState::new();
        register_active_client_stream(&state, "s1", "tab-a");
        state
            .stream_registry
            .mark_terminal("s1", StreamRegistryStatus::Cancelled);

        let envelope = execute_grpc_stream_cancel(
            &state,
            GrpcTauriStreamCancelRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                stream_id: "s1".to_string(),
                tab_id: "tab-a".to_string(),
            },
            None,
        )
        .await;

        assert_eq!(envelope["ok"], true);
        assert_eq!(envelope["data"]["alreadyTerminal"], true);
        assert_eq!(envelope["data"]["acknowledged"], false);
    }

    #[tokio::test]
    async fn stream_end_wrong_tab_returns_ownership_error() {
        let state = GrpcState::new();
        register_active_client_stream(&state, "s1", "tab-a");

        let envelope = execute_grpc_stream_end(
            &state,
            GrpcTauriStreamEndRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                stream_id: "s1".to_string(),
                tab_id: "tab-b".to_string(),
            },
        )
        .await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_STREAM_OWNERSHIP);
    }

    #[tokio::test]
    async fn stream_start_blank_tab_id_returns_invalid_request() {
        let state = GrpcState::new();
        let (emitter, _rx) = make_test_emitter();

        let envelope = execute_grpc_stream_start(
            &state,
            GrpcTauriStreamStartRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                request_id: "req-1".to_string(),
                tab_id: "   ".to_string(),
                call_type: GrpcTauriStreamingCallType::ServerStreaming,
                target: GrpcTauriTarget {
                    address: "localhost:50051".to_string(),
                    tls_mode: GrpcTauriTlsMode::Disabled,
                    tls_config: None,
                },
                service: "echo.EchoService".to_string(),
                method: "ServerStream".to_string(),
                body: serde_json::json!({ "message": "hi", "repeat_count": 1 }),
                metadata: None,
                auth: None,
                timeout_ms: Some(1_000),
                descriptor: echo_descriptor_payload(),
            },
            emitter,
        )
        .await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_INVALID_REQUEST);
    }

    #[tokio::test]
    async fn stream_start_oauth2_auth_returns_invalid_request() {
        let state = GrpcState::new();
        let (emitter, _rx) = make_test_emitter();

        let envelope = execute_grpc_stream_start(
            &state,
            GrpcTauriStreamStartRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                request_id: "req-oauth2".to_string(),
                tab_id: "tab-a".to_string(),
                call_type: GrpcTauriStreamingCallType::ServerStreaming,
                target: GrpcTauriTarget {
                    address: "localhost:50051".to_string(),
                    tls_mode: GrpcTauriTlsMode::Disabled,
                    tls_config: None,
                },
                service: "echo.EchoService".to_string(),
                method: "ServerStream".to_string(),
                body: serde_json::json!({ "message": "hi", "repeat_count": 1 }),
                metadata: None,
                auth: Some(GrpcTauriAuthConfig {
                    auth_type: GrpcTauriAuthType::Oauth2,
                    bearer_token: None,
                    basic_username: None,
                    basic_password: None,
                    api_key_name: None,
                    api_key_value: None,
                    oauth2: Some(GrpcTauriOAuth2Config {
                        token_url: "https://auth.example.com/token".to_string(),
                        client_id: "client".to_string(),
                        client_secret: "secret".to_string(),
                        scope: None,
                    }),
                }),
                timeout_ms: Some(1_000),
                descriptor: echo_descriptor_payload(),
            },
            emitter,
        )
        .await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_INVALID_REQUEST);
        assert!(
            envelope["error"]["message"]
                .as_str()
                .unwrap_or_default()
                .contains("OAuth2"),
            "expected OAuth2 validation message",
        );
    }

    #[tokio::test]
    async fn cancel_prior_tab_streams_emits_cancelled_end_events() {
        let state = GrpcState::new();
        let (emitter, mut rx) = make_test_emitter();

        register_active_client_stream(&state, "prior-stream", "tab-a");
        state.stream_registry.next_sequence("prior-stream");

        let envelope = execute_grpc_stream_start(
            &state,
            GrpcTauriStreamStartRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                request_id: "req-new".to_string(),
                tab_id: "tab-a".to_string(),
                call_type: GrpcTauriStreamingCallType::ServerStreaming,
                target: GrpcTauriTarget {
                    address: "localhost:59999".to_string(),
                    tls_mode: GrpcTauriTlsMode::Disabled,
                    tls_config: None,
                },
                service: "echo.EchoService".to_string(),
                method: "ServerStream".to_string(),
                body: serde_json::json!({ "message": "hi", "repeat_count": 1 }),
                metadata: None,
                auth: None,
                timeout_ms: Some(500),
                descriptor: echo_descriptor_payload(),
            },
            emitter,
        )
        .await;

        assert_eq!(envelope["ok"], true);

        let event = rx.try_recv().expect("cancelled grpc-end event");
        assert_eq!(event.event_type, GrpcTauriEventType::GrpcEnd);
        assert_eq!(event.stream_id, "prior-stream");
        assert_eq!(event.request_id, "req-prior-stream");
        assert_eq!(event.grpc_status, Some(1));
        assert!(rx.try_recv().is_err(), "expected exactly one cancelled grpc-end event");
    }
}
