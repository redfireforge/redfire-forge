package com.redfireforge.grpcfixture;

import io.grpc.Contexts;
import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import net.devh.boot.grpc.server.interceptor.GrpcGlobalServerInterceptor;
import org.springframework.stereotype.Component;

/**
 * Minimal Spring-Security-style bearer token gate for {@code echo.EchoService/SecureEcho}.
 * Every other RPC on this fixture passes through untouched.
 */
@Component
@GrpcGlobalServerInterceptor
public class BearerAuthServerInterceptor implements ServerInterceptor {

  private static final Metadata.Key<String> AUTHORIZATION_KEY =
      Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER);
  private static final String REQUIRED_BEARER_TOKEN = "Bearer demo-secret-token";
  private static final String GUARDED_METHOD_SUFFIX = "/SecureEcho";

  @Override
  public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
      ServerCall<ReqT, RespT> call,
      Metadata headers,
      ServerCallHandler<ReqT, RespT> next
  ) {
    String fullMethodName = call.getMethodDescriptor().getFullMethodName();
    if (!fullMethodName.endsWith(GUARDED_METHOD_SUFFIX)) {
      return next.startCall(call, headers);
    }

    String authorization = headers.get(AUTHORIZATION_KEY);
    if (!REQUIRED_BEARER_TOKEN.equals(authorization)) {
      call.close(
          Status.UNAUTHENTICATED.withDescription(
              "SecureEcho requires 'authorization: Bearer demo-secret-token'"
          ),
          new Metadata()
      );
      return new ServerCall.Listener<>() { };
    }

    return Contexts.interceptCall(io.grpc.Context.current(), call, headers, next);
  }
}
