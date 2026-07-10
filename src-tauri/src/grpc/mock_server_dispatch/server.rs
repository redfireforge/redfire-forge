use std::convert::Infallible;

use http::Request;
use hyper::body::Incoming;
use hyper::service::service_fn;
use hyper_util::rt::{TokioExecutor, TokioIo};
use tokio::net::TcpListener;
use tokio::task::{AbortHandle, JoinHandle};
use tokio_util::sync::CancellationToken;

use super::state::NativeMockDispatchState;

pub fn start_mock_dispatch_server(
    port: u16,
    stop_token: CancellationToken,
    dispatch_state: std::sync::Arc<NativeMockDispatchState>,
) -> Result<(AbortHandle, JoinHandle<()>), String> {
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    let mut last_error: Option<std::io::Error> = None;
    let mut std_listener: Option<std::net::TcpListener> = None;

    for _ in 0..6 {
        match std::net::TcpListener::bind(addr) {
            Ok(listener) => {
                std_listener = Some(listener);
                break;
            }
            Err(error) if error.kind() == std::io::ErrorKind::AddrInUse => {
                last_error = Some(error);
                std::thread::sleep(std::time::Duration::from_millis(40));
            }
            Err(error) => {
                return Err(format!("failed to bind mock listener on {addr}: {error}"));
            }
        }
    }

    let std_listener = match std_listener {
        Some(listener) => listener,
        None => {
            let detail = last_error
                .map(|error| error.to_string())
                .unwrap_or_else(|| "address in use".to_string());
            return Err(format!("failed to bind mock listener on {addr}: {detail}"));
        }
    };

    std_listener
        .set_nonblocking(true)
        .map_err(|error| format!("failed to configure mock listener socket on {addr}: {error}"))?;

    let listener = TcpListener::from_std(std_listener)
        .map_err(|error| format!("failed to adopt mock listener socket on {addr}: {error}"))?;

    let task = tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = stop_token.cancelled() => {
                    break;
                }
                accept = listener.accept() => {
                    let Ok((stream, _)) = accept else {
                        continue;
                    };
                    let io = TokioIo::new(stream);
                    let state = dispatch_state.clone();
                    let service = service_fn(move |req: Request<Incoming>| {
                        let state = state.clone();
                        async move {
                            Ok::<_, Infallible>(state.handle_http_request(req).await)
                        }
                    });

                    tokio::spawn(async move {
                        let builder = hyper::server::conn::http2::Builder::new(TokioExecutor::new());
                        if let Err(error) = builder.serve_connection(io, service).await {
                            log::debug!("grpc mock dispatch connection closed: {error}");
                        }
                    });
                }
            }
        }
    });

    let abort_handle = task.abort_handle();
    Ok((abort_handle, task))
}
