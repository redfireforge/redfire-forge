package io.redfireforge.mock;

import org.junit.jupiter.api.extension.ExtendWith;

import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Convenience annotation that registers {@link RffMockExtension} and configures
 * the mock server definition file in one step.
 *
 * <pre>{@code
 * @SpringBootTest
 * @RffMock("src/test/resources/mocks/orders.json")
 * class OrdersApiTest {
 *
 *     @DynamicPropertySource
 *     static void mockProps(DynamicPropertyRegistry r) {
 *         r.add("orders.service.url", RffMockExtension.getBaseUrl());
 *     }
 * }
 * }</pre>
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Inherited
@ExtendWith(RffMockExtension.class)
public @interface RffMock {

    /** Path to the workspace / server JSON or YAML definition file. */
    String value();

    /** Max seconds to wait for the server to become ready (default: 30). */
    int timeoutSecs() default 30;

    /**
     * Specific server id to start from a multi-server workspace.
     * Defaults to the workspace's {@code activeServerId} or first server.
     */
    String serverId() default "";
}
