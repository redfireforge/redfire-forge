use crate::grpc::types::GRPC_TAURI_INTERNAL;

use super::registry::{registry, wait_for_port_release};

pub fn shutdown_all_mock_listeners() -> Result<(), String> {
    let mut map = registry()
        .lock()
        .map_err(|_| format!("{GRPC_TAURI_INTERNAL}: failed to lock mock listener registry"))?;
    let mut ports: Vec<u16> = Vec::new();
    for runtime in map.values() {
        ports.push(runtime.port);
        runtime.stop_token.cancel();
        runtime.abort_handle.abort();
    }
    map.clear();
    drop(map);
    for port in ports {
        wait_for_port_release(port, 40, 25);
    }
    Ok(())
}
