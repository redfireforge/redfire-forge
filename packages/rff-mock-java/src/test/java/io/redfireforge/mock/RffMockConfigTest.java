package io.redfireforge.mock;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RffMockConfigTest {

    @Test
    void defaultsAreReasonable() {
        RffMockConfig cfg = RffMockConfig.defaults();
        assertThat(cfg.getRffBinary()).isNotBlank();
        assertThat(cfg.getTimeoutMs()).isEqualTo(30_000L);
        assertThat(cfg.getPollIntervalMs()).isEqualTo(250L);
        assertThat(cfg.getServerId()).isNull();
    }

    @Test
    void builderOverridesAllFields() {
        RffMockConfig cfg = RffMockConfig.builder()
                .rffBinary("/custom/rff")
                .serverId("srv-orders")
                .timeoutMs(60_000)
                .pollIntervalMs(100)
                .build();

        assertThat(cfg.getRffBinary()).isEqualTo("/custom/rff");
        assertThat(cfg.getServerId()).isEqualTo("srv-orders");
        assertThat(cfg.getTimeoutMs()).isEqualTo(60_000L);
        assertThat(cfg.getPollIntervalMs()).isEqualTo(100L);
    }

    @Test
    void rffBinaryConstantsAreExported() {
        assertThat(RffMockServer.HEALTH_READY_PATH).isEqualTo("/__rff/health/ready");
        assertThat(RffMockServer.HEALTH_LIVE_PATH).isEqualTo("/__rff/health/live");
    }
}
