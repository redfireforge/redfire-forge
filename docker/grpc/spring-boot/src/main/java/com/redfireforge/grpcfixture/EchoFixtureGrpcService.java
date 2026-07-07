package com.redfireforge.grpcfixture;

import echo.ComplexEchoRequest;
import echo.ComplexEchoResponse;
import echo.EchoRequest;
import echo.EchoResponse;
import echo.EchoServiceGrpc;
import echo.StreamRequest;
import io.grpc.stub.StreamObserver;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import net.devh.boot.grpc.server.service.GrpcService;

@GrpcService
public class EchoFixtureGrpcService extends EchoServiceGrpc.EchoServiceImplBase {

  private final AtomicLong requestCounter = new AtomicLong(1);

  @Override
  public void echo(EchoRequest request, StreamObserver<EchoResponse> responseObserver) {
    String message = request.getMessage();
    responseObserver.onNext(EchoResponse.newBuilder().setMessage(message).build());
    responseObserver.onCompleted();
  }

  @Override
  public void createComplexEcho(
      ComplexEchoRequest request,
      StreamObserver<ComplexEchoResponse> responseObserver
  ) {
    String message = request.getMessage().isBlank() ? "complex-echo" : request.getMessage();
    long sequence = requestCounter.getAndIncrement();

    ComplexEchoResponse.Builder response = ComplexEchoResponse.newBuilder()
        .setRequestId("spring-complex-" + sequence)
        .setMessage(message)
        .setReceivedUnixMs(Instant.now().toEpochMilli());

    List<String> labels = request.getLabelsCount() == 0
        ? List.of("spring", "fixture")
        : new ArrayList<>(request.getLabelsList());
    response.addAllLabels(labels);

    Map<String, String> attributes = request.getAttributesMap();
    if (attributes.isEmpty()) {
      response.putAttributes("fixture", "spring-boot");
      response.putAttributes("transport", "grpc");
    } else {
      response.putAllAttributes(attributes);
    }

    responseObserver.onNext(response.build());
    responseObserver.onCompleted();
  }

  @Override
  public void serverStream(StreamRequest request, StreamObserver<EchoResponse> responseObserver) {
    int count = Math.max(1, request.getRepeatCount());
    String base = request.getMessage().isBlank() ? "spring-stream" : request.getMessage();

    for (int i = 1; i <= count; i++) {
      String suffix = count > 1 ? " [" + i + "/" + count + "]" : "";
      responseObserver.onNext(EchoResponse.newBuilder().setMessage(base + suffix).build());
    }

    responseObserver.onCompleted();
  }

  @Override
  public StreamObserver<EchoRequest> clientStream(StreamObserver<EchoResponse> responseObserver) {
    List<String> parts = new ArrayList<>();
    return new StreamObserver<>() {
      @Override
      public void onNext(EchoRequest value) {
        parts.add(value.getMessage());
      }

      @Override
      public void onError(Throwable t) {
        responseObserver.onError(t);
      }

      @Override
      public void onCompleted() {
        String merged = String.join(",", parts);
        responseObserver.onNext(EchoResponse.newBuilder().setMessage(merged).build());
        responseObserver.onCompleted();
      }
    };
  }

  @Override
  public void secureEcho(EchoRequest request, StreamObserver<EchoResponse> responseObserver) {
    // Auth enforcement happens in BearerAuthServerInterceptor before this method runs —
    // reaching here means the bearer token already validated.
    responseObserver.onNext(EchoResponse.newBuilder().setMessage(request.getMessage()).build());
    responseObserver.onCompleted();
  }

  @Override
  public StreamObserver<EchoRequest> bidiStream(StreamObserver<EchoResponse> responseObserver) {
    return new StreamObserver<>() {
      @Override
      public void onNext(EchoRequest value) {
        responseObserver.onNext(EchoResponse.newBuilder().setMessage(value.getMessage()).build());
      }

      @Override
      public void onError(Throwable t) {
        responseObserver.onError(t);
      }

      @Override
      public void onCompleted() {
        responseObserver.onCompleted();
      }
    };
  }
}
