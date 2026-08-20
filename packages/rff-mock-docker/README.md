# redfireforge/rff-mock

Docker image for [RedfireForge](https://redfireforge.com) API Mock — run a full contract
mock server in any CI pipeline, Testcontainers test, or local environment without installing
the `rff` binary.

> **Publishing status:** This image is not yet on Docker Hub. Use `Dockerfile.dev` to build
> locally from the monorepo. The image will be published as `redfireforge/rff-mock` once
> the CLI package is on npm.

---

## Quick start

```bash
# Build the local dev image (from monorepo root after npm run build:cli)
docker build -f packages/rff-mock-docker/Dockerfile.dev \
             -t rff-mock:local .

# Run with your mock definition
docker run --rm \
  -v $(pwd)/examples/sla-jsonplaceholder-test.yaml:/workspace/mock.json:ro \
  -p 4600:4600 \
  rff-mock:local
```

The server is ready when `GET http://localhost:4600/__rff/health/ready` returns HTTP 200.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `RFF_MOCK_PORT` | `4600` | Port the mock server listens on |
| `RFF_MOCK_FILE` | `/workspace/mock.json` | Path to the workspace definition JSON |

---

## Health probes

| Path | When 200 | Use for |
|---|---|---|
| `/__rff/health/live` | Immediately after process start | Kubernetes liveness probe |
| `/__rff/health/ready` | After ≥1 route generation committed | Kubernetes readiness probe, `wait-ready`, Testcontainers |

---

## Testcontainers (Java)

Add `rff-mock-junit5` to your Maven project and use `RffMockContainer`:

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

```java
@Testcontainers
class OrderServiceIT {

    @Container
    static RffMockContainer rff = new RffMockContainer()
            .withDefinition("src/test/resources/mocks/orders.json");

    @Test
    void placeOrder() {
        given().baseUri(rff.getBaseUrl()).when().post("/orders").then().statusCode(201);
    }
}
```

See [docs/guides/testcontainers-integration.md](../../docs/guides/testcontainers-integration.md)
for Python, Node.js, Go, .NET, and Playwright examples using `GenericContainer`.

---

## Derived images

For a team that always uses the same mock definition, create a thin derived image:

```dockerfile
FROM redfireforge/rff-mock:latest
COPY mocks/orders.json /workspace/mock.json
```

No `-v` mount required at run time.

---

## Kubernetes

```yaml
containers:
  - name: rff-mock
    image: redfireforge/rff-mock:latest
    ports:
      - containerPort: 4600
    volumeMounts:
      - name: mock-def
        mountPath: /workspace/mock.json
        subPath: mock.json
    livenessProbe:
      httpGet:
        path: /__rff/health/live
        port: 4600
      initialDelaySeconds: 5
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /__rff/health/ready
        port: 4600
      initialDelaySeconds: 5
      periodSeconds: 5
      failureThreshold: 6
volumes:
  - name: mock-def
    configMap:
      name: rff-mock-definition
```
