use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

use tokio::task::{AbortHandle, JoinHandle};
use tokio_util::sync::CancellationToken;

use crate::grpc::mock_server_dispatch::{start_mock_dispatch_server, NativeMockDispatchState};
use crate::grpc::types::GrpcTauriMockListenerStatus;

pub(crate) const MOCK_PORT_MIN: u16 = 50061;
pub(crate) const MOCK_PORT_MAX: u16 = 50160;

#[derive(Debug)]
pub(crate) struct MockRuntime {
    pub(crate) tab_id: String,
    pub(crate) connection_id: String,
    pub(crate) descriptor_key: String,
    pub(crate) started_at: String,
    pub(crate) port: u16,
    pub(crate) listen_target: String,
    pub(crate) stop_token: CancellationToken,
    pub(crate) abort_handle: AbortHandle,
    pub(crate) server_task: JoinHandle<()>,
    pub(crate) dispatch_state: Arc<NativeMockDispatchState>,
}

static MOCK_REGISTRY: OnceLock<Arc<Mutex<HashMap<String, MockRuntime>>>> = OnceLock::new();

pub(crate) fn registry() -> &'static Arc<Mutex<HashMap<String, MockRuntime>>> {
    MOCK_REGISTRY.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

pub(crate) fn create_status_from_runtime(runtime: &MockRuntime) -> GrpcTauriMockListenerStatus {
    let (generation, in_flight_count, last_error) = runtime.dispatch_state.snapshot_status();
    GrpcTauriMockListenerStatus {
        running: true,
        tab_id: runtime.tab_id.clone(),
        listen_target: Some(runtime.listen_target.clone()),
        port: Some(runtime.port),
        generation,
        connection_id: Some(runtime.connection_id.clone()),
        descriptor_key: Some(runtime.descriptor_key.clone()),
        in_flight_count,
        last_error,
        started_at: Some(runtime.started_at.clone()),
    }
}

pub(crate) fn empty_status(tab_id: String) -> GrpcTauriMockListenerStatus {
    GrpcTauriMockListenerStatus {
        running: false,
        tab_id,
        listen_target: None,
        port: None,
        generation: 0,
        connection_id: None,
        descriptor_key: None,
        in_flight_count: 0,
        last_error: None,
        started_at: None,
    }
}

pub(crate) fn next_available_port(
    tab_id: &str,
    requested: Option<u16>,
    recently_replaced_port: Option<u16>,
) -> Result<u16, String> {
    let map = registry().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(port) = requested {
        if !(MOCK_PORT_MIN..=MOCK_PORT_MAX).contains(&port) {
            return Err(format!(
                "port {port} is out of allowed range {MOCK_PORT_MIN}-{MOCK_PORT_MAX}"
            ));
        }
        let used_by_other = map
            .iter()
            .any(|(id, runtime)| id != tab_id && runtime.port == port);
        if used_by_other {
            return Err(format!("port {port} is already allocated to another mock listener"));
        }
        let reusing_recent_same_tab_port = recently_replaced_port == Some(port);
        if !reusing_recent_same_tab_port && !is_port_available(port) {
            return Err(format!("port {port} is not currently available for binding"));
        }
        return Ok(port);
    }

    for candidate in MOCK_PORT_MIN..=MOCK_PORT_MAX {
        let used = map.values().any(|runtime| runtime.port == candidate);
        if !used && is_port_available(candidate) {
            return Ok(candidate);
        }
    }

    Err("no free gRPC mock listener ports available".to_string())
}

pub(crate) fn is_port_available(port: u16) -> bool {
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    match std::net::TcpListener::bind(addr) {
        Ok(listener) => {
            drop(listener);
            true
        }
        Err(_) => false,
    }
}

pub(crate) fn wait_for_port_release(port: u16, attempts: usize, delay_ms: u64) {
    for _ in 0..attempts {
        if is_port_available(port) {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
    }
}

pub(crate) fn start_tonic_listener(
    port: u16,
    stop_token: CancellationToken,
    dispatch_state: Arc<NativeMockDispatchState>,
) -> Result<(AbortHandle, JoinHandle<()>), String> {
    start_mock_dispatch_server(port, stop_token, dispatch_state)
}

pub(crate) async fn stop_runtime(runtime: MockRuntime) {
    let port = runtime.port;
    runtime.stop_token.cancel();
    runtime.abort_handle.abort();
    let _ = runtime.server_task.await;
    wait_for_port_release(port, 40, 25);
}
