# rff-mock-junit5

JUnit 5 extension and Spring Boot bridge for [RedfireForge](https://redfireforge.io) API Mock.
Provides the same dynamic-port lifecycle as WireMock — start, inject URL, stop — without any JVM dependency on the mock server itself.

## Installation

```xml
<dependency>
  <groupId>io.redfireforge</groupId>
  <artifactId>rff-mock-junit5</artifactId>
  <version>0.1.0</version>
  <scope>test</scope>
</dependency>
```

Requires the `rff` CLI to be on `PATH` (or set `RFF_BINARY` env var).

## Usage

### Any JUnit 5 test

```java
@ExtendWith(RffMockExtension.class)
@RffMock("src/test/resources/mocks/orders.json")
class OrdersApiTest {

    @Test
    void shouldReturnOrders(RffMockServer mock) throws Exception {
        var client = HttpClient.newHttpClient();
        var request = HttpRequest.newBuilder(URI.create(mock.getBaseUrl() + "/orders")).GET().build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode());
    }
}
```

### Spring Boot — inject before context starts

```java
@SpringBootTest
@RffMock("src/test/resources/mocks/orders.json")
class OrdersApiTest {

    // Runs before Spring context boots — same as WireMock @AutoConfigureWireMock
    @DynamicPropertySource
    static void mockProperties(DynamicPropertyRegistry registry) {
        registry.add("orders.service.base-url", RffMockExtension::getBaseUrl);
    }

    @Autowired
    OrdersClient ordersClient;  // configured with the mock URL

    @Test
    void test() {
        assertThat(ordersClient.fetchOrders()).isNotEmpty();
    }
}
```

### Custom configuration

```java
@BeforeAll
static void startMock() throws Exception {
    mock = RffMockServer.start("mocks/orders.json",
        RffMockConfig.builder()
            .rffBinary("/opt/rff/bin/rff")
            .timeoutMs(60_000)
            .serverId("srv-orders")
            .build());
}

@AfterAll
static void stopMock() { mock.close(); }
```

## Health probes

Every mock server exposes Kubernetes-compatible health endpoints:

| Endpoint | Status | Meaning |
|---|---|---|
| `GET /__rff/health/live` | 200 | Server process is alive |
| `GET /__rff/health/ready` | 200 / 503 | Routes committed and ready to serve |

`RffMockServer.getReadyUrl()` and `getLiveUrl()` return the full URLs.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `RFF_BINARY` | `rff` | Path to the rff CLI binary |
