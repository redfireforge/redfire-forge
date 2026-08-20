package io.redfireforge.mock.testcontainers;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

import java.time.Duration;

/**
 * Testcontainers module for RedfireForge API Mock.
 *
 * <p>The container starts {@code rff mock start} in {@code --standalone} mode (no companion
 * server inside the container). It uses the built-in {@code /__rff/health/ready} readiness
 * probe to gate the {@code waitingFor} strategy, so the container is not considered ready until
 * at least one route generation has been committed.
 *
 * <h2>Basic usage (JUnit 5)</h2>
 * <pre>{@code
 * @Testcontainers
 * class OrderServiceIT {
 *
 *     @Container
 *     static RffMockContainer rff = new RffMockContainer()
 *             .withDefinition("src/test/resources/mocks/orders.json");
 *
 *     @Test
 *     void placeOrder() {
 *         RestAssured.baseURI = rff.getBaseUrl();
 *         // ...
 *     }
 * }
 * }</pre>
 *
 * <h2>Spring Boot integration</h2>
 * <pre>{@code
 * @SpringBootTest(webEnvironment = RANDOM_PORT)
 * @Testcontainers
 * class OrderServiceSpringIT {
 *
 *     @Container
 *     static RffMockContainer rff = new RffMockContainer()
 *             .withDefinition("src/test/resources/mocks/orders.json");
 *
 *     @DynamicPropertySource
 *     static void props(DynamicPropertyRegistry r) {
 *         r.add("downstream.orders.url", rff::getBaseUrl);
 *     }
 * }
 * }</pre>
 *
 * <h2>Custom image version</h2>
 * <pre>{@code
 * new RffMockContainer(DockerImageName.parse("redfireforge/rff-mock:0.5.6"))
 *         .withDefinition("mocks/orders.json");
 * }</pre>
 */
public class RffMockContainer extends GenericContainer<RffMockContainer> {

    /** Default port the mock server listens on inside the container. */
    public static final int MOCK_PORT = 4600;

    /**
     * Default Docker image.
     * TODO(publish): update tag to a pinned stable version once published to Docker Hub.
     */
    public static final DockerImageName DEFAULT_IMAGE =
            DockerImageName.parse("redfireforge/rff-mock:latest");

    /** Path inside the container where the definition file is mounted. */
    private static final String CONTAINER_DEFINITION_PATH = "/workspace/mock.json";

    /** Readiness probe path — returns 200 once ≥1 route generation is committed. */
    private static final String HEALTH_READY_PATH = "/__rff/health/ready";

    // ─── Constructors ────────────────────────────────────────────────────────

    /** Creates a container using the default {@link #DEFAULT_IMAGE}. */
    public RffMockContainer() {
        this(DEFAULT_IMAGE);
    }

    /**
     * Creates a container using a custom image name (e.g. a pinned version or a local dev build).
     *
     * @param image the Docker image name
     */
    public RffMockContainer(DockerImageName image) {
        super(image);
        withExposedPorts(MOCK_PORT);
        waitingFor(
                Wait.forHttp(HEALTH_READY_PATH)
                        .forStatusCode(200)
                        .withStartupTimeout(Duration.ofSeconds(60)));
        withEnv("RFF_MOCK_PORT", String.valueOf(MOCK_PORT));
        withEnv("RFF_MOCK_FILE", CONTAINER_DEFINITION_PATH);
    }

    // ─── Fluent configuration ────────────────────────────────────────────────

    /**
     * Mounts a host-side mock definition JSON file into the container.
     *
     * <p>The path can be relative (resolved from the working directory) or absolute.
     *
     * @param hostPath path to the {@code .json} workspace definition on the host
     * @return this container for chaining
     */
    public RffMockContainer withDefinition(String hostPath) {
        withCopyFileToContainer(
                MountableFile.forHostPath(hostPath),
                CONTAINER_DEFINITION_PATH);
        return this;
    }

    /**
     * Mounts a class-path resource (from the test classpath) as the mock definition.
     *
     * <p>Example: {@code withClasspathDefinition("/mocks/orders.json")}
     *
     * @param classpathResource classpath-relative path (must start with {@code /})
     * @return this container for chaining
     */
    public RffMockContainer withClasspathDefinition(String classpathResource) {
        withCopyFileToContainer(
                MountableFile.forClasspathResource(classpathResource),
                CONTAINER_DEFINITION_PATH);
        return this;
    }

    // ─── Runtime accessors ───────────────────────────────────────────────────

    /**
     * Returns the base URL of the mock server as seen from the host.
     *
     * <p>Use this in {@code @DynamicPropertySource} or wherever a base URL is needed:
     * <pre>{@code
     * r.add("service.url", rff::getBaseUrl);
     * }</pre>
     *
     * @return e.g. {@code http://localhost:32768}
     * @throws IllegalStateException if the container has not been started
     */
    public String getBaseUrl() {
        return "http://" + getHost() + ":" + getMappedPort(MOCK_PORT);
    }

    /**
     * Returns the host-mapped port for the mock server.
     *
     * @return mapped port (random, assigned by Docker)
     * @throws IllegalStateException if the container has not been started
     */
    public int getMockPort() {
        return getMappedPort(MOCK_PORT);
    }
}
