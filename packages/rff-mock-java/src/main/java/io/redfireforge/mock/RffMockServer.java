package io.redfireforge.mock;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Manages the lifecycle of a RedfireForge API Mock server subprocess.
 *
 * <p>Typical usage via {@link RffMockExtension}:
 * <pre>{@code
 * @ExtendWith(RffMockExtension.class)
 * @RffMock("src/test/resources/mocks/orders.json")
 * class OrdersApiTest { ... }
 * }</pre>
 *
 * <p>Or directly with try-with-resources:
 * <pre>{@code
 * try (RffMockServer mock = RffMockServer.start("mocks/orders.json")) {
 *     doTest(mock.getBaseUrl());
 * }
 * }</pre>
 */
public final class RffMockServer implements AutoCloseable {

    /** Path to the built-in readiness probe endpoint. */
    public static final String HEALTH_READY_PATH = "/__rff/health/ready";

    /** Path to the built-in liveness probe endpoint. */
    public static final String HEALTH_LIVE_PATH  = "/__rff/health/live";

    private final Process  serverProcess;
    private final int      port;
    private final Path     portFile;

    private RffMockServer(Process serverProcess, int port, Path portFile) {
        this.serverProcess = serverProcess;
        this.port          = port;
        this.portFile      = portFile;
    }

    // ── Factory ───────────────────────────────────────────────────────────────

    /**
     * Start a mock server using the default {@code rff} binary found on PATH.
     *
     * @param definitionFile path to the workspace/server JSON (or YAML)
     */
    public static RffMockServer start(String definitionFile) throws IOException, InterruptedException {
        return start(definitionFile, RffMockConfig.defaults());
    }

    /**
     * Start a mock server with explicit configuration.
     *
     * @param definitionFile path to the workspace/server JSON (or YAML)
     * @param config         tuning options (binary path, timeout, host…)
     */
    public static RffMockServer start(String definitionFile, RffMockConfig config)
            throws IOException, InterruptedException {

        Path portFile = Files.createTempFile("rff-mock-", ".port");
        portFile.toFile().deleteOnExit();

        // 1. Start the mock server in background (--standalone keeps it in-process).
        List<String> startCmd = new ArrayList<>(List.of(
                config.getRffBinary(),
                "mock", "start", definitionFile,
                "--port", "auto",
                "--port-file", portFile.toString(),
                "--standalone"
        ));
        if (config.getServerId() != null) {
            startCmd.addAll(List.of("--server", config.getServerId()));
        }

        Process server = new ProcessBuilder(startCmd)
                .redirectErrorStream(true)
                .start();

        // 2. Wait for /__rff/health/ready to return 200 (replaces a separate wait-ready process).
        waitForReady(portFile, config);

        // 3. Read the bound port from the file.
        int port = Integer.parseInt(Files.readString(portFile).trim());

        return new RffMockServer(server, port, portFile);
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    /** The OS port the mock server is listening on. */
    public int getPort() { return port; }

    /** Full base URL, e.g. {@code http://localhost:51432}. */
    public String getBaseUrl() { return "http://localhost:" + port; }

    /** URL of the built-in readiness probe. */
    public String getReadyUrl() { return getBaseUrl() + HEALTH_READY_PATH; }

    /** URL of the built-in liveness probe. */
    public String getLiveUrl()  { return getBaseUrl() + HEALTH_LIVE_PATH; }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /**
     * Stop the mock server and clean up the port file.
     * Safe to call multiple times.
     */
    @Override
    public void close() {
        serverProcess.destroy();
        try { serverProcess.waitFor(); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
        try { Files.deleteIfExists(portFile); } catch (IOException ignored) {}
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    /**
     * Poll {@code /__rff/health/ready} until it returns HTTP 200 or timeout expires.
     * Waits for the port file to appear first (handles the brief gap between process
     * start and file write).
     */
    private static void waitForReady(Path portFile, RffMockConfig config)
            throws InterruptedException, IOException {

        long deadline = System.currentTimeMillis() + config.getTimeoutMs();

        // Phase 1: wait for the port file to be written.
        while (!Files.exists(portFile) || Files.readString(portFile).isBlank()) {
            if (System.currentTimeMillis() >= deadline) {
                throw new IOException("rff mock did not write port file within timeout: " + portFile);
            }
            Thread.sleep(config.getPollIntervalMs());
        }

        int port = Integer.parseInt(Files.readString(portFile).trim());
        String healthUrl = "http://localhost:" + port + HEALTH_READY_PATH;

        // Phase 2: poll the readiness endpoint.
        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(500))
                .build();
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(healthUrl))
                .GET()
                .timeout(Duration.ofMillis(500))
                .build();

        while (System.currentTimeMillis() < deadline) {
            try {
                HttpResponse<Void> res = http.send(req, HttpResponse.BodyHandlers.discarding());
                if (res.statusCode() == 200) return;
                // 503 = alive but not ready; keep polling.
            } catch (Exception ignored) {
                // ECONNREFUSED — server process not yet accepting connections.
            }
            Thread.sleep(config.getPollIntervalMs());
        }

        throw new IOException("rff mock did not become ready at " + healthUrl
                + " within " + config.getTimeoutMs() + "ms");
    }
}
