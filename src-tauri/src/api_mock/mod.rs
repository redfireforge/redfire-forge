//! Native API Mock listener (Phase 10D–10E).
//!
//! Desktop Tauri binds the same serialized `ApiMock*V1` contract the companion
//! uses. Web and CLI keep the Node listener. Capability gaps are explicit.

mod capabilities;
pub mod commands;
mod engine;
mod journal;
mod listener;
mod path_match;
mod predicates;
mod registry;
mod render;
mod select;
mod tls;
mod types;

#[cfg(test)]
mod corpus_test;
#[cfg(test)]
mod engine_test;
#[cfg(test)]
mod listener_test;
#[cfg(test)]
mod path_match_test;
#[cfg(test)]
mod predicates_test;
#[cfg(test)]
mod select_test;

pub use registry::ApiMockNativeState;

pub fn shutdown_all_listeners(state: &ApiMockNativeState) {
    state.shutdown_all();
}
