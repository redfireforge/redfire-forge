use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use bytes::Bytes;
use http::uri::PathAndQuery;
use prost_reflect::{DescriptorPool, MethodDescriptor};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;
use tonic::client::Grpc;
use tonic::codec::Streaming;
use tonic::metadata::MetadataMap;
use tonic::{Code, Request, Status};

use crate::grpc::bytes_codec::BytesCodec;
use crate::grpc::descriptor::{decode_response_json, tonic_metadata_to_map};
use crate::grpc::state::GrpcState;
use crate::grpc::stream_registry::StreamOutbound;

use super::context::StreamContext;
use super::helpers::{grpc_status_from_trailers, OutboundReceiverStream};

pub(crate) async fn run_server_stream(
    state: Arc<GrpcState>,
    ctx: StreamContext,
    channel: tonic::transport::Channel,
    path: PathAndQuery,
    request_bytes: Bytes,
    metadata: MetadataMap,
    timeout: Duration,
    cancel_token: CancellationToken,
    pool: DescriptorPool,
    method: MethodDescriptor,
) {
    let mut request = Request::new(request_bytes);
    *request.metadata_mut() = metadata;
    request.set_timeout(timeout);

    let mut grpc = Grpc::new(channel);
    let ready = tokio::select! {
        result = grpc.ready() => result,
        _ = cancel_token.cancelled() => {
            ctx.emit_cancelled_end(&state);
            return;
        }
    };
    if let Err(error) = ready {
        handle_stream_status(
            &state,
            &ctx,
            Status::internal(error.to_string()),
            HashMap::new(),
            HashMap::new(),
        );
        return;
    }

    let response = tokio::select! {
        result = grpc.server_streaming(request, path, BytesCodec) => result,
        _ = cancel_token.cancelled() => {
            ctx.emit_cancelled_end(&state);
            return;
        }
    };

    match response {
        Ok(response) => {
            let (response_metadata, mut streaming, _extensions) = response.into_parts();
            let headers = tonic_metadata_to_map(&response_metadata);

            if let Err(status) = read_inbound_messages(
                &state,
                &ctx,
                &method,
                &mut streaming,
                &cancel_token,
            )
            .await
            {
                handle_stream_status(&state, &ctx, status, headers, HashMap::new());
                return;
            }

            let trailers = match streaming.trailers().await {
                Ok(Some(trailers)) => tonic_metadata_to_map(&trailers),
                Ok(None) => HashMap::new(),
                Err(status) => {
                    handle_stream_status(&state, &ctx, status, headers, HashMap::new());
                    return;
                }
            };

            let (grpc_status, status_message) = grpc_status_from_trailers(&trailers);

            ctx.emit_end(
                &state,
                grpc_status,
                status_message,
                headers,
                trailers,
                None,
            );
        }
        Err(status) => {
            handle_stream_status(&state, &ctx, status, HashMap::new(), HashMap::new());
        }
    }

    let _ = pool;
}

pub(crate) async fn run_client_stream(
    state: Arc<GrpcState>,
    ctx: StreamContext,
    channel: tonic::transport::Channel,
    path: PathAndQuery,
    outbound_rx: mpsc::Receiver<StreamOutbound>,
    metadata: MetadataMap,
    timeout: Duration,
    cancel_token: CancellationToken,
    pool: DescriptorPool,
    method: MethodDescriptor,
) {
    let outbound = OutboundReceiverStream::new(outbound_rx);
    let mut request = Request::new(outbound);
    *request.metadata_mut() = metadata;
    request.set_timeout(timeout);

    let mut grpc = Grpc::new(channel);
    let ready = tokio::select! {
        result = grpc.ready() => result,
        _ = cancel_token.cancelled() => {
            ctx.emit_cancelled_end(&state);
            return;
        }
    };
    if let Err(error) = ready {
        handle_stream_status(
            &state,
            &ctx,
            Status::internal(error.to_string()),
            HashMap::new(),
            HashMap::new(),
        );
        return;
    }

    let response = tokio::select! {
        result = grpc.client_streaming(request, path, BytesCodec) => result,
        _ = cancel_token.cancelled() => {
            ctx.emit_cancelled_end(&state);
            return;
        }
    };

    match response {
        Ok(response) => {
            let (response_metadata, response_bytes, _extensions) = response.into_parts();
            let headers = tonic_metadata_to_map(&response_metadata);
            let trailers = HashMap::new();

            let body = match decode_response_json(&method, &response_bytes) {
                Ok(json) => Some(json),
                Err(message) => {
                    ctx.emit_error(&state, message, None);
                    return;
                }
            };

            ctx.emit_end(&state, 0, "OK".to_string(), headers, trailers, body);
        }
        Err(status) => {
            handle_stream_status(&state, &ctx, status, HashMap::new(), HashMap::new());
        }
    }

    let _ = pool;
}

