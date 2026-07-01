//! Phase 7H lifecycle tests — tab cleanup and orphan supervisor.

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use crate::grpc::call_registry::TryRegisterOutcome;
    use crate::grpc::lifecycle::{
        cleanup_tab_resources, execute_grpc_tab_cleanup, shutdown_all, sweep_orphans,
        DEFAULT_ORPHAN_STREAM_TIMEOUT_MS, TERMINAL_STREAM_GRACE_MS,
    };
    use crate::grpc::state::GrpcState;
    use crate::grpc::stream_registry::{StreamRegistryStatus, TryRegisterStreamOutcome};
    use crate::grpc::test_echo_protoset::echo_descriptor_payload;
    use crate::grpc::types::{GrpcTauriStreamingCallType, GrpcTauriTabCleanupRequest, GRPC_TAURI_SCHEMA_VERSION};

    fn make_state() -> GrpcState {
        GrpcState::new()
    }

    fn register_active_stream(state: &GrpcState, stream_id: &str, tab_id: &str, request_id: &str) {
        assert!(matches!(
            state.stream_registry.try_register(
                stream_id,
                request_id,
                tab_id,
                GrpcTauriStreamingCallType::ServerStreaming,
                "echo.EchoService".to_string(),
                "ServerStreamEcho".to_string(),
                echo_descriptor_payload(),
                None,
            ),
            TryRegisterStreamOutcome::Registered { .. }
        ));
    }

    #[test]
    fn tab_cleanup_cancels_active_unary_and_streams() {
        let state = make_state();
        assert!(matches!(
            state.call_registry.try_register("req-1", "tab-a"),
            TryRegisterOutcome::Registered { .. }
        ));
        register_active_stream(&state, "stream-1", "tab-a", "req-stream");

        let result = cleanup_tab_resources(&state, "tab-a");
        assert_eq!(result.tab_id, "tab-a");
        assert_eq!(result.cancelled_streams, 1);
        assert_eq!(result.released_channels, 0);
        assert_eq!(state.call_registry.active_count(), 0);
        assert_eq!(state.stream_registry.total_count(), 0);
    }

    #[test]
    fn tab_cleanup_is_idempotent() {
        let state = make_state();
        register_active_stream(&state, "stream-1", "tab-a", "req-stream");

        let first = cleanup_tab_resources(&state, "tab-a");
        assert_eq!(first.cancelled_streams, 1);

        let second = cleanup_tab_resources(&state, "tab-a");
        assert_eq!(second.cancelled_streams, 0);
        assert_eq!(state.stream_registry.active_count(), 0);
    }

    #[test]
    fn tab_cleanup_wrong_tab_is_noop() {
        let state = make_state();
        register_active_stream(&state, "stream-1", "tab-a", "req-stream");

        let result = cleanup_tab_resources(&state, "tab-b");
        assert_eq!(result.cancelled_streams, 0);
        assert_eq!(state.stream_registry.active_count(), 1);
    }

    #[test]
    fn execute_tab_cleanup_rejects_empty_tab_id() {
        let state = make_state();
        let envelope = execute_grpc_tab_cleanup(
            &state,
            GrpcTauriTabCleanupRequest {
                schema_version: GRPC_TAURI_SCHEMA_VERSION,
                tab_id: "   ".to_string(),
            },
        );
        assert_eq!(envelope.get("ok").and_then(|v| v.as_bool()), Some(false));
    }

    #[test]
    fn detached_tab_within_grace_keeps_active_stream() {
        let state = make_state();
        register_active_stream(&state, "stream-1", "tab-a", "req-stream");
        state.record_tab_event_listener_attached("tab-a");
        state.record_tab_event_listener_detached("tab-a");

        let (cancelled, _) = sweep_orphans(&state);
        assert_eq!(cancelled, 0);
        assert_eq!(state.stream_registry.active_count(), 1);
    }

    #[test]
    fn detached_tab_orphan_supervisor_cancels_after_grace() {
        let state = make_state();
        register_active_stream(&state, "stream-1", "tab-a", "req-stream");
        state.record_tab_event_listener_attached("tab-a");
        state.record_tab_event_listener_detached("tab-a");
        state.set_tab_detached_at_for_test(
            "tab-a",
            Instant::now() - Duration::from_millis(DEFAULT_ORPHAN_STREAM_TIMEOUT_MS + 1_000),
        );

        let (cancelled, _) = sweep_orphans(&state);
        assert_eq!(cancelled, 1);
        assert_eq!(state.stream_registry.active_count(), 0);
    }

    #[test]
    fn terminal_stream_purged_after_grace() {
        let state = make_state();
        register_active_stream(&state, "stream-1", "tab-a", "req-stream");
        state
            .stream_registry
            .mark_terminal("stream-1", StreamRegistryStatus::Ended);
        state.stream_registry.set_terminal_at_for_test(
            "stream-1",
            Instant::now() - Duration::from_millis(TERMINAL_STREAM_GRACE_MS + 1_000),
        );

        let (_, purged) = sweep_orphans(&state);
        assert_eq!(purged, 1);
        assert_eq!(state.stream_registry.total_count(), 0);
    }

    #[test]
    fn shutdown_all_evicts_channels_and_clears_registries() {
        let state = make_state();
        assert!(matches!(
            state.call_registry.try_register("req-1", "tab-a"),
            TryRegisterOutcome::Registered { .. }
        ));
        register_active_stream(&state, "stream-1", "tab-a", "req-stream");

        let released = shutdown_all(&state);
        assert_eq!(released, 0);
        assert_eq!(state.call_registry.active_count(), 0);
        assert_eq!(state.stream_registry.total_count(), 0);
    }

    #[test]
    fn listener_attach_clears_detached_marker() {
        let state = make_state();
        state.record_tab_event_listener_attached("tab-a");
        state.record_tab_event_listener_detached("tab-a");
        state.record_tab_event_listener_attached("tab-a");
        assert!(state.detached_tabs_snapshot().is_empty());
        assert_eq!(state.tab_event_listener_count("tab-a"), 1);
    }

    #[test]
    fn detach_without_attach_starts_grace_marker() {
        let state = make_state();
        state.record_tab_event_listener_detached("tab-a");
        assert_eq!(state.tab_event_listener_count("tab-a"), 0);
        assert_eq!(state.detached_tabs_snapshot().len(), 1);
    }

    #[test]
    fn sweep_clears_detached_marker_after_streams_cancelled() {
        let state = make_state();
        register_active_stream(&state, "stream-1", "tab-a", "req-stream");
        state.set_tab_detached_at_for_test(
            "tab-a",
            Instant::now() - Duration::from_millis(DEFAULT_ORPHAN_STREAM_TIMEOUT_MS + 1_000),
        );

        let (cancelled, _) = sweep_orphans(&state);
        assert_eq!(cancelled, 1);
        assert!(state.detached_tabs_snapshot().is_empty());
    }

    #[test]
    fn shutdown_all_clears_listener_tracking() {
        let state = make_state();
        state.record_tab_event_listener_attached("tab-a");
        state.record_tab_event_listener_detached("tab-a");
        shutdown_all(&state);
        assert!(state.detached_tabs_snapshot().is_empty());
    }

    #[test]
    fn duplicate_detach_does_not_reset_grace_timer() {
        let state = make_state();
        register_active_stream(&state, "stream-1", "tab-a", "req-stream");
        state.record_tab_event_listener_detached("tab-a");
        state.set_tab_detached_at_for_test(
            "tab-a",
            Instant::now() - Duration::from_millis(DEFAULT_ORPHAN_STREAM_TIMEOUT_MS + 1_000),
        );
        state.record_tab_event_listener_detached("tab-a");

        let (cancelled, _) = sweep_orphans(&state);
        assert_eq!(cancelled, 1);
    }

    #[test]
    fn orphan_timeout_matches_express_sse_grace() {
        assert_eq!(DEFAULT_ORPHAN_STREAM_TIMEOUT_MS, 60_000);
    }

    #[test]
    fn sweep_purges_inactive_unary_registry_entries() {
        let state = make_state();
        assert!(matches!(
            state.call_registry.try_register("req-1", "tab-a"),
            TryRegisterOutcome::Registered { .. }
        ));
        state.call_registry.mark_completed("req-1");
        assert!(matches!(
            state.call_registry.try_register("req-2", "tab-a"),
            TryRegisterOutcome::Registered { .. }
        ));
        state.call_registry.cancel("req-2", "tab-a");

        let _ = sweep_orphans(&state);
        assert_eq!(state.call_registry.active_count(), 0);
        assert_eq!(state.call_registry.purge_inactive(), 0);
    }
}
