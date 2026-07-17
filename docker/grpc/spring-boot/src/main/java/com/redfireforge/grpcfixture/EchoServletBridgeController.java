package com.redfireforge.grpcfixture;

import echo.EchoRequest;
import echo.EchoResponse;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Servlet-mode (HTTP/1.1) bridge for {@code echo.EchoService/Echo} on the Spring MVC
 * port (:8081) — the target RedfireForge's "Spring Servlet" transport mode calls
 * directly from the browser, with no gRPC/Netty channel involved.
 *
 * <p>Wire format matches gRPC-Web framing (5-byte frame header: 1 flag byte + 4-byte
 * big-endian payload length) so it decodes with the same client used for real
 * grpc-web servers, per {@code src/shared/grpc/grpcGrpcSpringServletUnaryClient.ts}.
 */
@RestController
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class EchoServletBridgeController {

  private static final MediaType GRPC_MEDIA_TYPE = MediaType.parseMediaType("application/grpc");
  private static final int FRAME_HEADER_SIZE = 5;
  private static final byte FRAME_FLAG_DATA = 0x00;
  private static final byte FRAME_FLAG_TRAILER = (byte) 0x80;

  @PostMapping(path = { "/echo.EchoService/Echo", "/EchoService/Echo" }, consumes = "application/grpc")
  public ResponseEntity<byte[]> echo(@RequestBody byte[] framedRequestBody) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(GRPC_MEDIA_TYPE);
    try {
      byte[] messageBytes = decodeDataFrame(framedRequestBody);
      EchoRequest request = EchoRequest.parseFrom(messageBytes);
      EchoResponse response = EchoResponse.newBuilder().setMessage(request.getMessage()).build();
      return new ResponseEntity<>(encodeUnaryOkResponse(response.toByteArray()), headers, HttpStatus.OK);
    } catch (Exception error) {
      byte[] errorBody = encodeUnaryErrorResponse(2, "Spring Servlet bridge failed: " + error.getMessage());
      return new ResponseEntity<>(errorBody, headers, HttpStatus.OK);
    }
  }

  private static byte[] decodeDataFrame(byte[] framed) {
    if (framed == null || framed.length < FRAME_HEADER_SIZE) {
      throw new IllegalArgumentException("Request body too short for a gRPC-Web data frame");
    }
    ByteBuffer buffer = ByteBuffer.wrap(framed);
    buffer.get(); // flag byte — a unary request is always a single data frame
    int length = buffer.getInt(); // big-endian, per the gRPC-Web framing spec
    byte[] payload = new byte[length];
    buffer.get(payload);
    return payload;
  }

  private static byte[] encodeFrame(byte flag, byte[] payload) throws Exception {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    out.write(flag);
    out.write(ByteBuffer.allocate(4).putInt(payload.length).array());
    out.write(payload);
    return out.toByteArray();
  }

  private static byte[] encodeUnaryOkResponse(byte[] messageBytes) throws Exception {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    out.write(encodeFrame(FRAME_FLAG_DATA, messageBytes));
    out.write(encodeFrame(FRAME_FLAG_TRAILER, trailerBlock(0, "")));
    return out.toByteArray();
  }

  private static byte[] encodeUnaryErrorResponse(int grpcStatusCode, String message) {
    try {
      return encodeFrame(FRAME_FLAG_TRAILER, trailerBlock(grpcStatusCode, message));
    } catch (Exception encodeFailure) {
      return new byte[0];
    }
  }

  private static byte[] trailerBlock(int grpcStatusCode, String message) {
    String encodedMessage = URLEncoder.encode(message, StandardCharsets.UTF_8).replace("+", "%20");
    String block = "grpc-status: " + grpcStatusCode + "\r\ngrpc-message: " + encodedMessage + "\r\n";
    return block.getBytes(StandardCharsets.US_ASCII);
  }
}
