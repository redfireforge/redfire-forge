package io.redfireforge.mock.spring;

import io.redfireforge.mock.RffMock;
import io.redfireforge.mock.RffMockConfig;
import io.redfireforge.mock.RffMockServer;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.context.support.TestPropertySourceUtils;

/**
 * Spring {@code ApplicationContextInitializer} that starts a RedfireForge API Mock
 * server and injects its URL into the application context <em>before</em> any beans
 * are created — equivalent to WireMock's {@code @AutoConfigureWireMock}.
 *
 * <p>Add it to your test class via {@code @ContextConfiguration}:
 * <pre>{@code
 * @SpringBootTest
 * @RffMock("src/test/resources/mocks/orders.json")
 * @ContextConfiguration(initializers = RffMockContextInitializer.class)
 * class OrdersApiTest {
 *     // orders.service.url = http://localhost:<rff-port>  automatically set
 * }
 * }</pre>
 *
 * <p>Or register via {@code spring.factories} / {@code @ImportAutoConfiguration} for
 * project-wide default injection without per-class boilerplate.
 *
 * <p>Property injected: {@code rff.mock.base-url} (and {@code rff.mock.port}).
 * Override the property name by subclassing and overriding {@link #propertyName()}.
 */
public class RffMockContextInitializer
        implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext ctx) {
        Class<?> testClass = resolveTestClass(ctx);
        RffMock annotation = testClass != null ? testClass.getAnnotation(RffMock.class) : null;
        if (annotation == null) return;

        try {
            RffMockConfig config = RffMockConfig.builder()
                    .timeoutMs((long) annotation.timeoutSecs() * 1000)
                    .serverId(annotation.serverId().isBlank() ? null : annotation.serverId())
                    .build();

            RffMockServer server = RffMockServer.start(annotation.value(), config);

            // Register shutdown hook so the server stops with the Spring context.
            ctx.addApplicationListener(event -> {
                if (event instanceof org.springframework.context.event.ContextClosedEvent) {
                    server.close();
                }
            });

            // Inject as highest-priority inline properties.
            TestPropertySourceUtils.addInlinedPropertiesToEnvironment(ctx,
                    "rff.mock.port=" + server.getPort(),
                    propertyName() + "=" + server.getBaseUrl()
            );

        } catch (Exception e) {
            throw new IllegalStateException("Failed to start rff mock server", e);
        }
    }

    /**
     * The Spring property name that receives the mock base URL.
     * Subclass and override to use a domain-specific property:
     * <pre>{@code
     * // In OrdersMockContextInitializer:
     * @Override protected String propertyName() { return "orders.service.base-url"; }
     * }</pre>
     */
    protected String propertyName() { return "rff.mock.base-url"; }

    private static Class<?> resolveTestClass(ConfigurableApplicationContext ctx) {
        Object testInstance = ctx.getEnvironment()
                .getProperty("test.instance", Object.class);
        return testInstance != null ? testInstance.getClass() : null;
    }
}
