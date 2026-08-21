# Testcontainers Integration Guide

Use the `redfireforge/rff-mock` Docker image with your language's Testcontainers library
to run a contract mock server as a throwaway container during integration tests — no `rff`
binary required on the developer machine or CI agent, just Docker.

---

## Why Testcontainers over the subprocess libraries?

| | Subprocess (`rff-mock-junit5`, `pytest-rff-mock`, `@redfireforge/mock-jest`) | Testcontainers |
|---|---|---|
| Requires `rff` on PATH | Yes | No — just Docker |
| Port isolation | OS-level port file | Docker network namespace |
| Works in any language | 3 separate packages | One image, any Testcontainers language |
| Startup time | ~300 ms | ~3–5 s (image cached after first pull) |
| Kubernetes parity | — | Same image and health probe as prod |

Use subprocess libraries for speed-sensitive unit-adjacent tests. Use Testcontainers for true
end-to-end integration tests where full environment isolation matters.

---

## Health probes used by wait strategies

All examples rely on the built-in readiness probe:

```
GET /__rff/health/ready
→ 200  {"status":"ok","probe":"ready","generation":1,...}   (routes committed)
→ 503  {"status":"not-ready","probe":"ready","generation":0,...}  (still starting)
```

---

## Java (JUnit 5 + Spring Boot)

### Dependency

```xml
<dependency>
  <groupId>io.redfireforge</groupId>
  <artifactId>rff-mock-junit5</artifactId>
  <version>0.1.0</version>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>testcontainers</artifactId>
  <version>1.20.1</version>
  <scope>test</scope>
</dependency>
```

### Plain JUnit 5

```java
@Testcontainers
class OrderServiceIT {

    @Container
    static RffMockContainer rff = new RffMockContainer()
            .withDefinition("src/test/resources/mocks/orders.json");

    @Test
    void placeOrder() {
        given()
            .baseUri(rff.getBaseUrl())
            .body("{\"item\":\"widget\",\"qty\":2}")
            .contentType(ContentType.JSON)
        .when()
            .post("/orders")
        .then()
            .statusCode(201);
    }
}
```

### Spring Boot

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class OrderServiceSpringIT {

    @Container
    static RffMockContainer rff = new RffMockContainer()
            .withDefinition("src/test/resources/mocks/orders.json");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("downstream.orders.url", rff::getBaseUrl);
    }

    @Autowired
    OrderClient orderClient;

    @Test
    void placeOrder() {
        assertThat(orderClient.placeOrder("widget", 2).getStatus()).isEqualTo(201);
    }
}
```

### Classpath definition (no host path)

```java
new RffMockContainer()
    .withClasspathDefinition("/mocks/orders.json"); // from src/test/resources/mocks/orders.json
```

---

## Python (pytest)

```python
# conftest.py
import pytest
from testcontainers.generic import GenericContainer

MOCK_PORT = 4600
MOCK_IMAGE = "redfireforge/rff-mock:latest"

@pytest.fixture(scope="session")
def rff_container(tmp_path_factory):
    definition = str(Path(__file__).parent / "mocks" / "orders.json")
    with (
        GenericContainer(MOCK_IMAGE)
        .with_volume_mapping(definition, "/workspace/mock.json", "ro")
        .with_exposed_ports(MOCK_PORT)
    ) as c:
        # Wait for readiness
        import urllib.request, time
        host = c.get_container_host_ip()
        port = c.get_exposed_port(MOCK_PORT)
        base_url = f"http://{host}:{port}"
        for _ in range(20):
            try:
                urllib.request.urlopen(f"{base_url}/__rff/health/ready", timeout=2)
                break
            except Exception:
                time.sleep(0.5)
        yield base_url

