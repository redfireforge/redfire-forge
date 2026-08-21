"""Core RffMockServer — subprocess wrapper around the rff CLI."""

from __future__ import annotations

import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

HEALTH_READY_PATH = "/__rff/health/ready"
HEALTH_LIVE_PATH  = "/__rff/health/live"


@dataclass
class RffMockConfig:
    """Tuning options for :class:`RffMockServer`.

    Example::

        config = RffMockConfig(timeout_secs=60, rff_binary="/usr/local/bin/rff")
        with RffMockServer("mocks/orders.json", config) as mock:
            ...
    """

    #: Path or name of the rff binary.  Defaults to the ``RFF_BINARY`` env var,
    #: then ``rff`` (resolved from ``PATH``).
    rff_binary: str = field(default_factory=lambda: os.environ.get("RFF_BINARY", "rff"))

    #: Seconds to wait for the server to become ready.
    timeout_secs: float = 30.0

    #: Seconds between readiness poll attempts.
    poll_interval_secs: float = 0.25

    #: Server id to start from a multi-server workspace.  ``None`` → first/active server.
    server_id: Optional[str] = None


class RffMockServer:
    """Manages the lifecycle of a RedfireForge API Mock server subprocess.

    Typical usage via pytest fixtures (see :mod:`rff_mock.fixtures`)::

        @pytest.fixture(scope="session")
        def mock(rff_mock_server):
            yield rff_mock_server

    Direct usage with ``with`` statement::

        with RffMockServer("mocks/orders.json") as mock:
            response = requests.get(mock.base_url + "/orders")

    Or manage lifecycle manually::

        mock = RffMockServer.start("mocks/orders.json")
        ...
        mock.stop()
    """

    #: Built-in readiness probe path.
    HEALTH_READY_PATH = HEALTH_READY_PATH

    #: Built-in liveness probe path.
    HEALTH_LIVE_PATH  = HEALTH_LIVE_PATH

    def __init__(self, definition_file: str, config: Optional[RffMockConfig] = None) -> None:
        self._definition_file = definition_file
        self._config = config or RffMockConfig()
        self._process: Optional[subprocess.Popen] = None
        self._port: Optional[int] = None
        self._port_file: Optional[Path] = None

    # ── Factory / context manager ─────────────────────────────────────────────

    @classmethod
    def start(cls, definition_file: str,
              config: Optional[RffMockConfig] = None) -> "RffMockServer":
        """Start and return a ready mock server (blocks until ready)."""
        instance = cls(definition_file, config)
        instance._start()
        return instance

    def __enter__(self) -> "RffMockServer":
        self._start()
        return self

    def __exit__(self, *_) -> None:
        self.stop()

    # ── Public interface ──────────────────────────────────────────────────────

    @property
    def port(self) -> int:
        """The OS port the mock server is listening on."""
        if self._port is None:
            raise RuntimeError("Server has not been started yet")
        return self._port

    @property
    def base_url(self) -> str:
        """Full base URL, e.g. ``http://localhost:51432``."""
        return f"http://localhost:{self.port}"

    @property
    def ready_url(self) -> str:
        """URL of the built-in readiness probe."""
        return self.base_url + HEALTH_READY_PATH

    @property
    def live_url(self) -> str:
        """URL of the built-in liveness probe."""
        return self.base_url + HEALTH_LIVE_PATH

    def stop(self) -> None:
        """Stop the mock server and clean up temporary files."""
        if self._process and self._process.poll() is None:
            self._process.terminate()
            try:
                self._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._process.kill()
        if self._port_file and self._port_file.exists():
            self._port_file.unlink(missing_ok=True)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _start(self) -> None:
        cfg = self._config
        port_file = Path(tempfile.mktemp(prefix="rff-mock-", suffix=".port"))
        self._port_file = port_file

        cmd = [
            cfg.rff_binary, "mock", "start", self._definition_file,
            "--port", "auto",
            "--port-file", str(port_file),
            "--standalone",
        ]
        if cfg.server_id:
            cmd += ["--server", cfg.server_id]

        self._process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        self._wait_for_ready(port_file, cfg)
        self._port = int(port_file.read_text().strip())

    def _wait_for_ready(self, port_file: Path, cfg: RffMockConfig) -> None:
        deadline = time.monotonic() + cfg.timeout_secs

        # Phase 1: wait for the port file to appear.
        while not (port_file.exists() and port_file.read_text().strip()):
            if time.monotonic() >= deadline:
                raise TimeoutError(
                    f"rff mock did not write port file within {cfg.timeout_secs}s: {port_file}"
                )
            time.sleep(cfg.poll_interval_secs)

        port = int(port_file.read_text().strip())
        health_url = f"http://localhost:{port}{HEALTH_READY_PATH}"

        # Phase 2: poll /__rff/health/ready until 200.
        while time.monotonic() < deadline:
            try:
                with urllib.request.urlopen(health_url, timeout=0.5) as resp:
                    if resp.status == 200:
                        return
            except (urllib.error.URLError, OSError):
                pass  # ECONNREFUSED — server not up yet
            except urllib.error.HTTPError as exc:
                if exc.code != 503:
                    raise  # unexpected error
                # 503 = alive but not ready; keep polling
            time.sleep(cfg.poll_interval_secs)

        raise TimeoutError(
            f"rff mock did not become ready at {health_url} within {cfg.timeout_secs}s"
        )
