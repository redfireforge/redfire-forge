//! Public command surface for native gRPC transport — Phase 7C/7D.

#[allow(unused_imports)]
pub use crate::grpc::lifecycle::{
  grpc_tab_cleanup, grpc_tab_events_attach, grpc_tab_events_detach,
  grpc_tab_heartbeat,
};
#[allow(unused_imports)]
pub use crate::grpc::diagnostics::grpc_native_diagnostics;
#[allow(unused_imports)]
pub use crate::grpc::mock_server::{
  grpc_mock_listener_commit, grpc_mock_listener_log, grpc_mock_listener_start,
  grpc_mock_listener_status, grpc_mock_listener_stop,
};
#[allow(unused_imports)]
pub use crate::grpc::stream::{
  grpc_stream_cancel, grpc_stream_end, grpc_stream_send, grpc_stream_start,
};
#[allow(unused_imports)]
pub use crate::grpc::unary::{grpc_call_cancel, grpc_unary};