def test_place_order(rff_container):
    import urllib.request, json
    req = urllib.request.Request(
        f"{rff_container}/orders",
        data=b'{"item":"widget","qty":2}',
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        assert r.status == 201
```

Or with the `testcontainers` Python package's `wait_for_logs`:

```python
from testcontainers.generic import GenericContainer
from testcontainers.core.waiting_utils import wait_for_logs

with GenericContainer("redfireforge/rff-mock:latest") as c:
    wait_for_logs(c, r"generation.*[1-9]", timeout=30)
    base_url = f"http://{c.get_container_host_ip()}:{c.get_exposed_port(4600)}"
```

---

## Node.js / TypeScript (Jest or Vitest)

```typescript
// globalSetup.ts
import { GenericContainer, Wait } from 'testcontainers';
import path from 'path';

let container: any;

export async function setup() {
  container = await new GenericContainer('redfireforge/rff-mock:latest')
    .withCopyFilesToContainer([{
      source: path.resolve(__dirname, 'mocks/orders.json'),
      target: '/workspace/mock.json',
    }])
    .withExposedPorts(4600)
    .withWaitStrategy(Wait.forHttp('/__rff/health/ready', 4600).forStatusCode(200))
    .start();

  process.env.MOCK_BASE_URL = `http://localhost:${container.getMappedPort(4600)}`;
}

export async function teardown() {
  await container?.stop();
}
```

```typescript
// orders.test.ts
test('POST /orders returns 201', async () => {
  const res = await fetch(`${process.env.MOCK_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: 'widget', qty: 2 }),
  });
  expect(res.status).toBe(201);
});
```

```json
// jest.config.json
{
  "globalSetup": "<rootDir>/globalSetup.ts",
  "globalTeardown": "<rootDir>/globalSetup.ts"
}
```

---

## Go (testify + testcontainers-go)

```go
package orders_test

import (
    "context"
    "net/http"
    "testing"

    "github.com/stretchr/testify/require"
    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/wait"
)

func TestPlaceOrder(t *testing.T) {
    ctx := context.Background()

    req := testcontainers.ContainerRequest{
        Image:        "redfireforge/rff-mock:latest",
        ExposedPorts: []string{"4600/tcp"},
        Files: []testcontainers.ContainerFile{{
            HostFilePath:      "testdata/mocks/orders.json",
            ContainerFilePath: "/workspace/mock.json",
            FileMode:          0o444,
        }},
        WaitingFor: wait.ForHTTP("/__rff/health/ready").
            WithPort("4600/tcp").
            WithStatusCodeMatcher(func(status int) bool { return status == 200 }),
    }

    container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
        ContainerRequest: req,
        Started:          true,
    })
    require.NoError(t, err)
    defer container.Terminate(ctx)

    host, _ := container.Host(ctx)
    port, _ := container.MappedPort(ctx, "4600")
    baseURL := "http://" + host + ":" + port.Port()

    resp, err := http.Post(baseURL+"/orders", "application/json",
        strings.NewReader(`{"item":"widget","qty":2}`))
    require.NoError(t, err)
    require.Equal(t, 201, resp.StatusCode)
}
```

---

## .NET (xUnit + Testcontainers for .NET)

```csharp
using Testcontainers.Core;
using Xunit;

public class OrderServiceTests : IAsyncLifetime
{
    private IContainer _container = null!;
    private string _baseUrl = null!;

    public async Task InitializeAsync()
    {
        _container = new ContainerBuilder()
            .WithImage("redfireforge/rff-mock:latest")
            .WithPortBinding(4600, true)
            .WithResourceMapping(
                new FileInfo("mocks/orders.json"),
                "/workspace/mock.json")
            .WithWaitStrategy(
                Wait.ForUnixContainer()
                    .UntilHttpRequestIsSucceeded(r =>
                        r.ForPath("/__rff/health/ready")
                         .ForPort(4600)
                         .ForStatusCode(HttpStatusCode.OK)))
            .Build();

        await _container.StartAsync();
        var port = _container.GetMappedPublicPort(4600);
        _baseUrl = $"http://localhost:{port}";
    }

    public async Task DisposeAsync() => await _container.StopAsync();

    [Fact]
    public async Task PlaceOrder_Returns201()
    {
        var client = new HttpClient { BaseAddress = new Uri(_baseUrl) };
        var body = new StringContent(
            """{"item":"widget","qty":2}""",
            Encoding.UTF8, "application/json");

        var response = await client.PostAsync("/orders", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
```

---

## Playwright (cross-browser E2E)

```typescript
// playwright.config.ts — start the mock before all browser tests
import { defineConfig } from '@playwright/test';
import { GenericContainer, Wait } from 'testcontainers';

let mockContainer: any;

export default defineConfig({
  globalSetup: async () => {
    mockContainer = await new GenericContainer('redfireforge/rff-mock:latest')
      .withCopyFilesToContainer([{
        source: 'mocks/orders.json',
        target: '/workspace/mock.json',
      }])
      .withExposedPorts(4600)
      .withWaitStrategy(Wait.forHttp('/__rff/health/ready', 4600).forStatusCode(200))
      .start();

    process.env.MOCK_BASE_URL = `http://localhost:${mockContainer.getMappedPort(4600)}`;
  },
  globalTeardown: async () => {
    await mockContainer?.stop();
  },
  use: {
    baseURL: 'http://localhost:5173',
  },
});
```

---

## Derived image (team-shared definition)

If every test in your team uses the same definition, bake it in once:

```dockerfile
# Dockerfile.test
FROM redfireforge/rff-mock:latest
COPY mocks/orders.json /workspace/mock.json
```

```bash
docker build -f Dockerfile.test -t my-org/orders-mock:latest .
docker push my-org/orders-mock:latest
```

Then in tests, replace `redfireforge/rff-mock:latest` with `my-org/orders-mock:latest`
and omit the volume mount.

---

## Publishing roadmap

| Milestone | Action |
|---|---|
| CLI published to npm as `redfireforge-cli` | Update `Dockerfile` to `npm install -g redfireforge-cli` |
| First stable release | Tag `redfireforge/rff-mock:0.x.x` on Docker Hub |
| GitHub Container Registry | Mirror to `ghcr.io/redfireforge/rff-mock` |
| `rff-mock-junit5` on Maven Central | Remove local-build requirement for Java consumers |