pub(crate) async fn run_bidi_stream(
    state: Arc<GrpcState>,
    ctx: StreamContext,
    channel: tonic::transport::Channel,
    path: PathAndQuery,
    outbound_rx: mpsc::Receiver<StreamOutbound>,
    metadata: MetadataMap,
    timeout: Duration,
    cancel_token: CancellationToken,
    pool: DescriptorPool,
    method: MethodDescriptor,
) {
    let outbound = OutboundReceiverStream::new(outbound_rx);
    let mut request = Request::new(outbound);
    *request.metadata_mut() = metadata;
    request.set_timeout(timeout);

    let mut grpc = Grpc::new(channel);
    let ready = tokio::select! {
        result = grpc.ready() => result,
        _ = cancel_token.cancelled() => {
            ctx.emit_cancelled_end(&state);
            return;
        }
    };
    if let Err(error) = ready {
        handle_stream_status(
            &state,
            &ctx,
            Status::internal(error.to_string()),
            HashMap::new(),
            HashMap::new(),
        );
        return;
    }

    let response = tokio::select! {
        result = grpc.streaming(request, path, BytesCodec) => result,
        _ = cancel_token.cancelled() => {
            ctx.emit_cancelled_end(&state);
            return;
        }
    };

    match response {
        Ok(response) => {
            let (response_metadata, mut streaming, _extensions) = response.into_parts();
            let headers = tonic_metadata_to_map(&response_metadata);

            if let Err(status) = read_inbound_messages(
                &state,
                &ctx,
                &method,
                &mut streaming,
                &cancel_token,
            )
            .await
            {
                handle_stream_status(&state, &ctx, status, headers, HashMap::new());
                return;
            }

            let trailers = match streaming.trailers().await {
                Ok(Some(trailers)) => tonic_metadata_to_map(&trailers),
                Ok(None) => HashMap::new(),
                Err(status) => {
                    handle_stream_status(&state, &ctx, status, headers, HashMap::new());
                    return;
                }
            };

            let (grpc_status, status_message) = grpc_status_from_trailers(&trailers);

            ctx.emit_end(
                &state,
                grpc_status,
                status_message,
                headers,
                trailers,
                None,
            );
        }
        Err(status) => {
            handle_stream_status(&state, &ctx, status, HashMap::new(), HashMap::new());
        }
    }

    let _ = pool;
}

async fn read_inbound_messages(
    state: &GrpcState,
    ctx: &StreamContext,
    method: &MethodDescriptor,
    streaming: &mut Streaming<Bytes>,
    cancel_token: &CancellationToken,
) -> Result<(), Status> {
    loop {
        let message = tokio::select! {
            result = streaming.message() => result,
            _ = cancel_token.cancelled() => {
                ctx.emit_cancelled_end(state);
                return Ok(());
            }
        };

        match message {
            Ok(Some(bytes)) => match decode_response_json(method, &bytes) {
                Ok(json) => ctx.emit_message(state, json, "inbound"),
                Err(message) => {
                    ctx.emit_error(state, message, None);
                    return Ok(());
                }
            },
            Ok(None) => return Ok(()),
            Err(status) => return Err(status),
        }
    }
}

fn handle_stream_status(
    state: &GrpcState,
    ctx: &StreamContext,
    status: Status,
    headers: HashMap<String, String>,
    trailers: HashMap<String, String>,
) {
    if status.code() == Code::Cancelled {
        ctx.emit_cancelled_end(state);
        return;
    }

    if status.code() == Code::Ok {
        ctx.emit_end(
            state,
            0,
            "OK".to_string(),
            headers,
            trailers,
            None,
        );
        return;
    }

    ctx.emit_end(
        state,
        status.code() as i32,
        status.message().to_string(),
        headers,
        trailers,
        None,
    );
}
