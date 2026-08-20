# pytest-rff-mock

pytest fixtures for [RedfireForge](https://redfireforge.io) API Mock.
Start a mock server on a dynamic port, inject its URL into tests, stop it cleanly.

## Installation

```bash
pip install pytest-rff-mock
```

Requires the `rff` CLI to be on `PATH` (or set `RFF_BINARY` env var).

## Usage

### Session-scoped (one server for the whole test run — fastest)

```python
# conftest.py
import pytest
from rff_mock import RffMockServer

@pytest.fixture(scope="session")
def mock():
    with RffMockServer("mocks/orders.json") as m:
        yield m
```

```python
# test_orders.py
def test_returns_orders(mock, requests_session):
    resp = requests_session.get(f"{mock.base_url}/orders")
    assert resp.status_code == 200
```

### Via built-in fixture + marker

After installing, `rff_mock_server`, `rff_mock_base_url`, and `rff_mock_port`
fixtures are auto-registered. Mark your test to configure the definition file:

```python
import pytest

@pytest.mark.rff_mock("mocks/orders.json")
def test_orders(rff_mock_server):
    import requests
    resp = requests.get(rff_mock_server.base_url + "/orders")
    assert resp.status_code == 200
```

Or set `RFF_MOCK_FILE=mocks/orders.json` in the environment and omit the marker.

### Function-scoped (fresh server per test — full isolation)

```python
def test_isolated(rff_mock):  # uses function-scoped fixture
    import requests
    resp = requests.get(rff_mock.base_url + "/orders")
    assert resp.status_code == 200
```

### Custom configuration

```python
from rff_mock import RffMockServer, RffMockConfig

config = RffMockConfig(
    rff_binary="/opt/rff/bin/rff",
    timeout_secs=60,
    server_id="srv-orders",
)

with RffMockServer("mocks/orders.json", config) as mock:
    print(mock.base_url)   # http://localhost:51432
    print(mock.ready_url)  # http://localhost:51432/__rff/health/ready
```

## Health probes

Every mock server exposes Kubernetes-compatible endpoints:

| Endpoint | Status | Meaning |
|---|---|---|
| `GET /__rff/health/live` | 200 | Server process is alive |
| `GET /__rff/health/ready` | 200 / 503 | Routes committed and ready to serve |

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `RFF_BINARY` | `rff` | Path to the rff CLI binary |
| `RFF_MOCK_FILE` | — | Definition file (used when no marker is present) |
