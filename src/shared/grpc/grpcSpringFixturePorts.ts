/** Host-mapped Spring Boot fixture HTTP/servlet port (avoids common local :8080 conflicts). */
export const GRPC_SPRING_FIXTURE_HTTP_PORT = 8081;

/** Host-mapped Spring Boot fixture Netty gRPC port. */
export const GRPC_SPRING_FIXTURE_NETTY_PORT = 9090;

export const GRPC_SPRING_FIXTURE_SERVLET_TARGET = `localhost:${GRPC_SPRING_FIXTURE_HTTP_PORT}`;

export const GRPC_SPRING_FIXTURE_ACTUATOR_HEALTH_URL =
  `http://localhost:${GRPC_SPRING_FIXTURE_HTTP_PORT}/actuator/health`;

/** Loopback URL used by the Express `/health/spring` proxy. */
export const GRPC_SPRING_FIXTURE_ACTUATOR_HEALTH_LOOPBACK_URL =
  `http://127.0.0.1:${GRPC_SPRING_FIXTURE_HTTP_PORT}/actuator/health`;
