package io.redfireforge.mock;

/**
 * Tuning options for {@link RffMockServer}.
 *
 * <pre>{@code
 * RffMockConfig config = RffMockConfig.builder()
 *     .rffBinary("/usr/local/bin/rff")
 *     .timeoutMs(60_000)
 *     .build();
 * RffMockServer mock = RffMockServer.start("mocks/orders.json", config);
 * }</pre>
 */
public final class RffMockConfig {

    private final String rffBinary;
    private final String serverId;
    private final long   timeoutMs;
    private final long   pollIntervalMs;

    private RffMockConfig(Builder b) {
        this.rffBinary      = b.rffBinary;
        this.serverId       = b.serverId;
        this.timeoutMs      = b.timeoutMs;
        this.pollIntervalMs = b.pollIntervalMs;
    }

    /** Default configuration: {@code rff} on PATH, 30 s timeout, 250 ms poll interval. */
    public static RffMockConfig defaults() {
        return builder().build();
    }

    public String getRffBinary()      { return rffBinary; }
    public String getServerId()       { return serverId; }
    public long   getTimeoutMs()      { return timeoutMs; }
    public long   getPollIntervalMs() { return pollIntervalMs; }

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private String rffBinary      = resolveDefaultBinary();
        private String serverId       = null;
        private long   timeoutMs      = 30_000;
        private long   pollIntervalMs = 250;

        /** Path or name of the rff binary (default: {@code rff} resolved from PATH). */
        public Builder rffBinary(String rffBinary) {
            this.rffBinary = rffBinary;
            return this;
        }

        /** Specific server id to start from a multi-server workspace. */
        public Builder serverId(String serverId) {
            this.serverId = serverId;
            return this;
        }

        /** Max milliseconds to wait for the server to become ready (default: 30 000). */
        public Builder timeoutMs(long timeoutMs) {
            this.timeoutMs = timeoutMs;
            return this;
        }

        /** Milliseconds between readiness poll attempts (default: 250). */
        public Builder pollIntervalMs(long pollIntervalMs) {
            this.pollIntervalMs = pollIntervalMs;
            return this;
        }

        public RffMockConfig build() { return new RffMockConfig(this); }

        private static String resolveDefaultBinary() {
            // Honour an env-var override so CI pipelines can pin a path.
            String env = System.getenv("RFF_BINARY");
            return (env != null && !env.isBlank()) ? env : "rff";
        }
    }
}
