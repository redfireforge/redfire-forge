//! Native gRPC mock listener HTTP/2 dispatch runtime.

mod catalog;
mod response;
mod server;
mod state;
mod types;

#[cfg(test)]
mod tests;

pub use catalog::build_dispatch_catalog;
pub use server::start_mock_dispatch_server;
pub use state::NativeMockDispatchState;
pub use types::MockDispatchCatalog;
