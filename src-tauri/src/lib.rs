pub mod assertion_evaluator;
mod arrival_executor;
mod commands;
mod kafka;
mod websocket;
pub mod date_helpers;
pub mod histogram;
pub mod deep_compare;
mod executor;
pub mod field_operator;
pub mod http_helpers;
pub mod json_path;
pub mod json_validator;
pub mod subset_match;
mod types;
pub mod validation_result;
pub mod validation_types;

#[cfg(test)]
mod assertion_evaluator_basic_test;
#[cfg(test)]
mod histogram_test;
#[cfg(test)]
mod assertion_evaluator_collection_test;
#[cfg(test)]
mod assertion_evaluator_test;
#[cfg(test)]
mod assertion_evaluator_test_helpers;
#[cfg(test)]
mod assertion_evaluator_value_test;
#[cfg(test)]
mod cross_module_test;
#[cfg(test)]
mod date_helpers_test;
#[cfg(test)]
mod deep_compare_test;
#[cfg(test)]
mod arrival_executor_test;
#[cfg(test)]
mod executor_test;
#[cfg(test)]
mod field_operator_test;
#[cfg(test)]
mod http_helpers_test;
#[cfg(test)]
mod json_path_test;
#[cfg(test)]
mod json_validator_test;
#[cfg(test)]
mod subset_match_test;
#[cfg(test)]
mod validation_result_test;
#[cfg(test)]
mod validation_types_test;

use commands::ExecutorState;
use kafka::state::KafkaState;
use websocket::state::WsState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[allow(unused_mut)] // `mut` is required when the `mcp-bridge` feature is enabled
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .manage(ExecutorState::new())
    .manage(KafkaState::new())
    .manage(WsState::new())
    .invoke_handler(tauri::generate_handler![
      commands::start_load_test,
      commands::abort_load_test,
      commands::is_rust_executor_available,
      kafka::lifecycle::kafka_connect,
      kafka::lifecycle::kafka_disconnect,
      kafka::lifecycle::kafka_status,
      kafka::lifecycle::kafka_topics,
      kafka::operations::kafka_produce,
      kafka::operations::kafka_consume_once,
      kafka::operations::kafka_subscribe,
      kafka::operations::kafka_unsubscribe,
      kafka::operations::kafka_subscriptions,
      websocket::lifecycle::ws_connect,
      websocket::lifecycle::ws_disconnect,
      websocket::lifecycle::ws_status,
      websocket::operations::ws_send,
      websocket::operations::ws_ping,
      websocket::operations::ws_receive_next,
    ]);

  #[cfg(debug_assertions)]
  {
    builder = builder.plugin(tauri_plugin_mcp_bridge::init());
  }

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
