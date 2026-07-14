use std::collections::HashMap;
use std::convert::Infallible;

use bytes::Bytes;
use prost_reflect::{DescriptorPool, MessageDescriptor};

pub(crate) const MAX_LOG_ENTRIES: usize = 200;
pub(crate) const HEALTH_CHECK_PATH: &str = "/grpc.health.v1.Health/Check";

pub(crate) type RespBody = http_body_util::combinators::BoxBody<Bytes, Infallible>;

#[derive(Clone, Debug)]
pub(crate) struct DispatchMethod {
    pub(crate) service: String,
    pub(crate) method: String,
    pub(crate) call_type: DispatchCallType,
    pub(crate) input: MessageDescriptor,
    pub(crate) output: MessageDescriptor,
}

#[derive(Clone, Copy, Debug)]
pub(crate) enum DispatchCallType {
    Unary,
    ServerStreaming,
    ClientStreaming,
    BidiStreaming,
}

#[derive(Clone, Debug)]
pub struct MockDispatchCatalog {
    pub(crate) methods: HashMap<String, DispatchMethod>,
    /// Full descriptor pool, retained so the listener can answer gRPC
    /// ServerReflection requests from external tools (grpcurl, Studio Reflect).
    pub(crate) pool: DescriptorPool,
}
