use std::collections::HashMap;
use std::pin::Pin;
use std::task::{Context, Poll};

use bytes::Bytes;
use futures::Stream;
use serde_json::Value;
use tokio::sync::mpsc;

use crate::grpc::envelope::{error_envelope, success_envelope};
use crate::grpc::stream_registry::{StreamControlOutcome, StreamOutbound};
use crate::grpc::types::{
    GrpcTauriStreamControlOp, GrpcTauriStreamControlResult, GRPC_TAURI_STREAM_NOT_FOUND,
    GRPC_TAURI_STREAM_OWNERSHIP,
};

pub(crate) struct OutboundReceiverStream {
    rx: mpsc::Receiver<StreamOutbound>,
}

impl OutboundReceiverStream {
    pub(crate) fn new(rx: mpsc::Receiver<StreamOutbound>) -> Self {
        Self { rx }
    }
}

impl Stream for OutboundReceiverStream {
    type Item = Bytes;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        loop {
            match Pin::new(&mut self.rx).poll_recv(cx) {
                Poll::Ready(Some(StreamOutbound::Message(bytes))) => {
                    return Poll::Ready(Some(bytes));
                }
                Poll::Ready(Some(StreamOutbound::EndWrites)) | Poll::Ready(None) => {
                    return Poll::Ready(None);
                }
                Poll::Pending => return Poll::Pending,
            }
        }
    }
}

pub(crate) fn has_non_empty_initial_body(body: &Value) -> bool {
    body.as_object().is_some_and(|object| {
        object.values().any(|value| {
            !value.is_null()
                && value
                    .as_str()
                    .map(|text| !text.is_empty())
                    .unwrap_or(true)
        })
    })
}

pub(crate) fn grpc_status_from_trailers(trailers: &HashMap<String, String>) -> (i32, String) {
    if let Some(code) = trailers
        .get("grpc-status")
        .and_then(|value| value.parse::<i32>().ok())
    {
        let message = trailers
            .get("grpc-message")
            .cloned()
            .unwrap_or_else(|| {
                if code == 0 {
                    "OK".to_string()
                } else {
                    "Error".to_string()
                }
            });
        (code, message)
    } else {
        (0, "OK".to_string())
    }
}

pub(crate) fn map_control_outcome_to_envelope(
    op: &str,
    control_op: GrpcTauriStreamControlOp,
    stream_id: &str,
    tab_id: &str,
    outcome: StreamControlOutcome,
) -> Value {
    match outcome {
        StreamControlOutcome::Acknowledged => success_envelope(
            op,
            GrpcTauriStreamControlResult {
                stream_id: stream_id.to_string(),
                tab_id: tab_id.to_string(),
                op: control_op,
                acknowledged: true,
                already_terminal: None,
            },
            None,
        ),
        StreamControlOutcome::AlreadyTerminal => success_envelope(
            op,
            GrpcTauriStreamControlResult {
                stream_id: stream_id.to_string(),
                tab_id: tab_id.to_string(),
                op: control_op,
                acknowledged: false,
                already_terminal: Some(true),
            },
            None,
        ),
        StreamControlOutcome::NotFound => error_envelope(
            op,
            GRPC_TAURI_STREAM_NOT_FOUND,
            &format!("No active stream registered for streamId {stream_id}"),
            None,
            Some(false),
            None,
            None,
        ),
        StreamControlOutcome::TabMismatch => error_envelope(
            op,
            GRPC_TAURI_STREAM_OWNERSHIP,
            &format!("tabId does not match the registered stream {stream_id}"),
            None,
            Some(false),
            None,
            None,
        ),
        StreamControlOutcome::ClientWritesEnded => unreachable!(
            "ClientWritesEnded is only returned from encode_context/send_outbound"
        ),
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::pin::Pin;
    use std::task::{Context, Poll};

    use futures::Stream;
    use serde_json::json;
    use tokio::sync::mpsc;

    use super::{
        grpc_status_from_trailers, has_non_empty_initial_body, map_control_outcome_to_envelope,
        OutboundReceiverStream,
    };
    use crate::grpc::stream_registry::{StreamControlOutcome, StreamOutbound};
    use crate::grpc::types::{GrpcTauriStreamControlOp, GRPC_TAURI_STREAM_NOT_FOUND};

    #[test]
    fn has_non_empty_initial_body_detects_values() {
        assert!(!has_non_empty_initial_body(&json!({})));
        assert!(!has_non_empty_initial_body(&json!({ "message": "" })));
        assert!(!has_non_empty_initial_body(&json!({ "message": null })));
        assert!(has_non_empty_initial_body(&json!({ "message": "hi" })));
        assert!(has_non_empty_initial_body(&json!({ "count": 1 })));
    }

    #[test]
    fn grpc_status_from_trailers_parses_status_and_message() {
        let mut trailers = HashMap::new();
        trailers.insert("grpc-status".to_string(), "3".to_string());
        trailers.insert("grpc-message".to_string(), "invalid".to_string());
        assert_eq!(grpc_status_from_trailers(&trailers), (3, "invalid".to_string()));

        trailers.remove("grpc-message");
        assert_eq!(grpc_status_from_trailers(&trailers), (3, "Error".to_string()));

        trailers.insert("grpc-status".to_string(), "0".to_string());
        assert_eq!(grpc_status_from_trailers(&trailers), (0, "OK".to_string()));

        assert_eq!(grpc_status_from_trailers(&HashMap::new()), (0, "OK".to_string()));
    }

    #[test]
    fn map_control_outcome_to_envelope_maps_acknowledged_and_terminal() {
        let ack = map_control_outcome_to_envelope(
            "stream_end",
            GrpcTauriStreamControlOp::End,
            "s1",
            "tab-a",
            StreamControlOutcome::Acknowledged,
        );
        assert_eq!(ack["ok"], true);
        assert_eq!(ack["data"]["acknowledged"], true);

        let terminal = map_control_outcome_to_envelope(
            "stream_end",
            GrpcTauriStreamControlOp::End,
            "s1",
            "tab-a",
            StreamControlOutcome::AlreadyTerminal,
        );
        assert_eq!(terminal["ok"], true);
        assert_eq!(terminal["data"]["alreadyTerminal"], true);
        assert_eq!(terminal["data"]["acknowledged"], false);

        let missing = map_control_outcome_to_envelope(
            "stream_end",
            GrpcTauriStreamControlOp::End,
            "s1",
            "tab-a",
            StreamControlOutcome::NotFound,
        );
        assert_eq!(missing["ok"], false);
        assert_eq!(missing["error"]["code"], GRPC_TAURI_STREAM_NOT_FOUND);
    }

    #[tokio::test]
    async fn outbound_receiver_stream_yields_messages_then_ends() {
        let (tx, rx) = mpsc::channel(4);
        tx.send(StreamOutbound::Message(bytes::Bytes::from_static(b"a")))
            .await
            .unwrap();
        tx.send(StreamOutbound::EndWrites).await.unwrap();

        let mut stream = OutboundReceiverStream::new(rx);
        let waker = futures::task::noop_waker();
        let mut cx = Context::from_waker(&waker);

        assert!(matches!(
            Pin::new(&mut stream).poll_next(&mut cx),
            Poll::Ready(Some(bytes)) if bytes == bytes::Bytes::from_static(b"a")
        ));
        assert!(matches!(
            Pin::new(&mut stream).poll_next(&mut cx),
            Poll::Ready(None)
        ));
    }
}
