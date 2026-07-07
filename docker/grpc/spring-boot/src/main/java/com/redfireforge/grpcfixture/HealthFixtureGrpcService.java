package com.redfireforge.grpcfixture;

import health.v1.HealthCheckRequest;
import health.v1.HealthCheckResponse;
import health.v1.HealthCheckResponse.ServingStatus;
import health.v1.HealthGrpc;
import io.grpc.stub.ServerCallStreamObserver;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;

/**
 * Fixture-only health service exposed as {@code health.v1.Health} (not the
 * standard {@code grpc.health.v1.Health}) so it survives RedfireForge's
 * reflection filtering and matches the Health Check panel's expectations.
 */
@GrpcService
public class HealthFixtureGrpcService extends HealthGrpc.HealthImplBase {

  private static final long WATCH_INTERVAL_MS = 3_000;

  @Override
  public void check(HealthCheckRequest request, StreamObserver<HealthCheckResponse> responseObserver) {
    responseObserver.onNext(servingResponse());
    responseObserver.onCompleted();
  }

  @Override
  public void watch(HealthCheckRequest request, StreamObserver<HealthCheckResponse> responseObserver) {
    ServerCallStreamObserver<HealthCheckResponse> serverCallObserver =
        (ServerCallStreamObserver<HealthCheckResponse>) responseObserver;

    Thread watcher = new Thread(() -> {
      try {
        while (!serverCallObserver.isCancelled()) {
          serverCallObserver.onNext(servingResponse());
          Thread.sleep(WATCH_INTERVAL_MS);
        }
      } catch (InterruptedException interrupted) {
        Thread.currentThread().interrupt();
      } finally {
        if (!serverCallObserver.isCancelled()) {
          serverCallObserver.onCompleted();
        }
      }
    }, "health-watch-fixture");
    watcher.setDaemon(true);
    serverCallObserver.setOnCancelHandler(watcher::interrupt);
    watcher.start();
  }

  private static HealthCheckResponse servingResponse() {
    return HealthCheckResponse.newBuilder().setStatus(ServingStatus.SERVING).build();
  }
}
