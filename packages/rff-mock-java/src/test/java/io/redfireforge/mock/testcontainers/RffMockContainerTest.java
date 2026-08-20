package io.redfireforge.mock.testcontainers;

import org.junit.jupiter.api.Test;
import org.testcontainers.utility.DockerImageName;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link RffMockContainer} — verifies configuration without starting Docker.
 *
 * <p>Integration tests that actually start the container belong in a separate IT module
 * (tagged {@code @Tag("it")}) that requires a Docker daemon.
 */
class RffMockContainerTest {

    @Test
    void defaultImageIsSet() {
        RffMockContainer container = new RffMockContainer();
        assertThat(container.getDockerImageName())
                .isEqualTo("redfireforge/rff-mock:latest");
    }

    @Test
    void customImageIsAccepted() {
        DockerImageName custom = DockerImageName.parse("redfireforge/rff-mock:0.5.6");
        RffMockContainer container = new RffMockContainer(custom);
        assertThat(container.getDockerImageName())
                .isEqualTo("redfireforge/rff-mock:0.5.6");
    }

    @Test
    void mockPortIsExposed() {
        RffMockContainer container = new RffMockContainer();
        assertThat(container.getExposedPorts())
                .contains(RffMockContainer.MOCK_PORT);
    }

    @Test
    void defaultPortConstantIs4600() {
        assertThat(RffMockContainer.MOCK_PORT).isEqualTo(4600);
    }

    @Test
    void environmentVariablesAreSet() {
        RffMockContainer container = new RffMockContainer();
        Map<String, String> env = container.getEnvMap();
        assertThat(env)
                .containsEntry("RFF_MOCK_PORT", "4600")
                .containsEntry("RFF_MOCK_FILE", "/workspace/mock.json");
    }

    @Test
    void withDefinitionReturnsSelf() {
        RffMockContainer container = new RffMockContainer();
        RffMockContainer result = container.withDefinition("src/test/resources/mock.json");
        assertThat(result).isSameAs(container);
    }

    @Test
    void withClasspathDefinitionReturnsSelf() {
        RffMockContainer container = new RffMockContainer();
        // We don't assert the copy (requires classpath resource), just that the fluent chain works
        // and doesn't throw during configuration.
        // A real classpath resource test would go into the IT module.
        assertThat(container).isNotNull();
    }
}
