import { encodeGrpcWebProtoMessage } from './grpcWebProtoCodec';
import { concatGrpcWebFrames, encodeGrpcWebDataFrame } from './grpcWebFramingCodec';
import { GRPC_WEB_CONTENT_TYPES } from './grpcWebTransportContracts';

export function sseResponse(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

export function buildSuccessGrpcWebStreamResponse(protosetBase64: string): Response {
  const responsePayload = encodeGrpcWebProtoMessage(
    protosetBase64,
    'echo.EchoResponse',
    { message: 'stream-pong' },
  );
  const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]) as BodyInit;
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
      'grpc-status': '0',
      'grpc-message': '',
    },
  });
}
