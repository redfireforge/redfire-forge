"""pytest fixtures — auto-registered via the pytest11 entry-point."""

from __future__ import annotations

import os
from typing import Generator, Optional

import pytest

from .server import RffMockConfig, RffMockServer


def _resolve_definition_file(request: pytest.FixtureRequest) -> str:
    """Resolve the definition file from the nearest marker, then env var, then error."""
    marker = request.node.get_closest_marker("rff_mock")
    if marker:
        return str(marker.args[0])
    env = os.environ.get("RFF_MOCK_FILE")
    if env:
        return env
    raise ValueError(
        "No definition file found for rff_mock fixture. "
        "Either mark your test/class with @pytest.mark.rff_mock('path/to/def.json') "
        "or set the RFF_MOCK_FILE environment variable."
    )


def _build_config(request: pytest.FixtureRequest) -> RffMockConfig:
    marker = request.node.get_closest_marker("rff_mock")
    kwargs = marker.kwargs if marker else {}
    return RffMockConfig(
        timeout_secs=float(kwargs.get("timeout_secs", 30)),
        server_id=kwargs.get("server_id"),
    )


# ── Session-scoped fixture (one server for the entire test run) ───────────────

@pytest.fixture(scope="session")
def rff_mock_server(request: pytest.FixtureRequest) -> Generator[RffMockServer, None, None]:
    """Session-scoped fixture: starts one mock server and shares it across all tests.

    Usage::

        @pytest.mark.rff_mock("mocks/orders.json")
        def test_orders(rff_mock_server):
            resp = requests.get(rff_mock_server.base_url + "/orders")
            assert resp.status_code == 200

    Or configure globally in ``conftest.py``::

        @pytest.fixture(scope="session")
        def rff_mock_server():
            with RffMockServer("mocks/orders.json") as mock:
                yield mock
    """
    definition = _resolve_definition_file(request)
    config = _build_config(request)
    with RffMockServer(definition, config) as mock:
        # Expose base URL as an env var so other fixtures / processes can read it.
        os.environ["RFF_MOCK_BASE_URL"] = mock.base_url
        os.environ["RFF_MOCK_PORT"]     = str(mock.port)
        yield mock
    os.environ.pop("RFF_MOCK_BASE_URL", None)
    os.environ.pop("RFF_MOCK_PORT", None)


# ── Module-scoped fixture (one server per test module) ────────────────────────

@pytest.fixture(scope="module")
def rff_mock_server_module(request: pytest.FixtureRequest) -> Generator[RffMockServer, None, None]:
    """Module-scoped variant of :func:`rff_mock_server`."""
    definition = _resolve_definition_file(request)
    config = _build_config(request)
    with RffMockServer(definition, config) as mock:
        yield mock


# ── Function-scoped fixture (fresh server per test) ───────────────────────────

@pytest.fixture(scope="function")
def rff_mock(request: pytest.FixtureRequest) -> Generator[RffMockServer, None, None]:
    """Function-scoped fixture: a fresh mock server for every test.

    Slower than session/module scope but guarantees full isolation between tests.
    """
    definition = _resolve_definition_file(request)
    config = _build_config(request)
    with RffMockServer(definition, config) as mock:
        yield mock


# ── Convenience: base_url string fixtures ─────────────────────────────────────

@pytest.fixture(scope="session")
def rff_mock_base_url(rff_mock_server: RffMockServer) -> str:
    """Session-scoped fixture that yields just the base URL string."""
    return rff_mock_server.base_url


@pytest.fixture(scope="session")
def rff_mock_port(rff_mock_server: RffMockServer) -> int:
    """Session-scoped fixture that yields just the port integer."""
    return rff_mock_server.port
