package io.redfireforge.mock;

import org.junit.jupiter.api.extension.AfterAllCallback;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ParameterContext;
import org.junit.jupiter.api.extension.ParameterResolver;

/**
 * JUnit 5 extension that starts a RedfireForge API Mock server before all tests
 * in a class and stops it after all tests complete.
 *
 * <p>Register it via {@link RffMock} (recommended) or directly:
 * <pre>{@code
 * @ExtendWith(RffMockExtension.class)
 * @RffMock("src/test/resources/mocks/orders.json")
 * class MyTest { ... }
 * }</pre>
 *
 * <p>Inject the running server as a parameter in any test method:
 * <pre>{@code
 * @Test
 * void test(RffMockServer mock) {
 *     HttpClient.newHttpClient().send(
 *         HttpRequest.newBuilder(URI.create(mock.getBaseUrl() + "/orders")).GET().build(),
 *         BodyHandlers.ofString());
 * }
 * }</pre>
 *
 * <p>For Spring Boot, bridge to {@code @DynamicPropertySource}:
 * <pre>{@code
 * @DynamicPropertySource
 * static void mockProperties(DynamicPropertyRegistry registry) {
 *     registry.add("orders.service.url", RffMockExtension::getBaseUrl);
 * }
 * }</pre>
 */
public class RffMockExtension implements BeforeAllCallback, AfterAllCallback, ParameterResolver {

    private static final ExtensionContext.Namespace NS =
            ExtensionContext.Namespace.create(RffMockExtension.class);

    private static final String KEY_SERVER = "rffMockServer";

    // Static accessor for @DynamicPropertySource (runs before the extension lifecycle).
    // Populated in beforeAll; safe to call from a static @DynamicPropertySource method
    // when the extension is registered at class level.
    private static volatile String staticBaseUrl;

    // ── JUnit lifecycle ───────────────────────────────────────────────────────

    @Override
    public void beforeAll(ExtensionContext ctx) throws Exception {
        RffMock annotation = ctx.getRequiredTestClass().getAnnotation(RffMock.class);
        if (annotation == null) {
            throw new IllegalStateException(
                    "@RffMock annotation is required on the test class when using RffMockExtension");
        }

        RffMockConfig config = RffMockConfig.builder()
                .timeoutMs((long) annotation.timeoutSecs() * 1000)
                .serverId(annotation.serverId().isBlank() ? null : annotation.serverId())
                .build();

        RffMockServer server = RffMockServer.start(annotation.value(), config);
        ctx.getStore(NS).put(KEY_SERVER, server);
        staticBaseUrl = server.getBaseUrl();

        // Expose as system properties for frameworks that read them at startup.
        System.setProperty("rff.mock.port",     String.valueOf(server.getPort()));
        System.setProperty("rff.mock.base-url", server.getBaseUrl());
    }

    @Override
    public void afterAll(ExtensionContext ctx) throws Exception {
        RffMockServer server = ctx.getStore(NS).get(KEY_SERVER, RffMockServer.class);
        if (server != null) {
            server.close();
        }
        staticBaseUrl = null;
        System.clearProperty("rff.mock.port");
        System.clearProperty("rff.mock.base-url");
    }

    // ── Parameter injection ───────────────────────────────────────────────────

    @Override
    public boolean supportsParameter(ParameterContext paramCtx, ExtensionContext extCtx) {
        return paramCtx.getParameter().getType() == RffMockServer.class;
    }

    @Override
    public Object resolveParameter(ParameterContext paramCtx, ExtensionContext extCtx) {
        return extCtx.getStore(NS).get(KEY_SERVER, RffMockServer.class);
    }

    // ── Static accessors for @DynamicPropertySource ───────────────────────────

    /**
     * Returns the base URL of the running mock server.
     * Call this from a {@code @DynamicPropertySource} method:
     * <pre>{@code
     * @DynamicPropertySource
     * static void props(DynamicPropertyRegistry r) {
     *     r.add("orders.service.url", RffMockExtension::getBaseUrl);
     * }
     * }</pre>
     */
    public static String getBaseUrl() {
        if (staticBaseUrl == null) {
            throw new IllegalStateException(
                    "RffMockExtension has not started yet. Ensure @RffMock is on the test class "
                  + "and the extension is registered before @DynamicPropertySource runs.");
        }
        return staticBaseUrl;
    }

    /** Returns the port of the running mock server (convenience alternative to {@link #getBaseUrl()}). */
    public static int getPort() {
        return Integer.parseInt(System.getProperty("rff.mock.port", "0"));
    }
}
