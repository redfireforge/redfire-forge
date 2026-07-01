//! Public command surface for native gRPC transport — Phase 7C/7D.

#[allow(unused_imports)]
pub use crate::grpc::lifecycle::{
  grpc_tab_cleanup, grpc_tab_events_attach, grpc_tab_events_detach,
};
#[allow(unused_imports)]
pub use crate::grpc::stream::{
  grpc_stream_cancel, grpc_stream_end, grpc_stream_send, grpc_stream_start,
};
#[allow(unused_imports)]
pub use crate::grpc::unary::{grpc_call_cancel, grpc_unary};
