/**
 * Spring Servlet browser transport contracts — Phase 10D.
 *
 * @see https://docs.spring.io/spring-grpc/reference/server.html (servlet mode)
 */
export const SPRING_SERVLET_CONTENT_TYPE = 'application/grpc';

/** Headers owned by the Spring Servlet transport layer — metadata cannot override. */
export const SPRING_SERVLET_RESERVED_HEADERS: ReadonlySet<string> = new Set([
  'accept',
  'content-type',
  'te',
  'grpc-timeout',
]);

export const SPRING_SERVLET_TE_TRAILERS = 'trailers';
